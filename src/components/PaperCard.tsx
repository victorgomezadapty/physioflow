"use client"

import { useState } from "react"
import type { Paper, PaperSummary } from "@/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

const SOURCE_COLORS: Record<string, string> = {
  pubmed: "bg-blue-100 text-blue-700",
  semantic_scholar: "bg-purple-100 text-purple-700",
  openalex: "bg-green-100 text-green-700",
  europe_pmc: "bg-cyan-100 text-cyan-700",
  scielo: "bg-orange-100 text-orange-700",
  biorxiv: "bg-yellow-100 text-yellow-700",
  clinical_trials: "bg-pink-100 text-pink-700",
  core: "bg-gray-100 text-gray-700",
  pedro: "bg-teal-100 text-teal-700",
}

const STUDY_TYPE_COLORS: Record<string, string> = {
  "Systematic Review": "bg-emerald-100 text-emerald-700",
  "Meta-Analysis": "bg-emerald-200 text-emerald-800",
  RCT: "bg-blue-100 text-blue-700",
  Cohort: "bg-indigo-100 text-indigo-700",
  "Case Series": "bg-gray-100 text-gray-600",
  Review: "bg-violet-100 text-violet-700",
  Preprint: "bg-yellow-100 text-yellow-700",
  "Clinical Trial": "bg-pink-100 text-pink-700",
}

interface Props {
  paper: Paper
  rank: number
  summary?: PaperSummary
}

export function PaperCard({ paper, rank, summary }: Props) {
  const [expanded, setExpanded] = useState(false)
  const score = paper.relevanceScore ?? 0

  const scoreColor =
    score >= 80
      ? "text-emerald-600"
      : score >= 60
      ? "text-blue-600"
      : score >= 40
      ? "text-amber-600"
      : "text-gray-500"

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {/* Rank badge */}
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {rank}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <a
              href={paper.url ?? (paper.doi ? `https://doi.org/${paper.doi}` : "#")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 leading-snug line-clamp-2"
            >
              {paper.title}
            </a>

            {/* Authors + year */}
            {(paper.authors.length > 0 || paper.year) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {paper.authors.slice(0, 3).join(", ")}
                {paper.authors.length > 3 ? " et al." : ""}
                {paper.year ? ` · ${paper.year}` : ""}
                {paper.journal ? ` · ${paper.journal}` : ""}
              </p>
            )}

            {/* Badges row */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  SOURCE_COLORS[paper.source] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {SOURCE_LABELS[paper.source] ?? paper.source}
              </span>
              {paper.studyType && paper.studyType !== "Unknown" && (
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    STUDY_TYPE_COLORS[paper.studyType] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {paper.studyType}
                </span>
              )}
              {paper.openAccessUrl && (
                <a
                  href={paper.openAccessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
                >
                  Open Access ↗
                </a>
              )}
            </div>
          </div>

          {/* Relevance score */}
          <div className="flex-shrink-0 text-right">
            <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
            <p className="text-xs text-gray-400">relevance</p>
          </div>
        </div>
      </CardHeader>

      {(paper.relevanceReason || summary) && (
        <CardContent className="pt-0 pb-3">
          {/* Relevance reason */}
          {paper.relevanceReason && (
            <p className="text-xs text-gray-600 bg-blue-50 rounded px-3 py-2 mb-2">
              <span className="font-medium">Why relevant:</span> {paper.relevanceReason}
            </p>
          )}

          {/* Toggle for full summary */}
          {summary && (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {expanded ? "▲ Hide summary" : "▼ Show clinical summary"}
              </button>

              {expanded && (
                <div className="mt-3 space-y-2 text-xs border-t pt-3">
                  <div>
                    <span className="font-semibold text-gray-700">Population: </span>
                    <span className="text-gray-600">{summary.population}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Intervention: </span>
                    <span className="text-gray-600">{summary.intervention}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Findings: </span>
                    <span className="text-gray-600">{summary.mainFindings}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Clinical relevance: </span>
                    <span className="text-gray-600">{summary.clinicalRelevance}</span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="font-semibold text-gray-700">Evidence level: </span>
                      <Badge variant="outline" className="text-xs">{summary.evidenceLevel}</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Limitations: </span>
                    <span className="text-gray-500 italic">{summary.limitations}</span>
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
