import type { Paper } from "@/types"

const BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

interface CTStudy {
  protocolSection: {
    identificationModule: {
      nctId: string
      briefTitle: string
      officialTitle?: string
    }
    statusModule: {
      overallStatus: string
      startDateStruct?: { date: string }
    }
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name: string }
    }
    descriptionModule?: {
      briefSummary?: string
    }
    conditionsModule?: {
      conditions?: string[]
    }
    armsInterventionsModule?: {
      interventions?: Array<{ name: string; description?: string }>
    }
  }
}

export async function searchClinicalTrials(query: string, maxResults = 10): Promise<Paper[]> {
  try {
    const url = new URL(BASE_URL)
    url.searchParams.set("query.term", query)
    url.searchParams.set("pageSize", String(maxResults))
    url.searchParams.set("format", "json")
    url.searchParams.set("fields", "protocolSection")

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data: { studies?: CTStudy[] } = await res.json()
    const studies = data.studies ?? []

    return studies.map((study) => {
      const id = study.protocolSection.identificationModule.nctId
      const title = study.protocolSection.identificationModule.briefTitle
      const year = study.protocolSection.statusModule.startDateStruct?.date
        ? parseInt(study.protocolSection.statusModule.startDateStruct.date.slice(0, 4))
        : undefined
      const abstract = study.protocolSection.descriptionModule?.briefSummary

      return {
        id: `ct_${id}`,
        title,
        authors: [],
        year,
        journal: "ClinicalTrials.gov",
        abstract,
        url: `https://clinicaltrials.gov/study/${id}`,
        source: "clinical_trials" as const,
        studyType: "Clinical Trial",
      }
    })
  } catch {
    console.error("ClinicalTrials.gov search error")
    return []
  }
}
