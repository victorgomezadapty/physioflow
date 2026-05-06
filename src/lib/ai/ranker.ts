import type { Paper, PatientProfile, PICOSQuery } from "@/types"
import { callAI } from "./deepseek"

interface RankedPaper {
  id: string
  score: number
  reason: string
  studyType: string
}

export async function rankPapersByRelevance(
  papers: Paper[],
  patient: PatientProfile,
  picos: PICOSQuery
): Promise<Paper[]> {
  if (papers.length === 0) return []

  // Send papers in batches of 20 to stay within token limits
  const BATCH_SIZE = 20
  const allRanked: RankedPaper[] = []

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const ranked = await rankBatch(batch, patient, picos)
    allRanked.push(...ranked)
  }

  // Merge scores back into papers
  const scoreMap = new Map<string, RankedPaper>()
  for (const r of allRanked) {
    scoreMap.set(r.id, r)
  }

  return papers
    .map((paper) => {
      const ranked = scoreMap.get(paper.id)
      return {
        ...paper,
        relevanceScore: ranked?.score ?? 0,
        relevanceReason: ranked?.reason ?? "",
        studyType: paper.studyType || ranked?.studyType || "Unknown",
      }
    })
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
}

async function rankBatch(
  papers: Paper[],
  patient: PatientProfile,
  picos: PICOSQuery
): Promise<RankedPaper[]> {
  const paperList = papers
    .map(
      (p, i) =>
        `[${i + 1}] ID: ${p.id}
Title: ${p.title}
Year: ${p.year ?? "unknown"} | Source: ${p.source}
Abstract: ${p.abstract ? p.abstract.slice(0, 300) + "..." : "No abstract available"}`
    )
    .join("\n\n")

  const response = await callAI([
    {
      role: "system",
      content: `You are a clinical research expert. Score papers for relevance to a specific patient profile.
Respond with valid JSON only. No markdown.`,
    },
    {
      role: "user",
      content: `Score these papers for relevance to this patient:

PATIENT: ${patient.age}yo ${patient.sex}, ${patient.activityLevel} ${patient.sport || ""}, condition: ${patient.condition}
PICOS: P="${picos.population}" | I="${picos.intervention}" | O="${picos.outcome}"

PAPERS:
${paperList}

Return a JSON array with one object per paper:
[
  {
    "id": "exact paper id from above",
    "score": 0-100,
    "reason": "1-2 sentence explanation of why this score",
    "studyType": "RCT | Systematic Review | Meta-Analysis | Cohort | Case Series | Review | Preprint | Clinical Trial | Other"
  }
]

Score 80-100: Directly addresses patient's condition, population, and intervention
Score 60-79: Closely related condition or similar intervention
Score 40-59: Partially relevant, different population or outcome
Score 0-39: Low relevance`,
    },
  ])

  return JSON.parse(response.trim())
}
