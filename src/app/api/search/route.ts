import { NextRequest, NextResponse } from "next/server"
import type { PatientProfile } from "@/types"
import { runPipeline } from "@/lib/agents/orchestrator"

export async function POST(req: NextRequest) {
  try {
    const patient: PatientProfile = await req.json()

    if (!patient.condition || !patient.age) {
      return NextResponse.json(
        { error: "Patient profile must include age and condition" },
        { status: 400 }
      )
    }

    const result = await runPipeline(patient)

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Pipeline error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
