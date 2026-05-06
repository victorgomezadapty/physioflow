import type { Paper } from "@/types"

const BASE_URL = "https://api.semanticscholar.org/graph/v1"
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || ""

interface SSPaper {
  paperId: string
  title: string
  year?: number
  authors: Array<{ name: string }>
  venue?: string
  externalIds?: { DOI?: string; PubMed?: string }
  openAccessPdf?: { url: string }
  abstract?: string
}

export async function searchSemanticScholar(query: string, maxResults = 20): Promise<Paper[]> {
  try {
    const url = new URL(`${BASE_URL}/paper/search`)
    url.searchParams.set("query", query)
    url.searchParams.set("limit", String(maxResults))
    url.searchParams.set("fields", "title,year,authors,venue,externalIds,openAccessPdf,abstract")

    const headers: Record<string, string> = {}
    if (API_KEY) headers["x-api-key"] = API_KEY

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) return []

    const data: { data: SSPaper[] } = await res.json()
    return (data.data ?? []).map((item) => ({
      id: `ss_${item.paperId}`,
      title: item.title || "No title",
      authors: item.authors?.map((a) => a.name) ?? [],
      year: item.year,
      journal: item.venue,
      abstract: item.abstract,
      doi: item.externalIds?.DOI,
      pmid: item.externalIds?.PubMed,
      url: `https://www.semanticscholar.org/paper/${item.paperId}`,
      openAccessUrl: item.openAccessPdf?.url,
      source: "semantic_scholar" as const,
    }))
  } catch {
    console.error("Semantic Scholar search error")
    return []
  }
}
