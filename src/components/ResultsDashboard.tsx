"use client"

import { useState } from "react"
import type { FullSearchResult, GradeRating, RoBRating } from "@/types"
import { PaperCard } from "./PaperCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const GRADE_CONFIG: Record<GradeRating, { label: string; bg: string; text: string; border: string }> = {
  high:      { label: "High",      bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300" },
  moderate:  { label: "Moderate",  bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  low:       { label: "Low",       bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  very_low:  { label: "Very Low",  bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300" },
}

const ROB_DOT: Record<RoBRating, string> = {
  low:           "bg-green-500",
  high:          "bg-red-500",
  unclear:       "bg-yellow-400",
  cannot_assess: "bg-gray-300",
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
interface Props { result: FullSearchResult }

export function ResultsDashboard({ result }: Props) {
  const { patientProfile, protocol, agent1Result, agent2Result, agent3aResult, agent3bResult, agent4Result, agent5Result, auditLog } = result
  const synthesis = agent5Result.synthesis
  const stats = agent4Result.statisticalResult
  const prisma = agent2Result.prismaFlow
  const grade = GRADE_CONFIG[synthesis.gradeRating]

  const qualityMap = Object.fromEntries(agent3aResult.qualityAssessments.map((q) => [q.paperId, q]))
  const extractionMap = Object.fromEntries(agent3bResult.extractedData.map((d) => [d.paperId, d]))
  const screeningMap = Object.fromEntries(
    agent2Result.screeningDecisions
      .filter((d) => d.decision === "include")
      .map((d) => [d.paperId, d.reason])
  )
  // Deduplicate excluded decisions by paperId (keep last/deepest level decision)
  const excludedDecisions = [
    ...new Map(
      agent2Result.screeningDecisions
        .filter((d) => d.decision === "exclude")
        .map((d) => [d.paperId, d])
    ).values(),
  ]

  return (
    <div className="space-y-4">
      {/* ── Disclaimer banner — always visible ── */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex gap-3">
        <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
        <p className="text-xs text-amber-800 leading-relaxed">{synthesis.disclaimer}</p>
      </div>

      {/* ── Summary stats bar ── */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="text-center py-3">
          <p className="text-xl font-bold text-blue-600">{agent1Result.stats.total}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Papers identified</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xl font-bold text-indigo-600">{agent1Result.stats.deduplicatedCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">After deduplication</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xl font-bold text-green-600">{prisma.finalIncluded}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Included</p>
        </Card>
        <Card className={`text-center py-3 border-2 ${grade.border}`}>
          <p className={`text-sm font-bold ${grade.text}`}>GRADE</p>
          <p className={`text-base font-bold ${grade.text}`}>{grade.label}</p>
        </Card>
      </div>

      {/* ── Red flags ── */}
      {synthesis.redFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-red-700 mb-1">⚑ Interpretation warnings</p>
          {synthesis.redFlags.map((flag, i) => (
            <p key={i} className="text-xs text-red-600">• {flag}</p>
          ))}
        </div>
      )}

      {/* ── 7 Tabs ── */}
      <Tabs defaultValue="synthesis">
        <TabsList className="w-full flex-wrap h-auto gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { value: "synthesis",  label: "Synthesis" },
            { value: "prisma",     label: "PRISMA" },
            { value: "quality",    label: "Quality" },
            { value: "statistics", label: "Statistics" },
            { value: "papers",     label: `Top Papers (${agent2Result.includedPapers.length})` },
            { value: "audit",      label: "Audit Trail" },
            { value: "all",        label: `All (${agent1Result.stats.deduplicatedCount})` },
          ].map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="text-xs flex-1 min-w-[80px]">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ══ TAB 1: SYNTHESIS ══ */}
        <TabsContent value="synthesis" className="mt-4 space-y-4">
          {/* Patient context */}
          <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
            Patient: {patientProfile.age}yo {patientProfile.sex} · {patientProfile.condition}
            {patientProfile.symptomDuration ? ` · ${patientProfile.symptomDuration}` : ""}
            {patientProfile.failedTreatments ? ` · Failed: ${patientProfile.failedTreatments}` : ""}
          </div>

          {/* GRADE badge */}
          <div className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${grade.bg} border ${grade.border}`}>
            <span className={`text-sm font-bold ${grade.text}`}>GRADE: {grade.label}</span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">General Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{synthesis.generalSummary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Statistical Evidence Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{synthesis.specificSummary}</p>
            </CardContent>
          </Card>

          <Card className={`border-2 ${grade.border}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                Clinical Recommendation
                <span className={`text-xs font-normal px-2 py-0.5 rounded ${grade.bg} ${grade.text}`}>{grade.label} evidence</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{synthesis.clinicalRecommendation}</p>
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700 font-medium">GRADE justification</summary>
                <p className="mt-2 leading-relaxed">{synthesis.gradeJustification}</p>
              </details>
            </CardContent>
          </Card>

          {/* PICOS protocol */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">Search protocol (frozen PICOS)</summary>
            <Card className="mt-2">
              <CardContent className="pt-3 space-y-2 text-xs">
                {[
                  { l: "P — Population", v: protocol.population },
                  { l: "I — Intervention", v: protocol.intervention },
                  { l: "C — Comparison", v: protocol.comparison },
                  { l: "O — Outcome", v: protocol.outcome },
                  { l: "S — Study design", v: protocol.studyDesign },
                ].map(({ l, v }) => (
                  <div key={l}>
                    <span className="font-semibold text-gray-600">{l}: </span>
                    <span className="text-gray-500">{v}</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1 pt-1">
                  {protocol.keywords.map((kw) => (
                    <span key={kw} className="bg-blue-50 text-blue-600 rounded px-2 py-0.5">{kw}</span>
                  ))}
                </div>
                <p className="text-gray-400">Protocol hash: {protocol.hash} · Frozen: {new Date(protocol.frozenAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          </details>
        </TabsContent>

        {/* ══ TAB 2: PRISMA FLOW ══ */}
        <TabsContent value="prisma" className="mt-4 space-y-4">
          {/* PRISMA flowchart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">PRISMA Flow Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-0 text-xs">
                <PRISMABox label="Identified" count={prisma.identified} color="blue" sub={`Databases: ${Object.keys(prisma.bySource).join(", ")}`} />
                <PRISMAArrow />
                <PRISMABox label="After deduplication" count={prisma.afterDedup} color="blue" />
                <PRISMAArrow />
                <div className="flex gap-4 w-full justify-center">
                  <div className="flex flex-col items-center">
                    <PRISMABox label="Screened (title/abstract)" count={prisma.screenedTitleAbstract} color="blue" />
                    <PRISMAArrow />
                    <PRISMABox label="Passed to full eval" count={prisma.screenedFullEval} color="blue" />
                    <PRISMAArrow />
                    <PRISMABox label="Included for quality" count={prisma.includedForQuality} color="green"
                      sub={`+${prisma.sensitivityRecovered} sensitivity-recovered`} />
                  </div>
                  <div className="flex flex-col gap-3 justify-start pt-8">
                    <PRISMABox label="Excluded (L1)" count={prisma.excludedTitleAbstract} color="red"
                      sub={prisma.excludedTitleAbstractReasons.map((r) => `${r.reason}: ${r.count}`).join(" · ")} />
                    <PRISMABox label="Excluded (L2)" count={prisma.excludedFullEval} color="red"
                      sub={prisma.excludedFullEvalReasons.map((r) => `${r.reason}: ${r.count}`).join(" · ")} />
                  </div>
                </div>
              </div>

              {/* Kappa */}
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
                <p className="font-medium text-yellow-800">Simulated dual-reviewer agreement: κ = {prisma.simulatedKappa}</p>
                <p className="text-yellow-700 mt-0.5">{prisma.kappaDisclaimer}</p>
              </div>
            </CardContent>
          </Card>

          {/* Source breakdown */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Results by Source</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(agent1Result.stats.bySource)
                  .filter(([, n]) => n > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([src, count]) => (
                    <div key={src} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 w-36 truncate">{src}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-400 h-2 rounded-full"
                          style={{ width: `${(count / agent1Result.stats.total) * 100}%` }} />
                      </div>
                      <span className="text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB 3: QUALITY ══ */}
        <TabsContent value="quality" className="mt-4 space-y-4">
          {agent3aResult.qualityAssessments.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No quality assessments available.</p>
          ) : (
            <>
              {/* Average cannot-assess warning */}
              {(() => {
                const avg = Math.round(
                  agent3aResult.qualityAssessments.reduce((s, q) => s + q.cannotAssessPercentage, 0) /
                    agent3aResult.qualityAssessments.length
                )
                return avg > 40 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-700">
                    Average {avg}% of quality domains could not be assessed from abstracts alone.
                    Full-text access would substantially improve quality assessment reliability.
                  </div>
                ) : null
              })()}

              {/* Quality table */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Cochrane Risk of Bias Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 pr-3 font-medium text-gray-600 min-w-[120px]">Study</th>
                          {["Seq. gen.", "Alloc. conc.", "Blind. part.", "Blind. assess.", "Incomp. data", "Sel. report"].map((h) => (
                            <th key={h} className="text-center py-1 px-1 font-medium text-gray-600 min-w-[60px]">{h}</th>
                          ))}
                          <th className="text-center py-1 px-1 font-medium text-gray-600">PEDro</th>
                          <th className="text-center py-1 px-1 font-medium text-gray-600">Oxford</th>
                          <th className="text-center py-1 px-1 font-medium text-gray-600">N/A%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agent3aResult.qualityAssessments.map((qa) => {
                          const paper = agent2Result.includedPapers.find((p) => p.id === qa.paperId)
                          return (
                            <tr key={qa.paperId} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-1.5 pr-3 text-gray-700 max-w-[150px]">
                                <span className="truncate block" title={paper?.title}>
                                  {paper ? `${paper.authors[0]?.split(" ").pop() ?? ""} ${paper.year ?? ""}` : qa.paperId.slice(0, 12)}
                                </span>
                              </td>
                              {qa.cochraneRoB.map((d) => (
                                <td key={d.domain} className="text-center py-1.5 px-1">
                                  <span className="inline-flex items-center justify-center" title={`${d.rating}: ${d.justification}`}>
                                    <span className={`w-4 h-4 rounded-full inline-block ${ROB_DOT[d.rating]}`} />
                                  </span>
                                </td>
                              ))}
                              <td className="text-center py-1.5 px-1 text-gray-600">
                                {qa.pedroScore ? `${qa.pedroScore.total}/10` : "—"}
                              </td>
                              <td className="text-center py-1.5 px-1 text-gray-600">{qa.oxfordLevel}</td>
                              <td className={`text-center py-1.5 px-1 font-medium ${qa.cannotAssessPercentage > 50 ? "text-amber-600" : "text-gray-500"}`}>
                                {qa.cannotAssessPercentage}%
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    {[
                      { color: "bg-green-500", label: "Low risk" },
                      { color: "bg-red-500", label: "High risk" },
                      { color: "bg-yellow-400", label: "Unclear" },
                      { color: "bg-gray-300", label: "Cannot assess" },
                    ].map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1">
                        <span className={`w-3 h-3 rounded-full inline-block ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══ TAB 4: STATISTICS ══ */}
        <TabsContent value="statistics" className="mt-4 space-y-4">
          {/* Publication bias note — always shown */}
          <div className="bg-gray-50 border rounded p-3 text-xs text-gray-600 italic">
            {stats.publicationBiasNote}
          </div>

          {stats.insufficientDataNarrative ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Quantitative Analysis</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{stats.insufficientDataNarrative}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Pooled effect */}
              {stats.pooledEffect && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Pooled Effect (Random Effects)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xl font-bold text-blue-600">{stats.pooledEffect.value.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Hedges' g</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          [{stats.pooledEffect.ci95[0].toFixed(2)}, {stats.pooledEffect.ci95[1].toFixed(2)}]
                        </p>
                        <p className="text-xs text-gray-500">95% CI</p>
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${stats.pooledEffect.pValue < 0.05 ? "text-green-600" : "text-gray-500"}`}>
                          p = {stats.pooledEffect.pValue.toFixed(3)}
                        </p>
                        <p className="text-xs text-gray-500">p-value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Heterogeneity */}
              {stats.heterogeneity && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Heterogeneity</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      <div>
                        <p className="text-lg font-bold text-gray-700">{stats.heterogeneity.Q.toFixed(1)}</p>
                        <p className="text-gray-500">Cochran's Q</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-700">{stats.heterogeneity.df}</p>
                        <p className="text-gray-500">df</p>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${
                          stats.heterogeneity.iSquared > 75 ? "text-red-600"
                          : stats.heterogeneity.iSquared > 50 ? "text-amber-600"
                          : "text-green-600"
                        }`}>{stats.heterogeneity.iSquared}%</p>
                        <p className="text-gray-500">I²</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 capitalize">{stats.heterogeneity.interpretation.replace("_", " ")}</p>
                        <p className="text-gray-500">Interpretation</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Fail-safe N */}
          {stats.failSafeN !== undefined && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Orwin's Fail-Safe N</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-700">{stats.failSafeN}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Number of null-result studies that would reduce the pooled effect to a trivial level (d ≤ 0.2).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Forest plot */}
          {stats.forestPlotSvg ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Forest Plot
                  <span className="text-xs font-normal text-gray-500">({stats.studiesIncludedInMeta} studies)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: stats.forestPlotSvg }} />
                <p className="text-xs text-gray-400 mt-2 italic">
                  Effect sizes are estimates from abstract-level data. Squares = study effects, diamond = pooled estimate.
                </p>
              </CardContent>
            </Card>
          ) : stats.forestPlotData.length > 0 ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Individual Study Effects</CardTitle></CardHeader>
              <CardContent>
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-left py-1">Study</th>
                      <th className="text-center py-1">Effect size</th>
                      <th className="text-center py-1">95% CI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.forestPlotData.map((e) => (
                      <tr key={e.paperId} className="border-b last:border-0">
                        <td className="py-1 text-gray-700">{e.label}</td>
                        <td className="text-center py-1 font-medium">{e.effectSize.toFixed(2)}</td>
                        <td className="text-center py-1 text-gray-500">
                          [{e.ci95[0].toFixed(2)}, {e.ci95[1].toFixed(2)}]
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}

          {/* Limitations */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Statistical Limitations</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                {stats.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TAB 5: TOP PAPERS ══ */}
        <TabsContent value="papers" className="mt-4 space-y-3">
          {agent2Result.includedPapers.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No papers included in synthesis.</p>
          ) : (
            agent2Result.includedPapers.map((paper, i) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                rank={i + 1}
                quality={qualityMap[paper.id]}
                extraction={extractionMap[paper.id]}
                screeningReason={screeningMap[paper.id]}
              />
            ))
          )}
        </TabsContent>

        {/* ══ TAB 6: AUDIT TRAIL ══ */}
        <TabsContent value="audit" className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">
            Full transparency log — every agent step, timing, and decision.
          </p>
          {auditLog.steps.map((step, i) => (
            <Card key={i}>
              <CardHeader className="pb-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-800">
                    {i + 1}. {step.agent}
                  </CardTitle>
                  <span className="text-xs text-gray-400">{(step.durationMs / 1000).toFixed(1)}s</span>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div>
                  <span className="font-medium text-gray-600">Input: </span>
                  <span className="text-gray-500">{step.inputSummary}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Output: </span>
                  <span className="text-gray-700">{step.outputSummary}</span>
                </div>
                {step.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1.5">
                    {step.warnings.map((w, j) => (
                      <p key={j} className="text-yellow-700">⚠ {w}</p>
                    ))}
                  </div>
                )}
                <p className="text-gray-400">
                  {new Date(step.startedAt).toLocaleTimeString()} → {new Date(step.completedAt).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ══ TAB 7: ALL PAPERS ══ */}
        <TabsContent value="all" className="mt-4 space-y-2">
          <p className="text-xs text-gray-400">
            All {agent1Result.stats.deduplicatedCount} papers after deduplication.
            Included: {prisma.finalIncluded} · Excluded: {agent1Result.stats.deduplicatedCount - prisma.finalIncluded}
          </p>

          {/* Included */}
          <p className="text-xs font-semibold text-green-700 mt-3">✓ Included ({prisma.finalIncluded})</p>
          {agent2Result.includedPapers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              quality={qualityMap[paper.id]}
              extraction={extractionMap[paper.id]}
              screeningReason={screeningMap[paper.id]}
            />
          ))}

          {/* Excluded */}
          {excludedDecisions.length > 0 && (
            <>
              <p className="text-xs font-semibold text-red-600 mt-4">
                ✗ Excluded ({excludedDecisions.length})
              </p>
              {excludedDecisions.slice(0, 30).map((decision) => {
                const paper = agent1Result.papers.find((p) => p.id === decision.paperId)
                if (!paper) return null
                return (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    excluded
                    exclusionReason={decision.reason}
                  />
                )
              })}
              {excludedDecisions.length > 30 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  + {excludedDecisions.length - 30} more excluded papers
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PRISMA diagram sub-components
// ─────────────────────────────────────────────────────────
function PRISMABox({ label, count, color, sub }: {
  label: string; count: number
  color: "blue" | "green" | "red"
  sub?: string
}) {
  const colors = {
    blue:  "border-blue-300 bg-blue-50 text-blue-800",
    green: "border-green-300 bg-green-50 text-green-800",
    red:   "border-red-200 bg-red-50 text-red-700",
  }
  return (
    <div className={`border rounded px-3 py-2 text-center min-w-[140px] max-w-[180px] ${colors[color]}`}>
      <p className="font-bold text-lg">{count}</p>
      <p className="text-xs font-medium">{label}</p>
      {sub && <p className="text-[10px] mt-0.5 opacity-70">{sub}</p>}
    </div>
  )
}

function PRISMAArrow() {
  return (
    <div className="flex flex-col items-center my-0.5">
      <div className="w-px h-3 bg-gray-400" />
      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-400" />
    </div>
  )
}
