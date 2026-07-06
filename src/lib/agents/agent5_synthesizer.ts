import type {
  PatientProfile,
  PICOSProtocol,
  Agent1Result,
  Agent2Result,
  Agent3aResult,
  Agent3bResult,
  Agent4Result,
  EvidenceSynthesis,
  GradeRating,
  Agent5Result,
} from "@/types"
import { callAI } from "@/lib/ai/deepseek"
import { parseJSON } from "@/lib/ai/parse"

// ---------------------------------------------------------------------------
// Hardcoded disclaimer — always present, never skippable
// ---------------------------------------------------------------------------
const DISCLAIMER =
  "This is an AI-assisted clinical evidence scoping tool based on abstract-level analysis. " +
  "It is NOT a published systematic review and does NOT replace clinical judgment. " +
  "Statistical estimates are derived from abstracts and carry additional uncertainty compared to full-text data extraction. " +
  "Always verify key findings against original sources before making clinical decisions."

// ---------------------------------------------------------------------------
// synthesizeEvidence — Agent 5
// Receives STRUCTURED outputs from previous agents — NOT raw abstracts.
// ---------------------------------------------------------------------------
export async function synthesizeEvidence(
  patient: PatientProfile,
  protocol: PICOSProtocol,
  agent1: Agent1Result,
  agent2: Agent2Result,
  agent3a: Agent3aResult,
  agent3b: Agent3bResult,
  agent4: Agent4Result
): Promise<Agent5Result> {
  const stats = agent4.statisticalResult
  const prisma = agent2.prismaFlow
  const includedPapers = agent2.includedPapers

  // ── Build structured context for the AI (not raw abstracts) ──
  const searchSummary = buildSearchSummary(agent1, prisma)
  const qualitySummary = buildQualitySummary(agent3a, agent3b)
  const statsSummary = buildStatsSummary(agent4)
  const paperList = includedPapers
    .slice(0, 15)
    .map((p) => `[${p.id}] ${p.title} (${p.year ?? "n.d."})`)
    .join("\n")

  // ── Generate 3 sections in parallel ──
  const [generalSummary, specificSummary, recommendationAndGrade] = await Promise.all([
    generateGeneralSummary(protocol, searchSummary, qualitySummary, prisma),
    generateSpecificSummary(protocol, statsSummary, qualitySummary, includedPapers),
    generateRecommendationAndGrade(patient, protocol, statsSummary, qualitySummary, paperList),
  ])

  // ── Auto red flags (programmatic, not AI) ──
  const redFlags = computeRedFlags(agent2, agent3a, agent3b, agent4)

  // Merge AI-generated grade with auto red flags
  const { clinicalRecommendation, gradeRating, gradeJustification } = recommendationAndGrade

  return {
    synthesis: {
      generalSummary,
      specificSummary,
      clinicalRecommendation,
      gradeRating,
      gradeJustification,
      redFlags,
      disclaimer: DISCLAIMER,
    },
  }
}

// ---------------------------------------------------------------------------
// Section 1: General Summary
// ---------------------------------------------------------------------------
async function generateGeneralSummary(
  protocol: PICOSProtocol,
  searchSummary: string,
  qualitySummary: string,
  prisma: Agent2Result["prismaFlow"]
): Promise<string> {
  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical research summarizer writing for a healthcare professional.
Write concise, factual summaries based only on provided data. No speculation.
Write in English. Use plain professional language — not academic jargon.`,
      },
      {
        role: "user",
        content: `Write a 2-3 paragraph General Summary of this evidence search.

SEARCH PROTOCOL:
P: ${protocol.population}
I: ${protocol.intervention}
O: ${protocol.outcome}

SEARCH RESULTS:
${searchSummary}

QUALITY OVERVIEW:
${qualitySummary}

Your summary must cover:
1. What was searched (databases, key terms, date range)
2. How many studies found → included (PRISMA numbers: ${prisma.identified} identified → ${prisma.finalIncluded} included)
3. Main reasons for exclusion
4. Mix of peer-reviewed vs grey literature
5. Overall quality level of included evidence

Keep it factual, 150-200 words total. Write in paragraph form, not bullet points.`,
      },
    ],
    0.3
  )
  return response.trim()
}

// ---------------------------------------------------------------------------
// Section 2: Specific Summary
// ---------------------------------------------------------------------------
async function generateSpecificSummary(
  protocol: PICOSProtocol,
  statsSummary: string,
  qualitySummary: string,
  includedPapers: Agent2Result["includedPapers"]
): Promise<string> {
  const studyTypes = includedPapers
    .map((p) => p.studyType)
    .filter(Boolean)
    .slice(0, 10)
    .join(", ")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical research synthesizer writing a specific evidence summary for a physiotherapist.
Write based only on the provided statistical data. Be honest about uncertainty.
If data is insufficient or uncertain, say so explicitly. Write in English.`,
      },
      {
        role: "user",
        content: `Write a 2-3 paragraph Specific Summary of the statistical evidence.

TARGET OUTCOME: ${protocol.outcome}
STUDY TYPES IN REVIEW: ${studyTypes || "mixed"}

STATISTICAL RESULTS:
${statsSummary}

QUALITY SUMMARY:
${qualitySummary}

Your summary must cover:
1. Direction and magnitude of the overall effect (favor intervention / control / no difference)
2. Heterogeneity interpretation — what does it mean clinically?
3. Confidence in the estimate given data limitations
4. Any moderating factors or subgroup patterns

Be honest: if data is from abstracts only, note this uncertainty.
Keep it 150-200 words. Paragraph form only, no bullet points.`,
      },
    ],
    0.3
  )
  return response.trim()
}

// ---------------------------------------------------------------------------
// Section 3: Clinical Recommendation + GRADE
// ---------------------------------------------------------------------------
interface RecommendationAndGrade {
  clinicalRecommendation: string
  gradeRating: GradeRating
  gradeJustification: string
}

async function generateRecommendationAndGrade(
  patient: PatientProfile,
  protocol: PICOSProtocol,
  statsSummary: string,
  qualitySummary: string,
  paperList: string
): Promise<RecommendationAndGrade> {
  const patientContext = [
    `${patient.age}yo ${patient.sex}`,
    patient.activityLevel + (patient.sport ? ` (${patient.sport})` : ""),
    patient.condition,
    patient.symptomDuration ? `Duration: ${patient.symptomDuration}` : null,
    patient.failedTreatments ? `Already tried (failed): ${patient.failedTreatments}` : null,
  ]
    .filter(Boolean)
    .join(" | ")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical evidence synthesizer creating a clinical recommendation and GRADE rating.
CRITICAL RULES:
1. Recommendations are for direction and type of intervention ONLY — never specific dosages or protocols.
2. Cite paper IDs inline using [paper_id] notation whenever making a claim.
3. Explicitly account for failed treatments — do not recommend what has already been tried.
4. Apply GRADE methodology (High/Moderate/Low/Very Low).
5. AUTOMATICALLY downgrade GRADE by 1 level because this analysis is abstract-based, not full-text.
6. Write in English. Return valid JSON only, no markdown.`,
      },
      {
        role: "user",
        content: `Generate a clinical recommendation and GRADE rating.

PATIENT: ${patientContext}
PICOS: P: ${protocol.population} | I: ${protocol.intervention} | O: ${protocol.outcome}

EVIDENCE:
${statsSummary}

QUALITY:
${qualitySummary}

INCLUDED PAPERS (for citations):
${paperList}

GRADE STARTING POINTS:
- RCTs start at "high"
- Observational studies start at "low"
- Downgrade for: high risk of bias, inconsistency (I²>50%), indirectness (population mismatch), imprecision (wide CIs)
- MANDATORY: downgrade 1 additional level because analysis is based on abstracts only

Return JSON:
{
  "clinicalRecommendation": "1-2 paragraphs for this specific patient. Cite [paper_id] for every claim. Direction + type of intervention only — no dosages. Explicitly note why previously failed treatments are excluded.",
  "gradeRating": "high|moderate|low|very_low",
  "gradeJustification": "Step-by-step GRADE reasoning: starting level, each downgrade factor applied with reason, final level after abstract-only penalty."
}`,
      },
    ],
    0.2
  )

  try {
    const parsed = parseJSON<RecommendationAndGrade>(response)
    return {
      clinicalRecommendation: parsed.clinicalRecommendation ?? "Recommendation could not be generated.",
      gradeRating: (parsed.gradeRating as GradeRating) ?? "very_low",
      gradeJustification: parsed.gradeJustification ?? "GRADE assessment failed.",
    }
  } catch {
    return {
      clinicalRecommendation: response.trim(),
      gradeRating: "very_low",
      gradeJustification: "GRADE rating could not be parsed — defaulted to Very Low due to abstract-only analysis.",
    }
  }
}

// ---------------------------------------------------------------------------
// Auto red flags (programmatic — not AI)
// ---------------------------------------------------------------------------
function computeRedFlags(
  agent2: Agent2Result,
  agent3a: Agent3aResult,
  agent3b: Agent3bResult,
  agent4: Agent4Result
): string[] {
  const flags: string[] = []
  const stats = agent4.statisticalResult
  const prisma = agent2.prismaFlow

  if (prisma.finalIncluded < 3) {
    flags.push("Very few studies included (< 3) — interpret all findings with extreme caution.")
  }

  if (stats.heterogeneity && stats.heterogeneity.iSquared > 75) {
    flags.push(`High heterogeneity (I² = ${stats.heterogeneity.iSquared}%) — substantial differences between studies. Pooled estimate may be misleading.`)
  }

  const avgCannotAssess =
    agent3a.qualityAssessments.length > 0
      ? agent3a.qualityAssessments.reduce((s, q) => s + q.cannotAssessPercentage, 0) /
        agent3a.qualityAssessments.length
      : 0

  if (avgCannotAssess > 50) {
    flags.push(`Quality assessment severely limited: ${Math.round(avgCannotAssess)}% of quality domains could not be evaluated from abstract-only data.`)
  }

  if (agent3b.extractionCompleteness < 50) {
    flags.push(`Only ${agent3b.extractionCompleteness}% of included studies had extractable quantitative data in their abstracts — quantitative synthesis is highly uncertain.`)
  }

  if (stats.studiesIncludedInMeta < stats.studiesIncludedInMeta + stats.studiesExcluded &&
      stats.studiesExcluded > 0) {
    flags.push(`${stats.studiesExcluded} included studies could not contribute to quantitative analysis due to insufficient abstract-level data.`)
  }

  // Always add the abstract-only flag
  flags.push("This analysis is based on abstract-level data only. Full-text access would substantially improve reliability.")

  return flags
}

// ---------------------------------------------------------------------------
// Context builders — convert structured data to AI-readable summaries
// ---------------------------------------------------------------------------
function buildSearchSummary(agent1: Agent1Result, prisma: Agent2Result["prismaFlow"]): string {
  const sourceBreakdown = Object.entries(agent1.stats.bySource)
    .filter(([, n]) => n > 0)
    .map(([src, n]) => `${src}: ${n}`)
    .join(", ")

  return [
    `Databases searched: ${agent1.stats.databasesSucceeded} of ${agent1.stats.databasesCalled} responded successfully.`,
    `Results: ${sourceBreakdown}`,
    `Total retrieved: ${agent1.stats.total} | After deduplication: ${agent1.stats.deduplicatedCount}`,
    `PRISMA: ${prisma.screenedTitleAbstract} screened → ${prisma.includedForQuality} included`,
    agent1.warnings.length > 0 ? `Warnings: ${agent1.warnings.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function buildQualitySummary(agent3a: Agent3aResult, agent3b: Agent3bResult): string {
  const qa = agent3a.qualityAssessments
  if (qa.length === 0) return "No quality assessments available."

  const avgCannotAssess = Math.round(
    qa.reduce((s, q) => s + q.cannotAssessPercentage, 0) / qa.length
  )

  const lowRobCount = qa.filter(
    (q) => q.cochraneRoB.filter((d) => d.rating === "high").length === 0
  ).length

  const pedroScores = qa
    .filter((q) => q.pedroScore && q.pedroScore.total > 0)
    .map((q) => q.pedroScore!.total)
  const avgPedro =
    pedroScores.length > 0
      ? Math.round(pedroScores.reduce((a, b) => a + b, 0) / pedroScores.length)
      : null

  return [
    `${qa.length} papers quality-assessed.`,
    `${lowRobCount} of ${qa.length} papers had no high-risk Cochrane RoB domains detected.`,
    avgPedro !== null ? `Average PEDro score: ${avgPedro}/11.` : null,
    `Average cannot-assess rate: ${avgCannotAssess}% of quality domains (due to abstract-only evaluation).`,
    `Extraction completeness: ${agent3b.extractionCompleteness}% of papers had quantitative data in abstracts.`,
  ]
    .filter(Boolean)
    .join(" ")
}

function buildStatsSummary(agent4: Agent4Result): string {
  const stats = agent4.statisticalResult

  if (stats.insufficientDataNarrative) {
    return stats.insufficientDataNarrative
  }

  const lines = [
    `Studies in meta-analysis: ${stats.studiesIncludedInMeta}`,
  ]

  if (stats.pooledEffect) {
    lines.push(
      `Pooled effect (Hedges' g): ${stats.pooledEffect.value} (95% CI: ${stats.pooledEffect.ci95[0]} to ${stats.pooledEffect.ci95[1]}, p=${stats.pooledEffect.pValue})`
    )
  }

  if (stats.heterogeneity) {
    lines.push(
      `Heterogeneity: Q=${stats.heterogeneity.Q}, I²=${stats.heterogeneity.iSquared}% (${stats.heterogeneity.interpretation}), p=${stats.heterogeneity.pValue}`
    )
  }

  if (stats.failSafeN !== undefined) {
    lines.push(`Orwin's fail-safe N: ${stats.failSafeN} (null-result studies needed to reduce effect to trivial)`)
  }

  lines.push(...stats.limitations)
  lines.push(stats.publicationBiasNote)

  return lines.join("\n")
}
