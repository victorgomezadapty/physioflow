import { NextRequest, NextResponse } from "next/server"
import type { PatientProfile, SearchResult } from "@/types"
import { translatePatientToPICOS } from "@/lib/ai/picos_translator"
import { runMultiSourceSearch } from "@/lib/search"
import { rankPapersByRelevance } from "@/lib/ai/ranker"
import { summarizePapers, generateEvidenceSynthesis } from "@/lib/ai/summarizer"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const patient: PatientProfile = await req.json()

    if (!patient.condition || !patient.age) {
      return NextResponse.json(
        { error: "Patient profile must include age and condition" },
        { status: 400 }
      )
    }

    // Step 1: Translate patient profile to PICOS
    const picos = await translatePatientToPICOS(patient)

    // Step 2: Search all databases in parallel
    const { papers, stats } = await runMultiSourceSearch(picos)

    // Step 3: Rank papers by relevance (AI scoring)
    const rankedPapers = await rankPapersByRelevance(papers, patient, picos)

    // Step 4: Take top 10 for deep summarization
    const topPapers = rankedPapers.filter((p) => (p.relevanceScore ?? 0) >= 40).slice(0, 10)

    // Step 5: Summarize top papers individually
    const summaries = await summarizePapers(topPapers, patient)

    // Step 6: Generate narrative evidence synthesis
    const evidenceSummary = await generateEvidenceSynthesis(topPapers, summaries, patient)

    const result: SearchResult = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      patientProfile: patient,
      picos,
      papers: rankedPapers,
      topPapers,
      evidenceSummary,
      summaries,
      searchStats: stats,
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Search pipeline error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
