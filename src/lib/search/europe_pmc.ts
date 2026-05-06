import type { Paper } from "@/types"

const BASE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

interface EPMCResult {
  id: string
  title: string
  authorString?: string
  pubYear?: string
  journalTitle?: string
  doi?: string
  pmid?: string
  abstractText?: string
  fullTextUrlList?: { fullTextUrl: Array<{ url: string; documentStyle: string }> }
}

export async function searchEuropePMC(query: string, maxResults = 15): Promise<Paper[]> {
  try {
    const url = new URL(BASE_URL)
    url.searchParams.set("query", `${query} AND (SRC:MED OR SRC:PMC)`)
    url.searchParams.set("resultType", "core")
    url.searchParams.set("pageSize", String(maxResults))
    url.searchParams.set("format", "json")
    url.searchParams.set("sort", "RELEVANCE")

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data: { resultList: { result: EPMCResult[] } } = await res.json()
    const results = data.resultList?.result ?? []

    return results.map((item) => {
      const authors = item.authorString
        ? item.authorString.split(", ").map((a) => a.trim())
        : []
      const openAccessUrl = item.fullTextUrlList?.fullTextUrl?.find(
        (u) => u.documentStyle === "pdf"
      )?.url

      return {
        id: `epmc_${item.id}`,
        title: item.title || "No title",
        authors,
        year: item.pubYear ? parseInt(item.pubYear) : undefined,
        journal: item.journalTitle,
        abstract: item.abstractText,
        doi: item.doi,
        pmid: item.pmid,
        url: item.doi ? `https://doi.org/${item.doi}` : undefined,
        openAccessUrl,
        source: "europe_pmc" as const,
      }
    })
  } catch {
    console.error("Europe PMC search error")
    return []
  }
}
