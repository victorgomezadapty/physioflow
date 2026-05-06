import type { Paper } from "@/types"

const BASE_URL = "https://api.biorxiv.org/details"

interface BioRxivPaper {
  doi: string
  title: string
  authors: string
  date: string
  category: string
  jatsxml?: string
  abstract: string
  server: string
}

export async function searchBioRxiv(query: string, maxResults = 10): Promise<Paper[]> {
  // bioRxiv/medRxiv API doesn't support keyword search directly —
  // it uses date-range endpoints. We use medRxiv for clinical preprints
  // and filter by querying their recent papers, which is limited.
  // For MVP we return recent medRxiv papers in health sciences.
  // A proper implementation would use their full-text search or CORE API.
  try {
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(today.getMonth() - 6)
    const fromDate = sixMonthsAgo.toISOString().split("T")[0]
    const toDate = today.toISOString().split("T")[0]

    const url = `${BASE_URL}/medrxiv/${fromDate}/${toDate}/0/json`
    const res = await fetch(url)
    if (!res.ok) return []

    const data: { collection: BioRxivPaper[] } = await res.json()
    const papers = data.collection ?? []

    const queryLower = query.toLowerCase()
    const keywords = queryLower.split(" ").filter((w) => w.length > 3)

    const filtered = papers
      .filter((p) => {
        const text = `${p.title} ${p.abstract} ${p.category}`.toLowerCase()
        return keywords.some((kw) => text.includes(kw))
      })
      .slice(0, maxResults)

    return filtered.map((item) => ({
      id: `medrxiv_${item.doi.replace(/\//g, "_")}`,
      title: item.title,
      authors: item.authors.split("; ").map((a) => a.trim()),
      year: item.date ? parseInt(item.date.slice(0, 4)) : undefined,
      journal: "medRxiv (preprint)",
      abstract: item.abstract,
      doi: item.doi,
      url: `https://doi.org/${item.doi}`,
      source: "biorxiv" as const,
      studyType: "Preprint",
    }))
  } catch {
    console.error("medRxiv search error")
    return []
  }
}
