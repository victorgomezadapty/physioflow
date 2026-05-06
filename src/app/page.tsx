"use client"

import { useState } from "react"
import type { PatientProfile, SearchResult, SearchStatus } from "@/types"
import { PatientForm } from "@/components/PatientForm"
import { ResultsDashboard } from "@/components/ResultsDashboard"
import { SearchStatusBar } from "@/components/SearchStatus"

export default function Home() {
  const [status, setStatus] = useState<SearchStatus>("idle")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (patient: PatientProfile) => {
    setError(null)
    setResult(null)

    try {
      setStatus("translating")

      // Simulate progress transitions while the pipeline runs server-side
      const transitions: { status: SearchStatus; delay: number }[] = [
        { status: "searching", delay: 3000 },
        { status: "ranking", delay: 10000 },
        { status: "summarizing", delay: 18000 },
      ]
      const timers = transitions.map(({ status: s, delay }) =>
        setTimeout(() => setStatus(s), delay)
      )

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
      })

      timers.forEach(clearTimeout)

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      const data: SearchResult = await res.json()
      setResult(data)
      setStatus("complete")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  const handleReset = () => {
    setStatus("idle")
    setResult(null)
    setError(null)
  }

  const isLoading =
    status === "translating" ||
    status === "searching" ||
    status === "ranking" ||
    status === "summarizing"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">PhysioFlow</h1>
              <p className="text-[10px] text-gray-400 leading-none">Evidence Search Engine</p>
            </div>
          </div>

          {result && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-700 border rounded px-3 py-1.5"
            >
              ← New search
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Form state */}
        {status === "idle" && !result && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-bold text-gray-900">Clinical Evidence Search</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ingresa el perfil del paciente para buscar evidencia científica personalizada en 7+ bases de datos
              </p>
            </div>
            <PatientForm onSubmit={handleSearch} isLoading={false} />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="max-w-2xl mx-auto">
            <SearchStatusBar status={status} />
          </div>
        )}

        {/* Error state */}
        {status === "error" && error && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700">Error durante la búsqueda</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
              {error.includes("API_KEY") && (
                <p className="text-xs text-red-500 mt-2">
                  Configure DEEPSEEK_API_KEY en tu archivo .env.local
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              className="w-full border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              ← Try again / Intentar de nuevo
            </button>
          </div>
        )}

        {/* Results state */}
        {status === "complete" && result && (
          <ResultsDashboard result={result} />
        )}
      </main>
    </div>
  )
}
