// =============================================================================
// PhysioFlow — Type Definitions
// 6-agent + coordinator pipeline following PRISMA methodology
// =============================================================================

// -----------------------------------------------------------------------------
// 1. PatientProfile
// -----------------------------------------------------------------------------
export interface PatientProfile {
  id?: string                // Added for pipeline tracking
  age: number
  sex: "male" | "female" | "other"
  weightKg?: number
  heightCm?: number
  activityLevel: "sedentary" | "recreational" | "amateur" | "professional"
  sport?: string
  occupation?: string
  condition: string          // Main clinical condition / diagnosis
  injuryHistory?: string     // Previous treatments, surgeries, etc.
  symptomDuration?: string   // e.g. "6 months", "acute"
  failedTreatments?: string  // What has already been tried
  clinicalArea: "physiotherapy" | "training" | "nutrition"
  additionalNotes?: string
}

// -----------------------------------------------------------------------------
// 2. PICOSProtocol — frozen, immutable search protocol
// -----------------------------------------------------------------------------
export interface PICOSProtocol {
  population: string
  intervention: string
  comparison: string
  outcome: string
  studyDesign: string
  keywords: string[]
  searchQueries: {
    pubmed: string
    semantic: string
    general: string
  }
  frozenAt: string   // ISO date — set once, never changed
  hash: string       // Hash of PICOS content for immutability verification
}


// -----------------------------------------------------------------------------
// 3. SearchSource
// -----------------------------------------------------------------------------
export type SearchSource =
  | "pubmed"
  | "semantic_scholar"
  | "openalex"
  | "europe_pmc"
  | "scielo"
  | "biorxiv"
  | "clinical_trials"
  | "core"
  | "pedro"

// -----------------------------------------------------------------------------
// 4. Paper — a single paper from any source
// -----------------------------------------------------------------------------
export interface Paper {
  id: string                   // Internal dedup ID (DOI or generated)
  title: string
  authors: string[]
  year?: number
  journal?: string
  abstract?: string            // Legacy field name (kept for compatibility)
  abstractText?: string        // Preferred field name (avoids JS reserved word)
  doi?: string
  pmid?: string
  url?: string
  openAccessUrl?: string
  source: SearchSource
  studyType?: string           // RCT, systematic review, cohort, etc.
  relevanceScore?: number      // 0-100 scored by AI
  relevanceReason?: string
  fullTextAvailable?: boolean  // Whether full text can be fetched (defaults to false)
}

// -----------------------------------------------------------------------------
// 5. ScreeningDecision — per-paper screening result
// -----------------------------------------------------------------------------
export interface ScreeningDecision {
  paperId: string
  level: "title_abstract" | "full_evaluation" | "sensitivity"
  decision: "include" | "exclude" | "borderline"
  reason: string
  confidence: number           // 0.0 – 1.0
}

// -----------------------------------------------------------------------------
// 6. PRISMAFlow — PRISMA flowchart data
// -----------------------------------------------------------------------------
export interface ExclusionGroup {
  reason: string
  count: number
}

export interface PRISMAFlow {
  identified: number                           // Total from all databases
  bySource: Record<string, number>             // Per-database counts
  afterDedup: number                           // After deduplication
  screenedTitleAbstract: number                // Entered Level 1 screening
  excludedTitleAbstract: number                // Excluded at Level 1
  excludedTitleAbstractReasons: ExclusionGroup[]
  screenedFullEval: number                     // Entered Level 2 screening
  excludedFullEval: number                     // Excluded at Level 2
  excludedFullEvalReasons: ExclusionGroup[]
  sensitivityRecovered: number                 // Papers recovered by sensitivity pass
  includedForQuality: number                   // Final included for quality assessment
  finalIncluded: number                        // Final included in synthesis
  simulatedKappa: number                       // Simulated Cohen's Kappa (same-model)
  kappaDisclaimer: string                      // Always: "Kappa is simulated using same AI model — not equivalent to independent human reviewers"
}

// -----------------------------------------------------------------------------
// 7. QualityAssessment — per-paper quality evaluation
// -----------------------------------------------------------------------------
export type RoBRating = "low" | "high" | "unclear" | "cannot_assess"

export interface CochraneRoBDomain {
  domain: string
  rating: RoBRating
  justification: string  // Quote from abstract or "Not mentioned in abstract"
}

export interface PEDroItem {
  item: string
  score: 0 | 1 | "cannot_assess"
}

export interface QualityAssessment {
  paperId: string
  cochraneRoB: CochraneRoBDomain[]
  pedroScore?: {
    total: number
    items: PEDroItem[]
  }
  oxfordLevel: string           // e.g. "1b", "2a", "4"
  cannotAssessPercentage: number // % of domains rated "cannot_assess"
}

// -----------------------------------------------------------------------------
// 8. ExtractedData — per-paper quantitative data extraction
// -----------------------------------------------------------------------------
export type DataConfidence = "extracted" | "derived" | "not_reported"

export interface ExtractedValue {
  value: number
  confidence: DataConfidence
  sourceQuote: string          // Literal text from abstract that supports this value
}

export interface ExtractedGroupValues {
  group1?: number
  group2?: number
  confidence: DataConfidence
  sourceQuote: string
}

export interface ExtractedEffectSize {
  value: number
  type: "SMD" | "Hedges_g" | "Cohen_d" | "OR" | "RR" | "other"
  ci95: [number, number]
  confidence: DataConfidence
  sourceQuote: string
}

export interface ExtractedData {
  paperId: string
  sampleSize?: {
    total?: ExtractedValue
    group1?: ExtractedValue
    group2?: ExtractedValue
  }
  means?: ExtractedGroupValues
  sds?: ExtractedGroupValues
  effectSize?: ExtractedEffectSize
  pValue?: ExtractedValue
  outcomesMeasured: string[]
  sourceQuotes: Array<{ field: string; quote: string }>
}

// -----------------------------------------------------------------------------
// 9. StatisticalResult — output of meta-analysis (Agent 4)
// -----------------------------------------------------------------------------
export interface PooledEffect {
  value: number
  ci95: [number, number]
  pValue: number
}

export interface HeterogeneityResult {
  Q: number
  df: number
  pValue: number
  iSquared: number             // 0–100
  interpretation: "very_low" | "low" | "moderate" | "high"
}

export interface ForestPlotEntry {
  paperId: string
  label: string                // "Author, Year"
  effectSize: number
  ci95: [number, number]
  weight: number               // Percentage weight in meta-analysis
}

export interface ModeratorSubgroup {
  name: string
  effect: number
  ci95: [number, number]
  n: number
}

export interface ModeratorAnalysis {
  variable: string
  subgroups: ModeratorSubgroup[]
}

export interface StatisticalResult {
  pooledEffect?: PooledEffect  // Undefined if <3 studies had sufficient data
  heterogeneity?: HeterogeneityResult
  studiesIncludedInMeta: number
  studiesExcluded: number
  exclusionReason: string      // Why some studies were excluded from meta
  forestPlotData: ForestPlotEntry[]
  forestPlotSvg?: string       // SVG string for rendering
  moderatorAnalysis?: ModeratorAnalysis[]
  failSafeN?: number
  limitations: string[]        // Always populated
  publicationBiasNote: string  // Always: "Not assessed — requires full-text data extraction"
  redFlags: string[]           // Auto-generated warnings
  insufficientDataNarrative?: string // When <3 studies — plain language explanation
}

// -----------------------------------------------------------------------------
// 10. EvidenceSynthesis — final output (Agent 5)
// -----------------------------------------------------------------------------
export type GradeRating = "high" | "moderate" | "low" | "very_low"

export interface EvidenceSynthesis {
  generalSummary: string           // What was searched + found (2-3 paragraphs)
  specificSummary: string          // What the stats say, direction, magnitude (2-3 paragraphs)
  clinicalRecommendation: string   // For THIS patient, with inline paper ID citations
  gradeRating: GradeRating
  gradeJustification: string       // Explains the downgrade steps applied
  redFlags: string[]               // Auto-generated warning flags
  disclaimer: string               // Always present — hardcoded text
}

// -----------------------------------------------------------------------------
// 11. PipelineAuditLog — step-by-step transparency trail
// -----------------------------------------------------------------------------
export interface AuditStep {
  agent: string
  startedAt: string              // ISO date
  completedAt: string            // ISO date
  durationMs: number
  inputSummary: string           // What the agent received
  outputSummary: string          // What the agent produced
  warnings: string[]
}

export interface PipelineAuditLog {
  steps: AuditStep[]
}

// -----------------------------------------------------------------------------
// 12. FullSearchResult — complete pipeline output
// -----------------------------------------------------------------------------
export interface Agent1Result {
  papers: Paper[]
  stats: {
    total: number
    bySource: Record<string, number>
    deduplicatedCount: number
    databasesCalled: number
    databasesSucceeded: number
  }
  warnings: string[]
}

export interface Agent2Result {
  prismaFlow: PRISMAFlow
  includedPapers: Paper[]
  screeningDecisions: ScreeningDecision[]
}

export interface Agent3aResult {
  qualityAssessments: QualityAssessment[]
}

export interface Agent3bResult {
  extractedData: ExtractedData[]
  extractionCompleteness: number  // % of papers with at least one extracted value
}

export interface Agent4Result {
  statisticalResult: StatisticalResult
}

export interface Agent5Result {
  synthesis: EvidenceSynthesis
}

export interface FullSearchResult {
  id: string
  createdAt: string
  patientProfile: PatientProfile
  protocol: PICOSProtocol        // Frozen PICOS
  agent1Result: Agent1Result
  agent2Result: Agent2Result
  agent3aResult: Agent3aResult
  agent3bResult: Agent3bResult
  agent4Result: Agent4Result
  agent5Result: Agent5Result
  auditLog: PipelineAuditLog
}

// -----------------------------------------------------------------------------
// 13. SearchStatus — pipeline stage indicator
// -----------------------------------------------------------------------------
export type SearchStatus =
  | "idle"
  | "protocol"      // Generating + freezing PICOS protocol
  | "searching"     // Querying all databases
  | "screening"     // PRISMA screening (3 levels)
  | "quality"       // Agent 3a: quality assessment
  | "extracting"    // Agent 3b: data extraction
  | "analyzing"     // Agent 4: statistical analysis
  | "synthesizing"  // Agent 5: evidence synthesis
  | "complete"
  | "error"

// -----------------------------------------------------------------------------
// 14. AgentConfig — shared config for all agents (easy to swap model later)
// -----------------------------------------------------------------------------
export interface AgentConfig {
  model: string        // e.g. "deepseek-chat" — swap to "claude-3-5-sonnet" later
  maxTokens: number
  temperature: number
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: "deepseek-chat",
  maxTokens: 4096,
  temperature: 0.1,  // Low temperature for consistent, factual outputs
}

