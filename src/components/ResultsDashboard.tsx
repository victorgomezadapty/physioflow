"use client"

import type { SearchResult } from "@/types"
import { PaperCard } from "./PaperCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

interface Props {
  result: SearchResult
}

const SOURCE_LABELS: Record<string, string> = {
  pubmed: "PubMed",
  semantic_scholar: "Semantic Scholar",
  openalex: "OpenAlex",
  europe_pmc: "Europe PMC",
  scielo: "SciELO",
  biorxiv: "medRxiv",
  clinical_trials: "ClinicalTrials",
  core: "CORE",
  pedro: "PEDro",
}

export function ResultsDashboard({ result }: Props) {
  const { picos, topPapers, papers, summaries, evidenceSummary, searchStats, patientProfile } = result

  const summaryMap = Object.fromEntries(summaries.map((s) => [s.paperId, s]))

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-blue-600">{searchStats.total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Papers found</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-green-600">{searchStats.deduplicatedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">After deduplication</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-purple-600">{topPapers.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Highly relevant</p>
        </Card>
      </div>

      <Tabs defaultValue="synthesis">
        <TabsList className="w-full">
          <TabsTrigger value="synthesis" className="flex-1">Síntesis / Synthesis</TabsTrigger>
          <TabsTrigger value="papers" className="flex-1">Top Papers ({topPapers.length})</TabsTrigger>
          <TabsTrigger value="picos" className="flex-1">PICOS Strategy</TabsTrigger>
          <TabsTrigger value="all" className="flex-1">All ({papers.length})</TabsTrigger>
        </TabsList>

        {/* Evidence Synthesis Tab */}
        <TabsContent value="synthesis" className="mt-4 space-y-4">
          {evidenceSummary ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  Evidence Synthesis
                  <span className="text-xs font-normal text-gray-500 ml-auto">
                    Based on {summaries.length} papers
                  </span>
                </CardTitle>
                <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                  Patient: {patientProfile.age}yo {patientProfile.sex} · {patientProfile.condition}
                  {patientProfile.symptomDuration ? ` · ${patientProfile.symptomDuration}` : ""}
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line text-sm">
                  {evidenceSummary}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-8 text-gray-400">
              <p>No synthesis available — add an AI API key to enable this feature.</p>
            </Card>
          )}
        </TabsContent>

        {/* Top Papers Tab */}
        <TabsContent value="papers" className="mt-4 space-y-3">
          {topPapers.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No highly relevant papers found.</p>
          ) : (
            topPapers.map((paper, i) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                rank={i + 1}
                summary={summaryMap[paper.id]}
              />
            ))
          )}
        </TabsContent>

        {/* PICOS Tab */}
        <TabsContent value="picos" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">PICOS Search Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {[
                { label: "P — Population", value: picos.population },
                { label: "I — Intervention", value: picos.intervention },
                { label: "C — Comparison", value: picos.comparison },
                { label: "O — Outcome", value: picos.outcome },
                { label: "S — Study Design", value: picos.studyDesign },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-semibold text-gray-700">{label}</p>
                  <p className="text-gray-600 mt-0.5">{value}</p>
                  <Separator className="mt-3" />
                </div>
              ))}

              <div>
                <p className="font-semibold text-gray-700 mb-2">Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {picos.keywords.map((kw) => (
                    <span key={kw} className="bg-blue-50 text-blue-700 rounded px-2 py-0.5 text-xs">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="font-semibold text-gray-700 mb-2">PubMed Query</p>
                <code className="block bg-gray-50 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap break-all">
                  {picos.searchQueries.pubmed}
                </code>
              </div>
            </CardContent>
          </Card>

          {/* Source breakdown */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Results by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(searchStats.bySource)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-36">{SOURCE_LABELS[source] ?? source}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-400 h-2 rounded-full"
                          style={{ width: `${(count / searchStats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Papers Tab */}
        <TabsContent value="all" className="mt-4 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            All {papers.length} papers after deduplication, sorted by relevance score.
          </p>
          {papers.map((paper, i) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              rank={i + 1}
              summary={summaryMap[paper.id]}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
