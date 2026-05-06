import type { Paper, PatientProfile, PaperSummary } from "@/types"
import { callAI } from "./deepseek"

export async function summarizePapers(
  papers: Paper[],
  patient: PatientProfile
): Promise<PaperSummary[]> {
  const summaries: PaperSummary[] = []

  // Summarize top papers individually (only those with abstracts)
  const papersWithAbstracts = papers.filter((p) => p.abstract && p.abstract.length > 100)

  for (const paper of papersWithAbstracts) {
    const summary = await summarizeSinglePaper(paper, patient)
    if (summary) summaries.push(summary)
  }

  return summaries
}

async function summarizeSinglePaper(
  paper: Paper,
  patient: PatientProfile
): Promise<PaperSummary | null> {
  try {
    const response = await callAI([
      {
        role: "system",
        content: `You are a clinical expert summarizing research papers for a physiotherapist.
Be concise and clinically practical. Respond with valid JSON only.`,
      },
      {
        role: "user",
        content: `Summarize this paper for a clinician treating a ${patient.age}yo ${patient.sex} with ${patient.condition}.

PAPER: "${paper.title}" (${paper.year ?? "year unknown"})
ABSTRACT: ${paper.abstract}

Return JSON:
{
  "paperId": "${paper.id}",
  "population": "Who was studied (sample size if mentioned, demographics)",
  "intervention": "What intervention was used and how",
  "mainFindings": "Key results in 2-3 sentences (include effect sizes or p-values if available)",
  "clinicalRelevance": "Why this is relevant for this specific patient in 1-2 sentences",
  "evidenceLevel": "Level 1 / Level 2 / Level 3 / Level 4 / Level 5 (Oxford CEBM)",
  "limitations": "Main limitations in 1 sentence"
}`,
      },
    ])

    return JSON.parse(response.trim())
  } catch {
    return null
  }
}

export async function generateEvidenceSynthesis(
  papers: Paper[],
  summaries: PaperSummary[],
  patient: PatientProfile
): Promise<string> {
  if (summaries.length === 0) return ""

  const summaryText = summaries
    .map((s, i) => {
      const paper = papers.find((p) => p.id === s.paperId)
      return `[${i + 1}] "${paper?.title}" (${paper?.year ?? "?"})
Population: ${s.population}
Intervention: ${s.intervention}
Findings: ${s.mainFindings}
Evidence Level: ${s.evidenceLevel}`
    })
    .join("\n\n")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical expert writing a narrative evidence synthesis for a physiotherapist.
Write in clear, practical clinical language. Be direct and actionable.`,
      },
      {
        role: "user",
        content: `Write a clinical evidence synthesis for this patient:
- Patient: ${patient.age}yo ${patient.sex}, ${patient.condition}, ${patient.symptomDuration ?? "unknown duration"}
- Failed: ${patient.failedTreatments ?? "nothing reported"}

Based on these ${summaries.length} papers:
${summaryText}

Write a synthesis of 3-5 paragraphs covering:
1. What the evidence says about the best interventions for this patient profile
2. Which approaches have the strongest evidence
3. What to consider given failed treatments
4. Clinical recommendations (practical, not generic)

End with a disclaimer: "This synthesis is for clinical decision support only. Always apply professional clinical judgment."`,
      },
    ],
    0.5
  )

  return response
}
