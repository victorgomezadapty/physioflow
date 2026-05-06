import type { Paper } from "@/types"

const BASE_URL = "https://api.openalex.org/works"
const EMAIL = process.env.CONTACT_EMAIL || "contact@physioflow.app"

interface OAWork {
  id: string
  title: string
  publication_year?: number
  authorships: Array<{ author: { display_name: string } }>
  primary_location?: {
    source?: { display_name?: string }
    landing_page_url?: string
    pdf_url?: string
  }
  doi?: string
  abstract_inverted_index?: Record<string, number[]>
}

function reconstructAbstract(invertedIndex?: Record<string, number[]>): string | undefined {
  if (!invertedIndex) return undefined
  const words: string[] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word
    }
  }
  return words.filter(Boolean).join(" ")
}

export async function searchOpenAlex(query: string, maxResults = 20): Promise<Paper[]> {
  try {
    const url = new URL(BASE_URL)
    url.searchParams.set("search", query)
    url.searchParams.set("per-page", String(maxResults))
    url.searchParams.set("select", "id,title,publication_year,authorships,primary_location,doi,abstract_inverted_index")
    url.searchParams.set("mailto", EMAIL)

    const res = await fetch(url.toString())
    if (!res.ok) return []

    const data: { results: OAWork[] } = await res.json()
    return (data.results ?? []).map((item) => {
      const abstract = reconstructAbstract(item.abstract_inverted_index)
      const doiClean = item.doi?.replace("https://doi.org/", "")

      return {
        id: `oa_${item.id.split("/").pop()}`,
        title: item.title || "No title",
        authors: item.authorships?.map((a) => a.author.display_name) ?? [],
        year: item.publication_year,
        journal: item.primary_location?.source?.display_name,
        abstract,
        doi: doiClean,
        url: item.primary_location?.landing_page_url || (item.doi ? `https://doi.org/${doiClean}` : undefined),
        openAccessUrl: item.primary_location?.pdf_url ?? undefined,
        source: "openalex" as const,
      }
    })
  } catch {
    console.error("OpenAlex search error")
    return []
  }
}
