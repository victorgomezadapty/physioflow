import type { Paper } from "@/types"

const BASE_URL = "https://search.scielo.org/api/v2/"

interface ScieloDoc {
  id: string
  ti: string | Record<string, string>  // title (may be multilingual)
  au?: string[]
  dp?: string     // publication date
  ta?: string     // journal abbreviation
  la?: string[]   // languages
  do?: string     // doi
  ab?: string | Record<string, string> // abstract
}

function extractText(field: string | Record<string, string> | undefined): string {
  if (!field) return ""
  if (typeof field === "string") return field
  return Object.values(field)[0] || ""
}

export async function searchSciELO(query: string, maxResults = 15): Promise<Paper[]> {
  try {
    const url = new URL(BASE_URL)
    url.searchParams.set("q", query)
    url.searchParams.set("count", String(maxResults))
    url.searchParams.set("output", "json")
    url.searchParams.set("lang", "en,es,pt")

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data: { docs?: ScieloDoc[] } = await res.json()
    const docs = data.docs ?? []

    return docs.map((item) => {
      const year = item.dp ? parseInt(item.dp.slice(0, 4)) : undefined
      const doi = item.do

      return {
        id: `scielo_${item.id}`,
        title: extractText(item.ti) || "No title",
        authors: item.au ?? [],
        year,
        journal: item.ta,
        abstract: extractText(item.ab),
        doi,
        url: doi ? `https://doi.org/${doi}` : undefined,
        source: "scielo" as const,
      }
    })
  } catch {
    console.error("SciELO search error")
    return []
  }
}
