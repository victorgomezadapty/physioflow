import { randomUUID } from "crypto"
import type {
  PatientProfile,
  FullSearchResult,
  PipelineAuditLog,
  AuditStep,
} from "@/types"
import { createSearchProtocol } from "./coordinator"
import { runSearch } from "./agent1_searcher"
import { screenPapers } from "./agent2_screener"
import { assessQuality } from "./agent3a_quality"
import { extractData } from "./agent3b_extractor"
import { analyzeEvidence } from "./agent4_analyst"
import { synthesizeEvidence } from "./agent5_synthesizer"

// ---------------------------------------------------------------------------
// AuditLog — tracks every agent step for transparency
// ---------------------------------------------------------------------------
class AuditLog {
  private steps: AuditStep[] = []
  private current: Partial<AuditStep> | null = null

  start(agent: string, inputSummary = ""): void {
    this.current = {
      agent,
      startedAt: new Date().toISOString(),
      inputSummary,
      warnings: [],
    }
  }

  complete(outputSummary: string, warnings: string[] = []): void {
    if (!this.current) return
    const completedAt = new Date().toISOString()
    const start = new Date(this.current.startedAt!).getTime()
    const end = new Date(completedAt).getTime()

    this.steps.push({
      agent: this.current.agent!,
      startedAt: this.current.startedAt!,
      completedAt,
      durationMs: end - start,
      inputSummary: this.current.inputSummary ?? "",
      outputSummary,
      warnings,
    })
    this.current = null
  }

  toLog(): PipelineAuditLog {
    return { steps: this.steps }
  }
}

// ---------------------------------------------------------------------------
// runPipeline — main orchestrator
// Executes all 6 agents in sequence (3a + 3b in parallel)
// Returns FullSearchResult — partial results on agent failure
// ---------------------------------------------------------------------------
export async function runPipeline(patient: PatientProfile): Promise<FullSearchResult> {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const audit = new AuditLog()

  // Ensure patient has an id
  if (!patient.id) patient.id = randomUUID()

  // ── Step 1: Coordinator — generate + freeze PICOS protocol ──
  audit.start("coordinator", `Patient: ${patient.age}yo ${patient.sex}, ${patient.condition}`)
  const protocol = await createSearchProtocol(patient)
  audit.complete(
    `Protocol frozen. Hash: ${protocol.hash}. Keywords: ${protocol.keywords.length}. ` +
    `PubMed query: ${protocol.searchQueries.pubmed.slice(0, 80)}...`
  )

  // ── Step 2: Agent 1 — Search ──
  audit.start("agent1_searcher", `PICOS hash: ${protocol.hash}`)
  const agent1Result = await runSearch(protocol)
  audit.complete(
    `Found ${agent1Result.stats.total} papers across ${agent1Result.stats.databasesSucceeded}/${agent1Result.stats.databasesCalled} databases. ` +
    `After dedup: ${agent1Result.stats.deduplicatedCount}.`,
    agent1Result.warnings
  )

  // ── Step 3: Agent 2 — PRISMA Screening ──
  audit.start(
    "agent2_screener",
    `${agent1Result.stats.deduplicatedCount} papers to screen`
  )
  const agent2Result = await screenPapers(agent1Result.papers, protocol, patient)
  audit.complete(
    `PRISMA: ${agent1Result.stats.deduplicatedCount} → ${agent2Result.prismaFlow.finalIncluded} included. ` +
    `Simulated Kappa: ${agent2Result.prismaFlow.simulatedKappa}. ` +
    `Sensitivity recovered: ${agent2Result.prismaFlow.sensitivityRecovered}.`
  )

  // ── Step 4: Agents 3a + 3b — Quality + Extraction (PARALLEL) ──
  audit.start(
    "agent3a_quality + agent3b_extractor",
    `${agent2Result.includedPapers.length} included papers`
  )
  const [agent3aResult, agent3bResult] = await Promise.all([
    assessQuality(agent2Result.includedPapers, protocol),
    extractData(agent2Result.includedPapers, protocol),
  ])
  audit.complete(
    `Quality: ${agent3aResult.qualityAssessments.length} papers assessed. ` +
    `Extraction completeness: ${agent3bResult.extractionCompleteness}%. ` +
    `Papers with effect data: ${agent3bResult.extractedData.filter((d) => d.effectSize?.confidence !== "not_reported").length}.`
  )

  // ── Step 5: Agent 4 — Statistical Analysis ──
  audit.start(
    "agent4_analyst",
    `${agent3bResult.extractedData.length} papers for statistical analysis`
  )
  const agent4Result = await analyzeEvidence(agent3bResult.extractedData, agent3aResult.qualityAssessments)
  const stats = agent4Result.statisticalResult
  audit.complete(
    stats.pooledEffect
      ? `Pooled effect: ${stats.pooledEffect.value} (95% CI: ${stats.pooledEffect.ci95[0]} to ${stats.pooledEffect.ci95[1]}). I²=${stats.heterogeneity?.iSquared}%.`
      : `Insufficient data for pooled analysis. Studies in meta: ${stats.studiesIncludedInMeta}.`,
    stats.redFlags
  )

  // ── Step 6: Agent 5 — Synthesis ──
  audit.start(
    "agent5_synthesizer",
    `${agent2Result.includedPapers.length} papers for synthesis`
  )
  const agent5Result = await synthesizeEvidence(
    patient,
    protocol,
    agent1Result,
    agent2Result,
    agent3aResult,
    agent3bResult,
    agent4Result
  )
  audit.complete(
    `GRADE: ${agent5Result.synthesis.gradeRating}. ` +
    `Red flags: ${agent5Result.synthesis.redFlags.length}.`
  )

  return {
    id,
    createdAt,
    patientProfile: patient,
    protocol,
    agent1Result,
    agent2Result,
    agent3aResult,
    agent3bResult,
    agent4Result,
    agent5Result,
    auditLog: audit.toLog(),
  }
}
