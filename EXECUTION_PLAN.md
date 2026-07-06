# PhysioFlow — Execution Plan for Multi-Agent Pipeline

## Overview

This document is the step-by-step execution plan for rebuilding PhysioFlow's backend from a single-pass search into a 6-agent + coordinator pipeline that follows PRISMA methodology for clinical evidence synthesis.

**IMPORTANT RULES FOR THE BUILDER:**
1. Complete ONE phase at a time
2. After each phase: run `npm run build` to verify zero TypeScript errors
3. After each phase: review the checklist before moving to the next phase
4. Do NOT skip phases or combine them
5. Keep the DeepSeek API client (`src/lib/ai/deepseek.ts` and `src/lib/ai/parse.ts`) unchanged — all agents use them
6. All AI prompts must instruct the model to return **valid JSON only, no markdown**
7. UI text is bilingual (Spanish labels / English technical terms)
8. The system must be labeled as "AI-assisted clinical evidence scoping tool" — NEVER as "systematic review"

---

## Current File Structure (what exists)

```
src/
├── app/
│   ├── api/search/route.ts          ← Main pipeline (REWRITE)
│   ├── page.tsx                      ← Main page (UPDATE)
│   ├── layout.tsx                    ← Layout (KEEP)
│   └── globals.css                   ← Styles (KEEP)
├── components/
│   ├── PatientForm.tsx               ← Patient input (KEEP, minor updates)
│   ├── PaperCard.tsx                 ← Paper display (UPDATE)
│   ├── ResultsDashboard.tsx          ← Results tabs (REWRITE)
│   ├── SearchStatus.tsx              ← Progress bar (UPDATE)
│   └── ui/                           ← shadcn components (KEEP)
├── lib/
│   ├── ai/
│   │   ├── deepseek.ts              ← API client (KEEP)
│   │   ├── parse.ts                 ← JSON parser (KEEP)
│   │   ├── picos_translator.ts      ← PICOS generation (REFACTOR → coordinator)
│   │   ├── ranker.ts                ← Relevance ranking (REPLACE → agent2)
│   │   └── summarizer.ts            ← Summaries (REPLACE → agent5)
│   ├── search/
│   │   ├── index.ts                 ← Multi-source orchestrator (REFACTOR → agent1)
│   │   ├── pubmed.ts                ← PubMed client (KEEP)
│   │   ├── semantic_scholar.ts      ← Semantic Scholar client (KEEP)
│   │   ├── openalex.ts              ← OpenAlex client (KEEP)
│   │   ├── europe_pmc.ts            ← Europe PMC client (KEEP)
│   │   ├── scielo.ts                ← SciELO client (KEEP)
│   │   ├── clinical_trials.ts       ← ClinicalTrials client (KEEP)
│   │   ├── biorxiv.ts               ← medRxiv client (KEEP)
│   │   └── deduplication.ts         ← Dedup logic (KEEP)
│   └── utils.ts                     ← shadcn utils (KEEP)
└── types/
    └── index.ts                     ← Type definitions (REWRITE)
```

---

## PHASE 0: Types and Data Structures
**Goal:** Define ALL types upfront so every agent has a clear contract.

### Files to modify:
- `src/types/index.ts` — FULL REWRITE

### What to build:

```typescript
// The type file must define these exact types:

// 1. PatientProfile — keep existing, add `id: string` field

// 2. PICOSProtocol — the frozen search protocol
//    Fields: population, intervention, comparison, outcome, studyDesign,
//    keywords: string[], searchQueries: { pubmed, semantic, general },
//    frozenAt: string (ISO date), hash: string (for immutability check)

// 3. SearchSource — union type of all database names

// 4. Paper — a single paper from any source
//    Keep existing fields, ADD:
//    - abstractText?: string (rename from 'abstract' to avoid JS reserved word issues)
//    - fullTextAvailable: boolean

// 5. ScreeningDecision — per-paper screening result
//    Fields: paperId, level ('title_abstract' | 'full_evaluation' | 'sensitivity'),
//    decision ('include' | 'exclude' | 'borderline'),
//    reason: string, confidence: number (0-1)

// 6. PRISMAFlow — the PRISMA flowchart data
//    Fields: identified, afterDedup, screenedTitleAbstract, excludedTitleAbstract,
//    screenedFullEval, excludedFullEval (with reasons array),
//    includedForQuality, excludedQualityReasons,
//    finalIncluded, sensitivityRecovered,
//    simulatedKappa: number, kappaDisclaimer: string

// 7. QualityAssessment — per-paper quality
//    Fields: paperId, 
//    cochraneRoB: { domain: string, rating: 'low' | 'high' | 'unclear' | 'cannot_assess', justification: string }[],
//    pedroScore?: { total: number, items: { item: string, score: 0 | 1 | 'cannot_assess' }[] },
//    oxfordLevel: string,
//    cannotAssessPercentage: number

// 8. ExtractedData — per-paper quantitative data extraction
//    Fields: paperId, sampleSize?: { value: number, confidence: 'extracted' | 'derived' | 'not_reported' },
//    means?: { group1, group2, confidence }, sds?: { ... },
//    effectSize?: { value: number, type: 'SMD' | 'Hedges_g' | 'other', ci95: [number, number], confidence },
//    pValue?: { value: number, confidence },
//    outcomesMeasured: string[],
//    sourceQuotes: { field: string, quote: string }[] ← literal text from abstract

// 9. StatisticalResult — output of meta-analysis
//    Fields: pooledEffect: { value, ci95, pValue },
//    heterogeneity: { Q, df, pValue, iSquared, interpretation },
//    studiesIncludedInMeta: number, studiesExcluded: number, exclusionReason: string,
//    forestPlotData: { paperId, effectSize, ci95, weight }[],
//    moderatorAnalysis?: { variable, subgroups: { name, effect, ci95, n }[] }[],
//    limitations: string[],
//    publicationBiasNote: string ← always says "Not assessed — requires full-text data"

// 10. EvidenceSynthesis — final output
//     Fields: generalSummary (what was found, counts, sources),
//     specificSummary (what the stats say, direction, magnitude),
//     clinicalRecommendation (for THIS patient, citing paper IDs),
//     gradeRating: 'high' | 'moderate' | 'low' | 'very_low',
//     gradeJustification: string,
//     redFlags: string[] (auto-generated warnings),
//     disclaimer: string (always present)

// 11. PipelineAuditLog — tracks every step
//     Fields: steps: { agent: string, startedAt: string, completedAt: string,
//     inputSummary: string, outputSummary: string, warnings: string[] }[]

// 12. FullSearchResult — the complete result object
//     Fields: id, createdAt, patientProfile, protocol (frozen PICOS),
//     agent1Result: { papers, stats, warnings },
//     agent2Result: { prismaFlow, includedPapers, screeningDecisions },
//     agent3aResult: { qualityAssessments },
//     agent3bResult: { extractedData },
//     agent4Result: { statisticalResult },
//     agent5Result: { synthesis },
//     auditLog

// 13. SearchStatus — update to add new stages
//     'idle' | 'protocol' | 'searching' | 'screening' | 'quality' | 'extracting' |
//     'analyzing' | 'synthesizing' | 'complete' | 'error'

// 14. AgentConfig — shared config for all agents
//     Fields: maxTokens, temperature, model (for future swap)
```

### Checklist before moving to Phase 1:
- [ ] All 14 types are defined
- [ ] `npm run build` passes with zero errors
- [ ] No imports break in existing files (may need to update imports temporarily)

---

## PHASE 1: Coordinator + Frozen Protocol
**Goal:** Replace `picos_translator.ts` with a coordinator that generates AND freezes the PICOS protocol.

### Files to modify:
- `src/lib/agents/coordinator.ts` — NEW FILE
- `src/lib/ai/picos_translator.ts` — DELETE after migrating logic

### What to build:

The coordinator function `createSearchProtocol(patient: PatientProfile): Promise<PICOSProtocol>`:
1. Takes the patient profile
2. Calls DeepSeek to generate PICOS (reuse existing prompt from picos_translator.ts but improve it)
3. Adds `frozenAt` timestamp
4. Generates a hash of the PICOS content (simple MD5 or string hash) for immutability verification
5. Returns the frozen PICOSProtocol

The AI prompt must generate:
- PICOS fields
- 10+ keywords
- Optimized search queries per database (pubmed with MeSH, semantic with natural language, general)
- Study design preference order

### Checklist before moving to Phase 2:
- [ ] coordinator.ts exports `createSearchProtocol`
- [ ] Returns a PICOSProtocol with frozenAt and hash
- [ ] Old picos_translator.ts is deleted
- [ ] `npm run build` passes

---

## PHASE 2: Agent 1 — Searcher
**Goal:** Refactor existing search into Agent 1 with proper logging and coverage tracking.

### Files to modify:
- `src/lib/agents/agent1_searcher.ts` — NEW FILE (move logic from `src/lib/search/index.ts`)
- `src/lib/search/index.ts` — DELETE after migration
- Keep ALL individual search clients (pubmed.ts, semantic_scholar.ts, etc.) unchanged

### What to build:

Function `runSearch(protocol: PICOSProtocol): Promise<Agent1Result>`:
1. Run all 7 database searches in parallel using `Promise.allSettled`
2. Track which databases responded and which failed/timed out
3. Generate warnings for any failed database: "PubMed returned results. SciELO timed out."
4. Deduplicate using existing `deduplication.ts` (DOI first, then title similarity)
5. Strip papers down to essential fields before returning (title, authors, year, journal, abstractText, doi, pmid, url, openAccessUrl, source) — do NOT pass unnecessary metadata downstream
6. Return: papers array, stats (total, bySource, deduplicatedCount), warnings array

### Checklist before moving to Phase 3:
- [ ] agent1_searcher.ts exports `runSearch`
- [ ] All 7 database clients are called
- [ ] Failed databases generate warnings (not silent failures)
- [ ] Stats include per-source counts
- [ ] `npm run build` passes

---

## PHASE 3: Agent 2 — Screener (PRISMA)
**Goal:** Build 3-level PRISMA screening with sensitivity pass.

### Files to create:
- `src/lib/agents/agent2_screener.ts` — NEW FILE

### What to build:

Function `screenPapers(papers: Paper[], protocol: PICOSProtocol, patient: PatientProfile): Promise<Agent2Result>`:

**Level 1 — Title/Abstract screening (batched, 8 papers per AI call):**
- Send batches of 8 papers (title + first 300 chars of abstract) to AI
- AI scores each as 'include' | 'exclude' | 'borderline' with reason and confidence (0-1)
- Exclude papers with score < 0.3
- Keep 'include' and 'borderline' for Level 2

AI prompt for Level 1:
```
You are a systematic review screener. Evaluate these papers against PICOS criteria.
PICOS: P={population} I={intervention} C={comparison} O={outcome} S={studyDesign}

For each paper, decide: include (directly relevant), exclude (clearly not relevant), 
or borderline (partially relevant or unclear).

Return JSON array: [{ "paperId": "...", "decision": "include|exclude|borderline", 
"reason": "1 sentence", "confidence": 0.0-1.0 }]
```

**Level 2 — Deep evaluation (individual, full abstract):**
- Send each remaining paper (full title + full abstract) individually
- AI evaluates against all PICOS criteria in detail
- Score: include (≥0.6) or exclude (<0.6) with detailed reason

**Level 3 — Sensitivity pass (for excluded borderlines):**
- Take papers excluded in Level 1 that had confidence between 0.3-0.5
- Re-evaluate with INVERTED prompt: "Argue why this paper SHOULD be included despite initial exclusion"
- If the inverted argument is strong (confidence ≥ 0.7), recover the paper and flag it as "sensitivity_recovered"

**Simulated dual-reviewer (runs on Level 2 results):**
- Run Level 2 a second time with a slightly different system prompt
- Compare decisions between Pass A and Pass B
- Calculate simulated Cohen's Kappa
- For disagreements: include the paper (conservative approach) and flag it
- Add disclaimer: "Kappa is simulated using same AI model — not equivalent to independent human reviewers"

**Build PRISMAFlow data:**
- Count papers at each stage
- Categorize exclusion reasons into groups (population mismatch, wrong intervention, wrong study type, etc.)

### Checklist before moving to Phase 4:
- [ ] 3 screening levels work correctly
- [ ] Sensitivity pass recovers borderline papers
- [ ] Simulated Kappa is calculated with disclaimer
- [ ] PRISMAFlow data structure is complete with counts and reasons
- [ ] Batching works (8 papers per call for Level 1)
- [ ] `npm run build` passes

---

## PHASE 4: Agent 3a (Quality) + Agent 3b (Extractor) — Parallel
**Goal:** Build quality assessment and data extraction as two separate agents that run in parallel.

### Files to create:
- `src/lib/agents/agent3a_quality.ts` — NEW FILE
- `src/lib/agents/agent3b_extractor.ts` — NEW FILE

### Agent 3a — Quality Assessor

Function `assessQuality(papers: Paper[], protocol: PICOSProtocol): Promise<QualityAssessment[]>`:

For each included paper, AI evaluates:

**Cochrane Risk of Bias (6 domains):**
- Random sequence generation
- Allocation concealment
- Blinding of participants/personnel
- Blinding of outcome assessment
- Incomplete outcome data
- Selective reporting

Each domain rated: `low` | `high` | `unclear` | `cannot_assess`
Each rating MUST include a justification citing what was (or wasn't) in the abstract.

CRITICAL: When information is not available in the abstract, the rating MUST be `cannot_assess`, NOT `unclear`. `unclear` means the info is present but ambiguous. `cannot_assess` means the info is simply not there.

**PEDro Scale (for physiotherapy/exercise studies):**
Score 0-10 on the standard PEDro items. Items that cannot be determined from abstract get `cannot_assess` (not 0).

**Oxford CEBM Level:**
Based on study design: 1a (SR of RCTs), 1b (individual RCT), 2a (SR of cohort), 2b (cohort), etc.

**Calculate cannotAssessPercentage:**
Count domains rated `cannot_assess` / total domains. This is a key confidence indicator.

AI prompt must include:
```
CRITICAL RULES:
1. If the abstract does not mention randomization method, rate as "cannot_assess" not "unclear"
2. If blinding is not mentioned, rate as "cannot_assess" not "low" or "high"
3. Always include a justification with a quote from the abstract or "Not mentioned in abstract"
4. Be conservative — when in doubt, use "cannot_assess"
```

### Agent 3b — Data Extractor

Function `extractData(papers: Paper[], protocol: PICOSProtocol): Promise<ExtractedData[]>`:

For each paper, extract quantitative data from the abstract:

Every extracted value MUST have:
- `value`: the number
- `confidence`: `extracted` (literally stated in abstract) | `derived` (calculated from other stated values) | `not_reported` (not in abstract)
- Source quote: the exact text from the abstract that this number came from

Data points to extract:
- Sample size (total and per group if available)
- Mean values for primary outcomes (pre/post or between groups)
- Standard deviations
- Effect size (if reported — type: SMD, Hedges' g, Cohen's d, OR, RR)
- 95% confidence intervals
- p-values
- Outcomes measured (list of outcome names)

AI prompt must include:
```
CRITICAL RULES:
1. ONLY extract values that are literally stated in or directly calculable from the abstract
2. If a value is not mentioned, set confidence to "not_reported" — NEVER guess or estimate
3. For every extracted value, provide the exact quote from the abstract
4. If the abstract says "significant difference (p<0.05)" but no exact p, 
   extract p=0.05 with confidence "derived" and quote the text
5. Prefer reporting "not_reported" over guessing — accuracy is more important than completeness
```

### Both agents run in parallel:
```typescript
const [qualityResults, extractedData] = await Promise.all([
  assessQuality(includedPapers, protocol),
  extractData(includedPapers, protocol),
])
```

### Checklist before moving to Phase 5:
- [ ] Agent 3a produces QualityAssessment with all Cochrane domains
- [ ] Agent 3a uses `cannot_assess` appropriately (not forcing judgments)
- [ ] cannotAssessPercentage is calculated correctly
- [ ] Agent 3b extracts data with confidence tags on every value
- [ ] Agent 3b includes sourceQuotes for every extracted value
- [ ] Both agents run in parallel (Promise.all)
- [ ] `npm run build` passes

---

## PHASE 5: Agent 4 — Statistical Analyst
**Goal:** Compute meta-analytic statistics from extracted data. Skip papers with insufficient data.

### Files to create:
- `src/lib/agents/agent4_analyst.ts` — NEW FILE
- `src/lib/stats/meta_analysis.ts` — NEW FILE (pure math, no AI)
- `src/lib/stats/forest_plot.ts` — NEW FILE (generates SVG data)

### What to build:

**meta_analysis.ts — Pure statistical functions (NO AI calls):**

```typescript
// These are deterministic calculations, not AI-generated:

// 1. calculateEffectSize(mean1, sd1, n1, mean2, sd2, n2): SMD with 95% CI
//    Use Hedges' g (corrected SMD) formula

// 2. randomEffectsModel(effects: {es, variance, weight}[]): PooledResult
//    DerSimonian-Laird random effects estimator
//    Returns: pooled effect, 95% CI, p-value

// 3. heterogeneityTests(effects): { Q, df, pValue, iSquared, interpretation }
//    Cochran's Q statistic
//    I² = max(0, (Q - df) / Q * 100)
//    Interpretation: <25% very low, 25-50% low, 50-75% moderate, >75% high

// 4. failSafeN(effects, targetAlpha): number
//    Orwin's fail-safe N: how many null-result studies needed to make
//    the pooled effect non-significant

// NOTE: Do NOT implement Egger's test or funnel plot.
// These require accurate SEs which we don't have from abstract-only data.
// Always output: "Publication bias not assessed — requires full-text data extraction"
```

**agent4_analyst.ts — Orchestrates the analysis:**

Function `analyzeEvidence(extractedData: ExtractedData[], qualityAssessments: QualityAssessment[]): Promise<StatisticalResult>`:

1. Filter: only include papers where effect size has confidence = `extracted` or `derived` (NOT `not_reported`)
2. If fewer than 3 papers have sufficient data:
   - Skip pooled meta-analysis
   - Return narrative: "Insufficient quantitative data for meta-analysis (N of M studies reported effect sizes)"
   - Still provide individual study effect sizes in forest plot format
3. If 3+ papers have data:
   - Calculate pooled effect using random effects model
   - Run heterogeneity tests
   - Calculate fail-safe N
   - Generate forest plot data
   - Run moderator analysis if coded variables exist
4. Generate red flags automatically:
   - "Fewer than 5 studies in meta-analysis" if n < 5
   - "High heterogeneity (I² > 75%)" if applicable
   - "X of Y studies had insufficient data for quantitative analysis"
   - "Quality assessment limited by abstract-only evaluation"
5. Add limitations array (always include):
   - "Effect sizes estimated from abstracts, not full-text data extraction"
   - "Standard errors may be imprecise"
   - "Publication bias not formally assessed"

**forest_plot.ts — SVG generation for forest plot:**

Generate an SVG string representing a forest plot:
- Each row: study name, year, effect size diamond, CI line, weight
- Bottom row: pooled effect diamond (wider)
- Vertical line at 0 (null effect)
- Use simple SVG — no charting library needed for MVP
- Return as string (will be rendered as `dangerouslySetInnerHTML` or as data URI image)

### Checklist before moving to Phase 6:
- [ ] meta_analysis.ts has all 4 statistical functions with correct formulas
- [ ] Papers with `not_reported` effect sizes are excluded from pooling
- [ ] Handles <3 papers gracefully (no pooled analysis, narrative instead)
- [ ] Red flags auto-generate correctly
- [ ] Forest plot SVG renders correctly
- [ ] No funnel plot or Egger's test (deliberately omitted)
- [ ] `npm run build` passes

---

## PHASE 6: Agent 5 — Synthesizer
**Goal:** Generate the final clinical evidence synthesis using GRADE framework.

### Files to create:
- `src/lib/agents/agent5_synthesizer.ts` — NEW FILE

### What to build:

Function `synthesizeEvidence(fullResult: Omit<FullSearchResult, 'agent5Result'>): Promise<EvidenceSynthesis>`:

This agent receives the STRUCTURED outputs from all previous agents (NOT raw papers/abstracts). Specifically it receives:
- protocol (PICOS)
- patientProfile
- agent1Result.stats (search counts)
- agent2Result.prismaFlow (PRISMA numbers)
- agent3aResult.qualityAssessments (quality table summary)
- agent3bResult (extraction completeness summary)
- agent4Result.statisticalResult (stats + forest plot)

**Section 1 — General Summary (AI-generated):**
Prompt asks AI to write 2-3 paragraphs covering:
- What was searched (databases, terms)
- How many found, how many included, key exclusion reasons
- Contrast: how many from peer-reviewed vs grey literature (preprints, trials)
- Overall quality of included evidence

**Section 2 — Specific Summary (AI-generated):**
Prompt asks AI to write 2-3 paragraphs covering:
- Direction and magnitude of the effect
- Heterogeneity interpretation
- Which subgroups or moderators matter
- What the numbers mean clinically (not just statistically)

**Section 3 — Clinical Recommendation (AI-generated):**
Prompt asks AI to write 1-2 paragraphs:
- For THIS specific patient (age, condition, failed treatments)
- What intervention has the best evidence
- Direction + magnitude ONLY (no dosage or specific protocols)
- Every claim must cite [Paper ID] inline
- Consider failed treatments when making recommendation

**GRADE Rating (AI-generated with rules):**
AI assigns GRADE considering:
- Study designs (RCTs = starts high, observational = starts low)
- Risk of bias (from 3a) → downgrade if high
- Inconsistency (I² from Agent 4) → downgrade if high
- Indirectness (population match) → downgrade if poor
- Imprecision (wide CIs) → downgrade if imprecise
- AUTOMATIC DOWNGRADE by 1 level because abstract-only analysis

**Red Flags (auto-generated, not AI):**
Check programmatically:
- `includedStudies < 3` → "Very few studies — interpret with extreme caution"
- `iSquared > 75` → "High inconsistency between studies"
- `cannotAssessPercentage > 50` (avg across studies) → "Quality assessment severely limited by abstract-only evaluation"
- `extractionCompleteness < 50%` → "Majority of studies lacked quantitative data in abstracts"

**Disclaimer (hardcoded, ALWAYS present):**
"This is an AI-assisted clinical evidence scoping tool based on abstract-level analysis. It is NOT a published systematic review and does NOT replace clinical judgment. Statistical estimates are derived from abstracts and carry additional uncertainty compared to full-text data extraction. Always verify key findings against original sources before making clinical decisions."

### Checklist before moving to Phase 7:
- [ ] All 3 summary sections are generated
- [ ] GRADE rating is assigned with justification
- [ ] Automatic 1-level GRADE downgrade for abstract-only
- [ ] Red flags fire correctly based on thresholds
- [ ] Disclaimer is hardcoded and always present
- [ ] AI citations use paper IDs inline
- [ ] Agent receives STRUCTURED data, not raw abstracts
- [ ] `npm run build` passes

---

## PHASE 7: Pipeline Orchestrator + API Route
**Goal:** Wire all agents together with audit logging and the streaming status updates.

### Files to modify:
- `src/app/api/search/route.ts` — REWRITE
- `src/lib/agents/orchestrator.ts` — NEW FILE

### What to build:

**orchestrator.ts:**

Function `runPipeline(patient: PatientProfile): Promise<FullSearchResult>`:

```typescript
// Pseudocode:
const auditLog = new AuditLog()

// Step 1: Create protocol
auditLog.start('coordinator')
const protocol = await createSearchProtocol(patient)
auditLog.complete('coordinator', { picos: protocol })

// Step 2: Search
auditLog.start('agent1_searcher')
const searchResult = await runSearch(protocol)
auditLog.complete('agent1_searcher', { 
  found: searchResult.stats.total, 
  deduped: searchResult.stats.deduplicatedCount,
  warnings: searchResult.warnings 
})

// Step 3: Screen
auditLog.start('agent2_screener')
const screenResult = await screenPapers(searchResult.papers, protocol, patient)
auditLog.complete('agent2_screener', { 
  included: screenResult.includedPapers.length,
  prisma: screenResult.prismaFlow 
})

// Step 4: Quality + Extract (PARALLEL)
auditLog.start('agent3a_quality')
auditLog.start('agent3b_extractor')
const [qualityResult, extractionResult] = await Promise.all([
  assessQuality(screenResult.includedPapers, protocol),
  extractData(screenResult.includedPapers, protocol),
])
auditLog.complete('agent3a_quality', { assessed: qualityResult.length })
auditLog.complete('agent3b_extractor', { extracted: extractionResult.length })

// Step 5: Statistical analysis
auditLog.start('agent4_analyst')
const statsResult = await analyzeEvidence(extractionResult, qualityResult)
auditLog.complete('agent4_analyst', { 
  pooled: statsResult.pooledEffect,
  studiesInMeta: statsResult.studiesIncludedInMeta 
})

// Step 6: Synthesis
auditLog.start('agent5_synthesizer')
const synthesis = await synthesizeEvidence({ patient, protocol, ...allPreviousResults })
auditLog.complete('agent5_synthesizer', { grade: synthesis.gradeRating })

return fullResult
```

**AuditLog class:**
Simple class that tracks: agent name, start time, end time, input summary, output summary, warnings. Serializable to JSON.

**route.ts:**
- Accept POST with PatientProfile
- Call `runPipeline`
- Return FullSearchResult as JSON
- Handle errors gracefully (if any agent fails, return partial results with error info)

### Checklist before moving to Phase 8:
- [ ] All agents are called in correct sequence
- [ ] Agent 3a and 3b run in parallel
- [ ] AuditLog captures every step with timing
- [ ] Partial results returned on error (not full crash)
- [ ] `npm run build` passes

---

## PHASE 8: Updated UI
**Goal:** Rebuild the results dashboard to show the full pipeline output.

### Files to modify:
- `src/components/SearchStatus.tsx` — UPDATE (new stages)
- `src/components/ResultsDashboard.tsx` — REWRITE
- `src/components/PaperCard.tsx` — UPDATE
- `src/app/page.tsx` — UPDATE

### New UI tabs:

**Tab 1: "Synthesis / Síntesis"**
- Banner disclaimer (always visible, red/orange)
- GRADE badge (High=green, Moderate=yellow, Low=orange, Very Low=red)
- Red flags section (if any)
- General summary text
- Specific summary text
- Clinical recommendation with inline citations
- Expandable: GRADE justification

**Tab 2: "PRISMA Flow"**
- Visual PRISMA flowchart (can be simple HTML/CSS boxes with arrows)
- Numbers at each stage
- Exclusion reasons grouped
- Simulated Kappa with disclaimer
- Sensitivity pass results

**Tab 3: "Quality / Calidad"**
- Quality assessment table (papers as rows, Cochrane domains as columns)
- Color coded: green=low risk, red=high risk, gray=cannot assess, yellow=unclear
- PEDro scores column
- Oxford level column
- Average cannotAssessPercentage displayed prominently

**Tab 4: "Statistics / Estadísticas"**
- Forest plot SVG (or "Insufficient data" message)
- Pooled effect with CI and p-value
- Heterogeneity stats (Q, I², interpretation)
- Fail-safe N
- Note: "Publication bias not assessed — requires full-text data"
- Moderator analysis table (if available)

**Tab 5: "Top Papers"**
- Paper cards with quality badge + extraction status
- Each card shows: title, authors, year, source, relevance reason, 
  quality summary (PEDro score, RoB traffic light), expandable extracted data

**Tab 6: "Audit Trail"**
- Step-by-step pipeline log
- Each step: agent name, duration, input summary, output summary
- Warnings highlighted in yellow
- "Why this result?" explanation for each step

**Tab 7: "All Papers (N)"**
- Full list, including excluded ones
- Filter by: included/excluded, source, year
- Each excluded paper shows reason for exclusion

### SearchStatus update:
Add new stages: protocol → searching → screening → quality → extracting → analyzing → synthesizing

### Checklist before final review:
- [ ] All 7 tabs render correctly
- [ ] Disclaimer banner always visible
- [ ] GRADE badge shows correct color
- [ ] Red flags display when thresholds are met
- [ ] Forest plot SVG renders in the statistics tab
- [ ] PRISMA flow shows correct counts
- [ ] Quality table color-codes correctly
- [ ] Audit trail shows all steps with timing
- [ ] SearchStatus shows all 7 pipeline stages
- [ ] `npm run build` passes
- [ ] Test with a real patient search end-to-end

---

## PHASE 9: Final Integration Test
**Goal:** Run a complete end-to-end search and verify all agents work together.

### Test case:
```
Patient: Male, 30 years, recreational football, bilateral patellar tendinopathy, 
6 months duration, failed 8 weeks eccentric (Alfredson protocol)
Clinical area: physiotherapy
```

### Verify:
1. PICOS generated correctly and frozen
2. Search returns results from multiple databases
3. PRISMA screening reduces papers with reasons
4. Quality assessment uses "cannot_assess" where appropriate
5. Data extraction includes source quotes
6. Statistical analysis handles insufficient data gracefully
7. Forest plot renders
8. GRADE rating includes automatic 1-level downgrade
9. Red flags fire if thresholds met
10. Synthesis cites paper IDs
11. Audit trail complete
12. Total pipeline runs in reasonable time (under 2 minutes)

---

## WHAT NOT TO CHANGE

Keep these files exactly as they are:
- `src/lib/ai/deepseek.ts` — AI API client
- `src/lib/ai/parse.ts` — JSON cleanup parser
- `src/lib/search/pubmed.ts` — PubMed client
- `src/lib/search/semantic_scholar.ts` — Semantic Scholar client
- `src/lib/search/openalex.ts` — OpenAlex client
- `src/lib/search/europe_pmc.ts` — Europe PMC client
- `src/lib/search/scielo.ts` — SciELO client
- `src/lib/search/clinical_trials.ts` — ClinicalTrials client
- `src/lib/search/biorxiv.ts` — medRxiv client
- `src/lib/search/deduplication.ts` — Deduplication logic
- `src/components/ui/*` — shadcn components
- `src/components/PatientForm.tsx` — Patient form (only add id field to profile)
- `.env.local` — Environment variables
