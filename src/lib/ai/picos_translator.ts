import type { PatientProfile, PICOSQuery } from "@/types"
import { callAI } from "./deepseek"

export async function translatePatientToPICOS(patient: PatientProfile): Promise<PICOSQuery> {
  const patientDescription = `
Patient profile:
- Age: ${patient.age} years
- Sex: ${patient.sex}
- Weight: ${patient.weightKg ? `${patient.weightKg} kg` : "not specified"}
- Height: ${patient.heightCm ? `${patient.heightCm} cm` : "not specified"}
- Activity level: ${patient.activityLevel}${patient.sport ? ` — ${patient.sport}` : ""}
- Occupation: ${patient.occupation || "not specified"}
- Main condition/complaint: ${patient.condition}
- Symptom duration: ${patient.symptomDuration || "not specified"}
- Failed treatments: ${patient.failedTreatments || "none reported"}
- Clinical area: ${patient.clinicalArea}
- Additional notes: ${patient.additionalNotes || "none"}
`.trim()

  const response = await callAI([
    {
      role: "system",
      content: `You are a clinical research expert specializing in systematic reviews and meta-analyses in ${patient.clinicalArea}.
Your job is to convert a patient profile into a structured PICOS framework for literature searching, then generate optimized database search queries.
Always respond with valid JSON only. No markdown, no explanation.`,
    },
    {
      role: "user",
      content: `Convert this patient profile into a PICOS search strategy.

${patientDescription}

Respond with this exact JSON structure:
{
  "population": "Specific population description for searching (age range, sex if relevant, activity level, condition)",
  "intervention": "Main interventions to investigate (be specific, include alternatives if known treatments failed)",
  "comparison": "Comparison groups (control, alternative treatments, or placebo)",
  "outcome": "Primary and secondary outcomes to search for (functional scores, pain scales, return to activity, etc.)",
  "studyDesign": "Preferred study designs in order: systematic review, meta-analysis, RCT, cohort, case series",
  "keywords": ["keyword1", "keyword2", "keyword3", "...up to 10 keywords"],
  "searchQueries": {
    "pubmed": "Optimized PubMed query with MeSH terms and boolean operators. Include date filter (2010:2025[pdat]) and human filter.",
    "semantic": "Natural language query for Semantic Scholar (30-50 words, descriptive)",
    "general": "General search query for SciELO, OpenAlex, and ClinicalTrials (plain language, concise)"
  }
}`,
    },
  ])

  const picos: PICOSQuery = JSON.parse(response.trim())
  return picos
}
