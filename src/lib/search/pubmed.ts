import type { Paper } from "@/types"

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
const API_KEY = process.env.PUBMED_API_KEY || ""

interface ESearchResult {
  esearchresult: {
    idlist: string[]
    count: string
  }
}

interface ESummaryResult {
  result: Record<string, {
    uid: string
    title: string
    authors: Array<{ name: string }>
    pubdate: string
    source: string
    articleids: Array<{ idtype: string; value: string }>
    fulljournalname: string
  }>
}

export async function searchPubMed(query: string, maxResults = 20): Promise<Paper[]> {
  try {
    const searchUrl = new URL(`${BASE_URL}/esearch.fcgi`)
    searchUrl.searchParams.set("db", "pubmed")
    searchUrl.searchParams.set("term", query)
    searchUrl.searchParams.set("retmax", String(maxResults))
    searchUrl.searchParams.set("retmode", "json")
    searchUrl.searchParams.set("sort", "relevance")
    searchUrl.searchParams.set("datetype", "pdat")
    searchUrl.searchParams.set("mindate", "2010")
    if (API_KEY) searchUrl.searchParams.set("api_key", API_KEY)

    const searchRes = await fetch(searchUrl.toString())
    if (!searchRes.ok) return []

    const searchData: ESearchResult = await searchRes.json()
    const ids = searchData.esearchresult?.idlist ?? []
    if (ids.length === 0) return []

    const summaryUrl = new URL(`${BASE_URL}/esummary.fcgi`)
    summaryUrl.searchParams.set("db", "pubmed")
    summaryUrl.searchParams.set("id", ids.join(","))
    summaryUrl.searchParams.set("retmode", "json")
    if (API_KEY) summaryUrl.searchParams.set("api_key", API_KEY)

    const summaryRes = await fetch(summaryUrl.toString())
    if (!summaryRes.ok) return []

    const summaryData: ESummaryResult = await summaryRes.json()

    return ids.map((id) => {
      const item = summaryData.result[id]
      if (!item) return null

      const doi = item.articleids?.find((a) => a.idtype === "doi")?.value
      const year = item.pubdate ? parseInt(item.pubdate.slice(0, 4)) : undefined

      return {
        id: `pubmed_${id}`,
        title: item.title || "No title",
        authors: item.authors?.map((a) => a.name) ?? [],
        year,
        journal: item.fulljournalname || item.source,
        doi,
        pmid: id,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: "pubmed" as const,
      }
    }).filter(Boolean) as Paper[]
  } catch {
    console.error("PubMed search error")
    return []
  }
}
