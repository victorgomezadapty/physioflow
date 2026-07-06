import type {
  Paper,
  PICOSProtocol,
  QualityAssessment,
  CochraneRoBDomain,
  PEDroItem,
  RoBRating,
  Agent3aResult,
} from "@/types"
import { callAI } from "@/lib/ai/deepseek"
import { parseJSON } from "@/lib/ai/parse"

const COCHRANE_DOMAINS = [
  "Random sequence generation",
  "Allocation concealment",
  "Blinding of participants and personnel",
  "Blinding of outcome assessment",
  "Incomplete outcome data",
  "Selective reporting",
]

const PEDRO_ITEMS = [
  "Eligibility criteria specified",
  "Random allocation",
  "Concealed allocation",
  "Baseline comparability",
  "Blind subjects",
  "Blind therapists",
  "Blind assessors",
  "Adequate follow-up",
  "Intention-to-treat analysis",
  "Between-group statistical comparisons",
  "Point measures and variability data",
]

// ---------------------------------------------------------------------------
// assessQuality — Agent 3a
// ---------------------------------------------------------------------------
export async function assessQuality(
  papers: Paper[],
  protocol: PICOSProtocol
): Promise<Agent3aResult> {
  const assessments: QualityAssessment[] = []
  const BATCH_SIZE = 3 // Quality assessment is token-heavy; keep batches small

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const batchResults = await assessQualityBatch(batch, protocol)
    assessments.push(...batchResults)
  }

  return { qualityAssessments: assessments }
}

async function assessQualityBatch(
  batch: Paper[],
  protocol: PICOSProtocol
): Promise<QualityAssessment[]> {
  const papersText = batch
    .map((p) => {
      const abstract = p.abstractText ?? p.abstract ?? "No abstract available"
      return `ID: ${p.id}
Title: ${p.title}
Year: ${p.year ?? "unknown"} | Journal: ${p.journal ?? "unknown"}
Study type: ${p.studyType ?? "unknown"}
Abstract: ${abstract}`
    })
    .join("\n\n---\n\n")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical research methodologist performing quality assessment for a systematic review.
You assess Risk of Bias using Cochrane criteria and PEDro scale based ONLY on what is stated in abstracts.
CRITICAL RULES — you MUST follow these exactly:
1. Use "cannot_assess" when information is NOT present in the abstract. This is NOT the same as "unclear".
   - "unclear" = information is present but ambiguous
   - "cannot_assess" = information is simply absent from the abstract
2. NEVER assume blinding, randomization, or allocation details are present unless explicitly stated.
3. For EVERY rating, include a justification. Quote the abstract text OR write "Not mentioned in abstract."
4. Be conservative. When in doubt, use "cannot_assess".
Return valid JSON only — no markdown, no code fences, no explanation.`,
      },
      {
        role: "user",
        content: `Assess the quality of these papers. Clinical area: ${protocol.outcome}.

For each paper provide:
1. Cochrane Risk of Bias for 6 domains
2. PEDro scale items (if applicable — physiotherapy/exercise study)
3. Oxford CEBM evidence level

Papers:
${papersText}

Return JSON array — one object per paper:
[
  {
    "paperId": "exact paper id",
    "cochraneRoB": [
      {
        "domain": "Random sequence generation",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "quote from abstract or 'Not mentioned in abstract'"
      },
      {
        "domain": "Allocation concealment",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "..."
      },
      {
        "domain": "Blinding of participants and personnel",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "..."
      },
      {
        "domain": "Blinding of outcome assessment",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "..."
      },
      {
        "domain": "Incomplete outcome data",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "..."
      },
      {
        "domain": "Selective reporting",
        "rating": "low|high|unclear|cannot_assess",
        "justification": "..."
      }
    ],
    "pedroScore": {
      "total": 0,
      "items": [
        { "item": "Eligibility criteria specified", "score": 0 },
        { "item": "Random allocation", "score": 0 },
        { "item": "Concealed allocation", "score": 0 },
        { "item": "Baseline comparability", "score": 0 },
        { "item": "Blind subjects", "score": 0 },
        { "item": "Blind therapists", "score": 0 },
        { "item": "Blind assessors", "score": 0 },
        { "item": "Adequate follow-up", "score": 0 },
        { "item": "Intention-to-treat analysis", "score": 0 },
        { "item": "Between-group statistical comparisons", "score": 0 },
        { "item": "Point measures and variability data", "score": 0 }
      ]
    },
    "oxfordLevel": "1b"
  }
]

IMPORTANT: Use "cannot_assess" (not 0) for PEDro items that cannot be determined from the abstract.`,
      },
    ],
    0.1
  )

  try {
    type RawAssessment = {
      paperId: string
      cochraneRoB: { domain: string; rating: string; justification: string }[]
      pedroScore?: { total: number; items: { item: string; score: number | string }[] }
      oxfordLevel: string
    }
    const parsed = parseJSON<RawAssessment[]>(response)

    return batch.map((paper) => {
      const found = parsed.find((r) => r.paperId === paper.id)
      if (!found) return buildFallbackAssessment(paper.id)

      // Validate and normalize Cochrane domains
      const cochraneRoB: CochraneRoBDomain[] = COCHRANE_DOMAINS.map((domain) => {
        const item = found.cochraneRoB?.find((d) => d.domain === domain)
        return {
          domain,
          rating: (item?.rating as RoBRating) ?? "cannot_assess",
          justification: item?.justification ?? "Not assessed",
        }
      })

      // Normalize PEDro items
      const pedroItems: PEDroItem[] = PEDRO_ITEMS.map((itemName) => {
        const item = found.pedroScore?.items?.find((i) => i.item === itemName)
        const score = item?.score
        if (score === "cannot_assess") return { item: itemName, score: "cannot_assess" }
        if (score === 1) return { item: itemName, score: 1 }
        return { item: itemName, score: 0 }
      })

      // Recalculate PEDro total (only count numeric 0/1 scores)
      const pedroTotal = pedroItems.reduce(
        (sum, i) => sum + (typeof i.score === "number" ? i.score : 0),
        0
      )

      // Calculate cannotAssessPercentage across all Cochrane domains + PEDro items
      const allDomains = [
        ...cochraneRoB.map((d) => d.rating),
        ...pedroItems.map((i) => (i.score === "cannot_assess" ? "cannot_assess" : "assessed")),
      ]
      const cannotAssessCount = allDomains.filter((r) => r === "cannot_assess").length
      const cannotAssessPercentage = Math.round((cannotAssessCount / allDomains.length) * 100)

      return {
        paperId: paper.id,
        cochraneRoB,
        pedroScore: { total: pedroTotal, items: pedroItems },
        oxfordLevel: found.oxfordLevel ?? "unknown",
        cannotAssessPercentage,
      }
    })
  } catch {
    return batch.map((p) => buildFallbackAssessment(p.id))
  }
}

function buildFallbackAssessment(paperId: string): QualityAssessment {
  return {
    paperId,
    cochraneRoB: COCHRANE_DOMAINS.map((domain) => ({
      domain,
      rating: "cannot_assess" as RoBRating,
      justification: "Quality assessment failed — abstract parsing error",
    })),
    pedroScore: {
      total: 0,
      items: PEDRO_ITEMS.map((item) => ({ item, score: "cannot_assess" as const })),
    },
    oxfordLevel: "unknown",
    cannotAssessPercentage: 100,
  }
}
