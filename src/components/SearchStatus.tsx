"use client"

import type { SearchStatus } from "@/types"

const STEPS: { key: SearchStatus; label: string; sublabel: string }[] = [
  { key: "protocol",    label: "PICOS Protocol",      sublabel: "Generating frozen search protocol..." },
  { key: "searching",   label: "Searching databases", sublabel: "PubMed, Semantic Scholar, OpenAlex, SciELO..." },
  { key: "screening",   label: "PRISMA Screening",    sublabel: "3-level screening of results..." },
  { key: "quality",     label: "Quality Assessment",  sublabel: "Cochrane RoB + PEDro evaluation..." },
  { key: "extracting",  label: "Data Extraction",     sublabel: "Extracting quantitative data from abstracts..." },
  { key: "analyzing",   label: "Statistical Analysis",sublabel: "Computing effect sizes and heterogeneity..." },
  { key: "synthesizing",label: "Synthesizing",        sublabel: "Generating GRADE-rated clinical recommendation..." },
]

const ORDER: SearchStatus[] = [
  "idle", "protocol", "searching", "screening",
  "quality", "extracting", "analyzing", "synthesizing", "complete", "error",
]

export function SearchStatusBar({ status }: { status: SearchStatus }) {
  if (status === "idle" || status === "complete") return null

  const currentIndex = STEPS.findIndex((s) => s.key === status)
  const current = STEPS[currentIndex]

  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      {/* Steps */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
        {STEPS.map((step, i) => {
          const stepOrder = ORDER.indexOf(step.key)
          const currentOrder = ORDER.indexOf(status)
          const isDone = stepOrder < currentOrder
          const isActive = step.key === status

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className="flex-1 flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0 ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <span
                  className={`text-[9px] mt-1 text-center leading-tight hidden sm:block ${
                    isActive ? "text-blue-600 font-medium" : isDone ? "text-emerald-600" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-full mx-1 mt-[-14px] ${isDone ? "bg-emerald-400" : "bg-gray-200"}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Current step detail */}
      {current && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <span className="font-medium text-blue-700">{current.label}</span>
            <span className="text-gray-500 ml-2 text-xs">{current.sublabel}</span>
          </div>
        </div>
      )}
    </div>
  )
}
