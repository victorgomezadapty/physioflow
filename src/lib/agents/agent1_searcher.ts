import type { Paper, PICOSProtocol, Agent1Result } from "@/types"
import { searchPubMed } from "@/lib/search/pubmed"
import { searchSemanticScholar } from "@/lib/search/semantic_scholar"
import { searchOpenAlex } from "@/lib/search/openalex"
import { searchEuropePMC } from "@/lib/search/europe_pmc"
import { searchSciELO } from "@/lib/search/scielo"
import { searchClinicalTrials } from "@/lib/search/clinical_trials"
import { searchBioRxiv } from "@/lib/search/biorxiv"
import { deduplicatePapers } from "@/lib/search/deduplication"

// ---------------------------------------------------------------------------
// Database configurations — name, fetch function, result limit, query key
// ---------------------------------------------------------------------------
type QueryKey = "pubmed" | "semantic" | "general"

interface DatabaseConfig {
  name: string
  sourceKey: string
  queryKey: QueryKey
  maxResults: number
  fn: (query: string, max: number) => Promise<Paper[]>
}

const DATABASES: DatabaseConfig[] = [
  { name: "PubMed",            sourceKey: "pubmed",           queryKey: "pubmed",   maxResults: 30, fn: searchPubMed },
  { name: "Semantic Scholar",  sourceKey: "semantic_scholar", queryKey: "semantic", maxResults: 25, fn: searchSemanticScholar },
  { name: "OpenAlex",          sourceKey: "openalex",         queryKey: "general",  maxResults: 25, fn: searchOpenAlex },
  { name: "Europe PMC",        sourceKey: "europe_pmc",       queryKey: "pubmed",   maxResults: 20, fn: searchEuropePMC },
  { name: "SciELO",            sourceKey: "scielo",           queryKey: "general",  maxResults: 20, fn: searchSciELO },
  { name: "ClinicalTrials.gov",sourceKey: "clinical_trials",  queryKey: "general",  maxResults: 15, fn: searchClinicalTrials },
  { name: "medRxiv/bioRxiv",   sourceKey: "biorxiv",          queryKey: "general",  maxResults: 15, fn: searchBioRxiv },
]

// ---------------------------------------------------------------------------
// runSearch — Agent 1
// Searches all databases in parallel, tracks failures, deduplicates results.
// ---------------------------------------------------------------------------
export async function runSearch(protocol: PICOSProtocol): Promise<Agent1Result> {
  const warnings: string[] = []

  // Run all databases in parallel — never let one failure kill the rest
  const settled = await Promise.allSettled(
    DATABASES.map((db) =>
      db.fn(protocol.searchQueries[db.queryKey], db.maxResults)
        .then((papers) => ({ db, papers, error: null }))
        .catch((err) => ({ db, papers: [] as Paper[], error: err as Error }))
    )
  )

  // Count successes and collect warnings for failures
  let databasesSucceeded = 0
  const bySource: Record<string, number> = {}
  const allPapers: Paper[] = []

  for (const result of settled) {
    // Promise.allSettled with our .catch wrapper should always fulfill,
    // but handle the reject case defensively.
    if (result.status === "rejected") {
      warnings.push(`Unexpected pipeline error in search: ${String(result.reason)}`)
      continue
    }

    const { db, papers, error } = result.value

    if (error) {
      warnings.push(`${db.name} search failed: ${error.message}`)
      bySource[db.sourceKey] = 0
    } else {
      bySource[db.sourceKey] = papers.length
      allPapers.push(...papers)
      databasesSucceeded++
    }
  }

  // Warn if major coverage is missing
  if (databasesSucceeded < 4) {
    warnings.push(`Only ${databasesSucceeded} of ${DATABASES.length} databases returned results — coverage may be limited.`)
  }

  const total = allPapers.length

  // Deduplicate: existing deduplication.ts handles DOI-first + title similarity
  const deduplicated = deduplicatePapers(allPapers)

  // Strip to essential fields only — reduces payload size for downstream agents
  const stripped = deduplicated.map(stripToEssentials)

  return {
    papers: stripped,
    stats: {
      total,
      bySource,
      deduplicatedCount: stripped.length,
      databasesCalled: DATABASES.length,
      databasesSucceeded,
    },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// stripToEssentials — remove non-essential metadata before passing downstream
// Agents only need: id, title, authors, year, journal, abstractText, doi,
// pmid, url, openAccessUrl, source, studyType
// ---------------------------------------------------------------------------
function stripToEssentials(paper: Paper): Paper {
  return {
    id:              paper.id,
    title:           paper.title,
    authors:         paper.authors,
    year:            paper.year,
    journal:         paper.journal,
    abstractText:    paper.abstractText ?? paper.abstract,
    abstract:        paper.abstract,          // Keep for backward compat
    doi:             paper.doi,
    pmid:            paper.pmid,
    url:             paper.url,
    openAccessUrl:   paper.openAccessUrl,
    source:          paper.source,
    studyType:       paper.studyType,
    fullTextAvailable: !!(paper.openAccessUrl), // Flag if OA URL is available
  }
}
