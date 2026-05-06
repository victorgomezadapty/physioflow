import type { Paper, PICOSQuery, SearchSource } from "@/types"
import { searchPubMed } from "./pubmed"
import { searchSemanticScholar } from "./semantic_scholar"
import { searchOpenAlex } from "./openalex"
import { searchEuropePMC } from "./europe_pmc"
import { searchSciELO } from "./scielo"
import { searchClinicalTrials } from "./clinical_trials"
import { searchBioRxiv } from "./biorxiv"
import { deduplicatePapers } from "./deduplication"

export interface SearchStats {
  total: number
  bySource: Record<SearchSource | string, number>
  deduplicatedCount: number
}

export async function runMultiSourceSearch(
  picos: PICOSQuery
): Promise<{ papers: Paper[]; stats: SearchStats }> {
  const { searchQueries } = picos

  // Run all sources in parallel
  const [pubmedResults, semanticResults, openAlexResults, europePmcResults, scieloResults, ctResults, biorxivResults] =
    await Promise.allSettled([
      searchPubMed(searchQueries.pubmed, 25),
      searchSemanticScholar(searchQueries.semantic, 20),
      searchOpenAlex(searchQueries.general, 20),
      searchEuropePMC(searchQueries.pubmed, 15),
      searchSciELO(searchQueries.general, 15),
      searchClinicalTrials(searchQueries.general, 10),
      searchBioRxiv(searchQueries.general, 10),
    ])

  const extract = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === "fulfilled" ? r.value : fallback

  const bySource: Record<string, number> = {
    pubmed: extract(pubmedResults, []).length,
    semantic_scholar: extract(semanticResults, []).length,
    openalex: extract(openAlexResults, []).length,
    europe_pmc: extract(europePmcResults, []).length,
    scielo: extract(scieloResults, []).length,
    clinical_trials: extract(ctResults, []).length,
    biorxiv: extract(biorxivResults, []).length,
  }

  const allPapers: Paper[] = [
    ...extract(pubmedResults, []),
    ...extract(semanticResults, []),
    ...extract(openAlexResults, []),
    ...extract(europePmcResults, []),
    ...extract(scieloResults, []),
    ...extract(ctResults, []),
    ...extract(biorxivResults, []),
  ]

  const total = allPapers.length
  const deduplicated = deduplicatePapers(allPapers)

  return {
    papers: deduplicated,
    stats: { total, bySource, deduplicatedCount: deduplicated.length },
  }
}
