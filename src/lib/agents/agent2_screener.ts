import type {
  Paper,
  PICOSProtocol,
  PatientProfile,
  ScreeningDecision,
  PRISMAFlow,
  Agent2Result,
  ExclusionGroup,
} from "@/types"
import { callAI } from "@/lib/ai/deepseek"
import { parseJSON } from "@/lib/ai/parse"

// ---------------------------------------------------------------------------
// Types local to this agent
// ---------------------------------------------------------------------------
interface RawScreeningItem {
  paperId: string
  decision: "include" | "exclude" | "borderline"
  reason: string
  confidence: number
}

// ---------------------------------------------------------------------------
// screenPapers — Agent 2
// 3-level PRISMA screening with simulated dual-reviewer and sensitivity pass.
// ---------------------------------------------------------------------------
export async function screenPapers(
  papers: Paper[],
  protocol: PICOSProtocol,
  patient: PatientProfile
): Promise<Agent2Result> {
  const allDecisions: ScreeningDecision[] = []

  // ── Level 1: Title/Abstract screening (batched, 8 papers per AI call) ──
  const level1Results = await screenLevel1(papers, protocol, allDecisions)

  const afterLevel1Include = level1Results.filter((r) => r.decision === "include")
  const afterLevel1Borderline = level1Results.filter((r) => r.decision === "borderline")
  const afterLevel1Excluded = level1Results.filter((r) => r.decision === "exclude")

  const level1PassedIds = new Set([
    ...afterLevel1Include.map((r) => r.paperId),
    ...afterLevel1Borderline.map((r) => r.paperId),
  ])
  const level1PassedPapers = papers.filter((p) => level1PassedIds.has(p.id))

  // ── Level 2: Deep evaluation (individual, full abstract) — Pass A ──
  const level2PassA = await screenLevel2(level1PassedPapers, protocol, patient, "A", allDecisions)

  // ── Simulated dual-reviewer: Pass B (slightly different prompt) ──
  const level2PassB = await screenLevel2(level1PassedPapers, protocol, patient, "B", allDecisions)

  // Resolve disagreements between Pass A and B (conservative: include if any disagreement)
  const { resolvedLevel2, kappa } = resolveDisagreements(level2PassA, level2PassB)

  const level2IncludedIds = new Set(
    resolvedLevel2.filter((r) => r.decision === "include").map((r) => r.paperId)
  )
  const level2ExcludedPapers = level1PassedPapers.filter((p) => !level2IncludedIds.has(p.id))

  // ── Level 3: Sensitivity pass for borderline-excluded papers ──
  // Re-evaluate papers from Level 1 with low-confidence exclusions (0.3–0.5)
  const borderlineForSensitivity = afterLevel1Borderline.filter(
    (r) => r.confidence >= 0.3 && r.confidence < 0.5
  )
  const borderlinePapers = papers.filter((p) =>
    borderlineForSensitivity.some((r) => r.paperId === p.id) && !level2IncludedIds.has(p.id)
  )

  const sensitivityRecovered = await screenSensitivityPass(
    borderlinePapers,
    protocol,
    patient,
    allDecisions
  )
  const sensitivityRecoveredIds = new Set(sensitivityRecovered.map((p) => p.id))

  // ── Final included set ──
  const finalIncludedPapers = [
    ...papers.filter((p) => level2IncludedIds.has(p.id)),
    ...sensitivityRecovered,
  ]

  // ── Build PRISMA flow ──
  const bySource: Record<string, number> = {}
  for (const p of papers) {
    bySource[p.source] = (bySource[p.source] || 0) + 1
  }

  const prismaFlow: PRISMAFlow = {
    identified: papers.length,
    bySource,
    afterDedup: papers.length, // Dedup already done in Agent 1
    screenedTitleAbstract: papers.length,
    excludedTitleAbstract: afterLevel1Excluded.length,
    excludedTitleAbstractReasons: groupExclusionReasons(afterLevel1Excluded.map((r) => r.reason)),
    screenedFullEval: level1PassedPapers.length,
    excludedFullEval: level2ExcludedPapers.length,
    excludedFullEvalReasons: groupExclusionReasons(
      resolvedLevel2.filter((r) => r.decision === "exclude").map((r) => r.reason)
    ),
    sensitivityRecovered: sensitivityRecovered.length,
    includedForQuality: finalIncludedPapers.length,
    finalIncluded: finalIncludedPapers.length,
    simulatedKappa: kappa,
    kappaDisclaimer:
      "Kappa is simulated using the same AI model with different prompts — not equivalent to independent human reviewers.",
  }

  return {
    prismaFlow,
    includedPapers: finalIncludedPapers,
    screeningDecisions: allDecisions,
  }
}

// ---------------------------------------------------------------------------
// Level 1: Batch screening — 8 papers per AI call
// ---------------------------------------------------------------------------
async function screenLevel1(
  papers: Paper[],
  protocol: PICOSProtocol,
  allDecisions: ScreeningDecision[]
): Promise<RawScreeningItem[]> {
  const results: RawScreeningItem[] = []
  const BATCH_SIZE = 8

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const batchResults = await screenBatch(batch, protocol)
    results.push(...batchResults)

    // Record decisions
    for (const r of batchResults) {
      allDecisions.push({
        paperId: r.paperId,
        level: "title_abstract",
        decision: r.decision,
        reason: r.reason,
        confidence: r.confidence,
      })
    }
  }

  return results
}

async function screenBatch(batch: Paper[], protocol: PICOSProtocol): Promise<RawScreeningItem[]> {
  const papersText = batch
    .map((p, i) => {
      const abstract = p.abstractText ?? p.abstract ?? ""
      const preview = abstract.slice(0, 300) + (abstract.length > 300 ? "..." : "")
      return `[${i}] ID: ${p.id}
Title: ${p.title}
Authors: ${p.authors.slice(0, 3).join(", ")}${p.authors.length > 3 ? " et al." : ""}
Year: ${p.year ?? "unknown"}
Abstract preview: ${preview || "No abstract available"}`
    })
    .join("\n\n")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a systematic review screener. Evaluate papers against PICOS criteria.
Return valid JSON only — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Screen these papers against the PICOS criteria below.

PICOS:
P (Population): ${protocol.population}
I (Intervention): ${protocol.intervention}
C (Comparison): ${protocol.comparison}
O (Outcome): ${protocol.outcome}
S (Study design): ${protocol.studyDesign}

For each paper, decide:
- "include": directly relevant to PICOS (confidence ≥ 0.6)
- "exclude": clearly not relevant (confidence ≥ 0.7)
- "borderline": partially relevant or insufficient information (confidence 0.3–0.7)

Papers to screen:
${papersText}

Return a JSON array — one object per paper, in the same order:
[
  {
    "paperId": "exact paper id from above",
    "decision": "include|exclude|borderline",
    "reason": "one sentence explaining the decision",
    "confidence": 0.0
  }
]`,
      },
    ],
    0.1
  )

  try {
    const parsed = parseJSON<RawScreeningItem[]>(response)
    // Validate and fill missing papers defensively
    return batch.map((paper) => {
      const found = parsed.find((r) => r.paperId === paper.id)
      return found ?? { paperId: paper.id, decision: "borderline", reason: "No AI response for this paper", confidence: 0.4 }
    })
  } catch {
    // If parsing fails, default all to borderline (conservative)
    return batch.map((p) => ({
      paperId: p.id,
      decision: "borderline" as const,
      reason: "Screening parse error — defaulted to borderline",
      confidence: 0.4,
    }))
  }
}

// ---------------------------------------------------------------------------
// Level 2: Deep evaluation — individual papers, full abstract
// ---------------------------------------------------------------------------
async function screenLevel2(
  papers: Paper[],
  protocol: PICOSProtocol,
  patient: PatientProfile,
  pass: "A" | "B",
  allDecisions: ScreeningDecision[]
): Promise<RawScreeningItem[]> {
  const results: RawScreeningItem[] = []

  // Batch Level 2 at 4 papers per call for efficiency
  const BATCH_SIZE = 4
  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const batchResults = await screenLevel2Batch(batch, protocol, patient, pass)
    results.push(...batchResults)

    for (const r of batchResults) {
      allDecisions.push({
        paperId: r.paperId,
        level: "full_evaluation",
        decision: r.decision,
        reason: `[Pass ${pass}] ${r.reason}`,
        confidence: r.confidence,
      })
    }
  }

  return results
}

async function screenLevel2Batch(
  batch: Paper[],
  protocol: PICOSProtocol,
  patient: PatientProfile,
  pass: "A" | "B"
): Promise<RawScreeningItem[]> {
  const papersText = batch
    .map((p) => {
      const abstract = p.abstractText ?? p.abstract ?? "No abstract available"
      return `ID: ${p.id}
Title: ${p.title}
Year: ${p.year ?? "unknown"} | Journal: ${p.journal ?? "unknown"} | Type: ${p.studyType ?? "unknown"}
Abstract: ${abstract}`
    })
    .join("\n\n---\n\n")

  // Pass B uses a slightly more liberal framing to simulate a second reviewer
  const passInstruction =
    pass === "A"
      ? "Apply strict PICOS criteria. When in doubt, lean toward exclusion."
      : "Apply PICOS criteria generously. Consider indirect relevance. When in doubt, lean toward inclusion."

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are an experienced clinical systematic reviewer. ${passInstruction}
Return valid JSON only — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Evaluate these papers for full inclusion in a systematic review.

Patient context: ${patient.age}yo ${patient.sex}, ${patient.condition},
activity: ${patient.activityLevel}${patient.sport ? ` (${patient.sport})` : ""},
duration: ${patient.symptomDuration ?? "not specified"},
failed treatments: ${patient.failedTreatments ?? "none"}.

PICOS:
P: ${protocol.population}
I: ${protocol.intervention}
C: ${protocol.comparison}
O: ${protocol.outcome}
S: ${protocol.studyDesign}

Evaluate each paper. Include (decision: "include") if confidence ≥ 0.6, otherwise exclude.

Papers:
${papersText}

Return JSON array:
[
  {
    "paperId": "exact paper id",
    "decision": "include|exclude",
    "reason": "2-3 sentences evaluating all PICOS elements",
    "confidence": 0.0
  }
]`,
      },
    ],
    0.1
  )

  try {
    const parsed = parseJSON<RawScreeningItem[]>(response)
    return batch.map((paper) => {
      const found = parsed.find((r) => r.paperId === paper.id)
      return found ?? { paperId: paper.id, decision: "include", reason: "No AI response — defaulted to include (conservative)", confidence: 0.5 }
    })
  } catch {
    return batch.map((p) => ({
      paperId: p.id,
      decision: "include" as const,
      reason: "Level 2 parse error — defaulted to include (conservative)",
      confidence: 0.5,
    }))
  }
}

// ---------------------------------------------------------------------------
// Level 3: Sensitivity pass — argue FOR inclusion of borderline papers
// ---------------------------------------------------------------------------
async function screenSensitivityPass(
  papers: Paper[],
  protocol: PICOSProtocol,
  patient: PatientProfile,
  allDecisions: ScreeningDecision[]
): Promise<Paper[]> {
  if (papers.length === 0) return []

  const recovered: Paper[] = []
  const BATCH_SIZE = 4

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const papersText = batch
      .map((p) => {
        const abstract = p.abstractText ?? p.abstract ?? "No abstract available"
        return `ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${abstract}`
      })
      .join("\n\n---\n\n")

    const response = await callAI(
      [
        {
          role: "system",
          content: `You are a systematic reviewer performing a sensitivity analysis to recover potentially relevant papers that were initially excluded.
Your job is to find the STRONGEST argument for why each paper SHOULD be included.
Return valid JSON only — no markdown, no explanation.`,
        },
        {
          role: "user",
          content: `These papers were initially excluded as borderline. Re-evaluate each one.

Patient: ${patient.age}yo ${patient.sex}, ${patient.condition}.
PICOS: P: ${protocol.population} | I: ${protocol.intervention} | O: ${protocol.outcome}

For each paper, find the strongest argument for inclusion.
If the argument is compelling (confidence ≥ 0.7), mark as "recover". Otherwise "confirm_exclude".

Papers:
${papersText}

Return JSON array:
[
  {
    "paperId": "exact paper id",
    "decision": "recover|confirm_exclude",
    "argument": "strongest argument for inclusion (2-3 sentences)",
    "confidence": 0.0
  }
]`,
        },
      ],
      0.2
    )

    try {
      const parsed = parseJSON<{ paperId: string; decision: string; argument: string; confidence: number }[]>(response)
      for (const r of parsed) {
        const paper = batch.find((p) => p.id === r.paperId)
        if (!paper) continue

        const isRecovered = r.decision === "recover" && r.confidence >= 0.7
        allDecisions.push({
          paperId: r.paperId,
          level: "sensitivity",
          decision: isRecovered ? "include" : "exclude",
          reason: `[Sensitivity pass] ${r.argument}`,
          confidence: r.confidence,
        })

        if (isRecovered) recovered.push(paper)
      }
    } catch {
      // Sensitivity pass failure is non-critical — just skip recovery
    }
  }

  return recovered
}

// ---------------------------------------------------------------------------
// Resolve disagreements between Pass A and B — calculate simulated Kappa
// ---------------------------------------------------------------------------
function resolveDisagreements(
  passA: RawScreeningItem[],
  passB: RawScreeningItem[]
): { resolvedLevel2: RawScreeningItem[]; kappa: number } {
  const resolved: RawScreeningItem[] = []
  let agreements = 0
  let total = 0

  for (const a of passA) {
    const b = passB.find((r) => r.paperId === a.paperId)
    if (!b) {
      resolved.push(a)
      continue
    }

    total++
    if (a.decision === b.decision) {
      agreements++
      resolved.push(a)
    } else {
      // Disagreement: conservative approach — include if either Pass says include
      const resolvedDecision =
        a.decision === "include" || b.decision === "include" ? "include" : "exclude"
      resolved.push({
        paperId: a.paperId,
        decision: resolvedDecision,
        reason: `[Disagreement resolved — ${resolvedDecision}] PassA: ${a.reason} | PassB: ${b.reason}`,
        confidence: (a.confidence + b.confidence) / 2,
      })
    }
  }

  // Simplified Cohen's Kappa: (Po - Pe) / (1 - Pe)
  // Assuming 50/50 base rates for simplicity
  const Po = total > 0 ? agreements / total : 1
  const Pe = 0.5 // Expected agreement by chance (50/50 include/exclude base rate)
  const kappa = Pe < 1 ? Math.max(0, (Po - Pe) / (1 - Pe)) : 1

  return { resolvedLevel2: resolved, kappa: Math.round(kappa * 100) / 100 }
}

// ---------------------------------------------------------------------------
// Group exclusion reasons into categories for PRISMA display
// ---------------------------------------------------------------------------
function groupExclusionReasons(reasons: string[]): ExclusionGroup[] {
  const categories: Record<string, string[]> = {
    "Population mismatch": [],
    "Wrong intervention": [],
    "Wrong study design": [],
    "Wrong outcome": [],
    "Not relevant to condition": [],
    "Duplicate / already included": [],
    "Other": [],
  }

  const categoryPatterns: [string, RegExp][] = [
    ["Population mismatch", /population|age|sample|participant|subject|patient/i],
    ["Wrong intervention", /intervention|treatment|therapy|exercise|protocol/i],
    ["Wrong study design", /study.?design|case.?report|review|editorial|letter|opinion/i],
    ["Wrong outcome", /outcome|measure|assessment|endpoint/i],
    ["Not relevant to condition", /condition|diagnosis|disease|injury|pain/i],
    ["Duplicate / already included", /duplicate|already/i],
  ]

  for (const reason of reasons) {
    let categorized = false
    for (const [category, pattern] of categoryPatterns) {
      if (pattern.test(reason)) {
        categories[category].push(reason)
        categorized = true
        break
      }
    }
    if (!categorized) categories["Other"].push(reason)
  }

  return Object.entries(categories)
    .filter(([, items]) => items.length > 0)
    .map(([reason, items]) => ({ reason, count: items.length }))
}
