import type { PatientProfile, PICOSProtocol } from "@/types"
import { callAI } from "@/lib/ai/deepseek"
import { parseJSON } from "@/lib/ai/parse"

// ---------------------------------------------------------------------------
// Simple deterministic hash — no external dependencies
// ---------------------------------------------------------------------------
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0")
}

// ---------------------------------------------------------------------------
// createSearchProtocol
// Takes a patient profile, generates a PICOS strategy via AI, freezes it
// with a timestamp and hash so it can never silently change mid-pipeline.
// ---------------------------------------------------------------------------
export async function createSearchProtocol(patient: PatientProfile): Promise<PICOSProtocol> {
  const patientDescription = buildPatientDescription(patient)

  const rawResponse = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical research expert specializing in systematic reviews and meta-analyses in ${patient.clinicalArea}.
Your task is to convert a patient profile into a structured PICOS framework and generate optimized search queries for multiple scientific databases.
You must respond with valid JSON only. No markdown, no code fences, no explanation — pure JSON.`,
      },
      {
        role: "user",
        content: `Convert this patient profile into a complete PICOS search protocol.

${patientDescription}

Respond with this exact JSON structure — no markdown, no extra text:
{
  "population": "Precise population for database searching — include age range, sex if clinically relevant, activity level, specific diagnosis with anatomical precision",
  "intervention": "Specific interventions to investigate — if previous treatments failed, prioritize alternatives. List 3-5 concrete interventions.",
  "comparison": "Control conditions or alternative treatments for comparison (e.g., placebo, sham, alternative intervention, usual care)",
  "outcome": "Primary and secondary outcomes using validated instruments where possible (e.g., VAS/NRS for pain, VISA-P for patellar tendinopathy, return-to-sport rates)",
  "studyDesign": "Preferred study designs in priority order: systematic review > meta-analysis > RCT > cohort > case series > case report",
  "keywords": [
    "minimum 12 keywords covering condition, interventions, population, and outcomes",
    "include both English and Spanish terms",
    "include MeSH terms where applicable"
  ],
  "searchQueries": {
    "pubmed": "Full PubMed query with MeSH terms, boolean operators, AND/OR/NOT. Include: ((2010/01/01[pdat]:2025/12/31[pdat])) AND (humans[mh]). Use field tags [tiab], [mh] appropriately.",
    "semantic": "Natural language descriptive query for Semantic Scholar (40-60 words). Describe the clinical scenario conversationally.",
    "general": "Concise plain-language query for SciELO, OpenAlex, LILACS, and ClinicalTrials.gov (20-30 words max)."
  }
}`,
      },
    ],
    0.1 // Low temperature for consistent, reproducible protocol generation
  )

  const base = parseJSON<Omit<PICOSProtocol, "frozenAt" | "hash">>(rawResponse)

  // Validate minimum required fields
  if (!base.population || !base.intervention || !base.keywords?.length) {
    throw new Error("PICOS protocol generation failed: missing required fields")
  }

  // Freeze the protocol — once created, these values never change
  const frozenAt = new Date().toISOString()
  const hashInput = JSON.stringify({
    population: base.population,
    intervention: base.intervention,
    comparison: base.comparison,
    outcome: base.outcome,
    keywords: base.keywords.sort(), // Sort for deterministic hashing
  })

  const protocol: PICOSProtocol = {
    ...base,
    frozenAt,
    hash: hashString(hashInput),
  }

  return protocol
}

// ---------------------------------------------------------------------------
// Builds a structured patient description for the AI prompt
// ---------------------------------------------------------------------------
function buildPatientDescription(patient: PatientProfile): string {
  const lines = [
    `Clinical area: ${patient.clinicalArea}`,
    `Age: ${patient.age} years`,
    `Sex: ${patient.sex}`,
    patient.weightKg ? `Weight: ${patient.weightKg} kg` : null,
    patient.heightCm ? `Height: ${patient.heightCm} cm` : null,
    `Activity level: ${patient.activityLevel}${patient.sport ? ` — sport: ${patient.sport}` : ""}`,
    patient.occupation ? `Occupation: ${patient.occupation}` : null,
    `Main condition / complaint: ${patient.condition}`,
    patient.symptomDuration ? `Symptom duration: ${patient.symptomDuration}` : null,
    patient.injuryHistory ? `Injury / medical history: ${patient.injuryHistory}` : null,
    patient.failedTreatments
      ? `Failed treatments (IMPORTANT — search for alternatives): ${patient.failedTreatments}`
      : "No prior treatments reported",
    patient.additionalNotes ? `Additional clinical notes: ${patient.additionalNotes}` : null,
  ]

  return lines.filter(Boolean).join("\n")
}
