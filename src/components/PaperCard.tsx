"use client"

import { useState } from "react"
import type { Paper, QualityAssessment, ExtractedData } from "@/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const SOURCE_LABELS: Record<string, string> = {
  pubmed: "PubMed", semantic_scholar: "Semantic Scholar", openalex: "OpenAlex",
  europe_pmc: "Europe PMC", scielo: "SciELO", biorxiv: "medRxiv",
  clinical_trials: "ClinicalTrials", core: "CORE", pedro: "PEDro",
}

const SOURCE_COLORS: Record<string, string> = {
  pubmed: "bg-blue-100 text-blue-700", semantic_scholar: "bg-purple-100 text-purple-700",
  openalex: "bg-green-100 text-green-700", europe_pmc: "bg-cyan-100 text-cyan-700",
  scielo: "bg-orange-100 text-orange-700", biorxiv: "bg-yellow-100 text-yellow-700",
  clinical_trials: "bg-pink-100 text-pink-700", core: "bg-gray-100 text-gray-700",
  pedro: "bg-teal-100 text-teal-700",
}

const STUDY_TYPE_COLORS: Record<string, string> = {
  "Systematic Review": "bg-emerald-100 text-emerald-700",
  "Meta-Analysis": "bg-emerald-200 text-emerald-800",
  RCT: "bg-blue-100 text-blue-700", Cohort: "bg-indigo-100 text-indigo-700",
  "Case Series": "bg-gray-100 text-gray-600", Review: "bg-violet-100 text-violet-700",
  Preprint: "bg-yellow-100 text-yellow-700", "Clinical Trial": "bg-pink-100 text-pink-700",
}

interface Props {
  paper: Paper
  rank?: number
  quality?: QualityAssessment
  extraction?: ExtractedData
  screeningReason?: string
  excluded?: boolean
  exclusionReason?: string
}

export function PaperCard({ paper, rank, quality, extraction, screeningReason, excluded, exclusionReason }: Props) {
  const [expanded, setExpanded] = useState(false)

  // RoB traffic light
  const robSummary = quality
    ? (() => {
        const highs = quality.cochraneRoB.filter((d) => d.rating === "high").length
        const lows = quality.cochraneRoB.filter((d) => d.rating === "low").length
        if (highs === 0 && lows >= 4) return { color: "bg-green-500", label: "Low RoB" }
        if (highs >= 3) return { color: "bg-red-500", label: "High RoB" }
        return { color: "bg-yellow-400", label: "Some RoB" }
      })()
    : null

  return (
    <Card className={`transition-shadow hover:shadow-md ${excluded ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {rank && (
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              {rank}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <a
              href={paper.openAccessUrl ?? paper.url ?? (paper.doi ? `https://doi.org/${paper.doi}` : "#")}
              target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 leading-snug line-clamp-2"
            >
              {paper.title}
            </a>

            <p className="text-xs text-gray-500 mt-0.5">
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 ? " et al." : ""}
              {paper.year ? ` · ${paper.year}` : ""}
              {paper.journal ? ` · ${paper.journal}` : ""}
            </p>

            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${SOURCE_COLORS[paper.source] ?? "bg-gray-100 text-gray-600"}`}>
                {SOURCE_LABELS[paper.source] ?? paper.source}
              </span>
              {paper.studyType && paper.studyType !== "Unknown" && (
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STUDY_TYPE_COLORS[paper.studyType] ?? "bg-gray-100 text-gray-600"}`}>
                  {paper.studyType}
                </span>
              )}
              {paper.openAccessUrl && (
                <a href={paper.openAccessUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">
                  Open Access ↗
                </a>
              )}
              {robSummary && (
                <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-white ${robSummary.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
                  {robSummary.label}
                </span>
              )}
              {quality?.pedroScore && quality.pedroScore.total > 0 && (
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700">
                  PEDro {quality.pedroScore.total}/10
                </span>
              )}
              {quality?.oxfordLevel && quality.oxfordLevel !== "unknown" && (
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700">
                  Oxford {quality.oxfordLevel}
                </span>
              )}
              {excluded && (
                <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600">
                  Excluded
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {(screeningReason || exclusionReason || extraction || quality) && (
        <CardContent className="pt-0 pb-3">
          {exclusionReason && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-2">
              <span className="font-medium">Exclusion reason: </span>{exclusionReason}
            </p>
          )}
          {screeningReason && !exclusionReason && (
            <p className="text-xs text-gray-600 bg-blue-50 rounded px-3 py-2 mb-2">
              <span className="font-medium">Inclusion reason: </span>{screeningReason}
            </p>
          )}

          {(extraction || quality) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {expanded ? "▲ Hide details" : "▼ Show quality & data details"}
            </button>
          )}

          {expanded && (
            <div className="mt-3 space-y-3 text-xs border-t pt-3">
              {/* Quality detail */}
              {quality && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Cochrane Risk of Bias</p>
                  <div className="grid grid-cols-2 gap-1">
                    {quality.cochraneRoB.map((d) => (
                      <div key={d.domain} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          d.rating === "low" ? "bg-green-500"
                          : d.rating === "high" ? "bg-red-500"
                          : d.rating === "unclear" ? "bg-yellow-400"
                          : "bg-gray-300"
                        }`} />
                        <span className="text-gray-600 leading-tight truncate" title={d.justification}>
                          {d.domain.replace("Blinding of ", "").replace(" and personnel", "")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {quality.cannotAssessPercentage > 50 && (
                    <p className="text-amber-600 mt-1 italic">
                      {quality.cannotAssessPercentage}% of domains could not be assessed from abstract
                    </p>
                  )}
                </div>
              )}

              {/* Extraction detail */}
              {extraction && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Extracted Data</p>
                  <div className="space-y-0.5">
                    {extraction.sampleSize?.total && extraction.sampleSize.total.confidence !== "not_reported" && (
                      <p className="text-gray-600">N = {extraction.sampleSize.total.value}
                        <span className="text-gray-400 ml-1">({extraction.sampleSize.total.confidence})</span>
                      </p>
                    )}
                    {extraction.effectSize && extraction.effectSize.confidence !== "not_reported" && (
                      <p className="text-gray-600">
                        Effect size ({extraction.effectSize.type}): {extraction.effectSize.value.toFixed(2)}
                        {" "}[{extraction.effectSize.ci95[0].toFixed(2)}, {extraction.effectSize.ci95[1].toFixed(2)}]
                        <span className="text-gray-400 ml-1">({extraction.effectSize.confidence})</span>
                      </p>
                    )}
                    {extraction.pValue && extraction.pValue.confidence !== "not_reported" && (
                      <p className="text-gray-600">p = {extraction.pValue.value}
                        <span className="text-gray-400 ml-1">({extraction.pValue.confidence})</span>
                      </p>
                    )}
                    {extraction.outcomesMeasured.length > 0 && (
                      <p className="text-gray-500 italic">Outcomes: {extraction.outcomesMeasured.join(", ")}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
