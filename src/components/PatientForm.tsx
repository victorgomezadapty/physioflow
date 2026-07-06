"use client"

import { useState } from "react"
import type { PatientProfile } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface Props {
  onSubmit: (profile: PatientProfile) => void
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Area-specific configuration — placeholders, labels, examples per modality
// ---------------------------------------------------------------------------
type ClinicalArea = "physiotherapy" | "training" | "nutrition"

interface AreaConfig {
  value: ClinicalArea
  label: string
  icon: string
  description: string
  conditionLabel: string
  conditionPlaceholder: string
  durationLabel: string
  durationPlaceholder: string
  historyLabel: string
  historyPlaceholder: string
  failedLabel: string
  failedPlaceholder: string
  notesPlaceholder: string
}

const CLINICAL_AREAS: AreaConfig[] = [
  {
    value: "physiotherapy",
    label: "Physiotherapy",
    icon: "🦴",
    description: "Injuries, pain, rehabilitation, movement",
    conditionLabel: "Injury / primary diagnosis",
    conditionPlaceholder: "e.g. Bilateral patellar tendinopathy, chronic low back pain, IT band syndrome...",
    durationLabel: "Duration / time since onset",
    durationPlaceholder: "e.g. 6 months, acute, chronic...",
    historyLabel: "Medical history / previous injuries",
    historyPlaceholder: "Previous surgeries, recurrent injuries, musculoskeletal comorbidities...",
    failedLabel: "Previous treatments without results",
    failedPlaceholder: "e.g. 8 weeks of Alfredson eccentrics without improvement, conventional physiotherapy 3 months...",
    notesPlaceholder: "Biomechanics, special tests, imaging, current pain level...",
  },
  {
    value: "training",
    label: "Training",
    icon: "🏋️",
    description: "Performance, strength, periodization, sport",
    conditionLabel: "Goal / performance problem",
    conditionPlaceholder: "e.g. Strength plateau, sub-3h marathon prep, preseason injury prevention...",
    durationLabel: "Training experience",
    durationPlaceholder: "e.g. 3 years, beginner, advanced intermediate...",
    historyLabel: "Training history",
    historyPlaceholder: "Previous programs, weekly volume, competitions, relevant PRs...",
    failedLabel: "Methods or programs that didn't work",
    failedPlaceholder: "e.g. Linear periodization 6 months without progression, hypertrophy program without gains...",
    notesPlaceholder: "Performance tests, body composition, restrictions, available equipment...",
  },
  {
    value: "nutrition",
    label: "Nutrition",
    icon: "🥗",
    description: "Diet, body composition, supplementation",
    conditionLabel: "Goal / nutritional condition",
    conditionPlaceholder: "e.g. Fat loss while maintaining muscle mass, sports nutrition optimization, type 2 diabetes management...",
    durationLabel: "Time with this condition / goal",
    durationPlaceholder: "e.g. 1 year, recently diagnosed, 6-month goal...",
    historyLabel: "Nutritional / medical history",
    historyPlaceholder: "Previous diets, food allergies, GI conditions, metabolism-affecting medication...",
    failedLabel: "Diets or supplements that didn't work",
    failedPlaceholder: "e.g. Ketogenic diet 3 months without results, creatine supplementation without response...",
    notesPlaceholder: "Relevant labs (glucose, lipids, HbA1c), food preferences, schedules...",
  },
]

const defaultProfile: PatientProfile = {
  age: 30,
  sex: "male",
  activityLevel: "recreational",
  condition: "",
  clinicalArea: "physiotherapy",
}

export function PatientForm({ onSubmit, isLoading }: Props) {
  const [profile, setProfile] = useState<PatientProfile>(defaultProfile)

  const set = (field: keyof PatientProfile, value: string | number | null | undefined) => {
    if (value === null) return
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const setNum = (field: keyof PatientProfile, raw: string, parser: (s: string) => number) => {
    if (raw === "") { setProfile((prev) => ({ ...prev, [field]: undefined })); return }
    const n = parser(raw)
    if (!isNaN(n)) set(field, n)
  }

  const handleAreaChange = (area: ClinicalArea) => {
    // When changing area, clear the condition to avoid confusion
    setProfile((prev) => ({ ...prev, clinicalArea: area, condition: "" }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile.condition.trim()) return
    onSubmit(profile)
  }

  // Get current area config for contextual placeholders
  const areaConfig = CLINICAL_AREAS.find((a) => a.value === profile.clinicalArea) ?? CLINICAL_AREAS[0]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Clinical Area */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clinical Area</CardTitle>
          <CardDescription className="text-xs">Select the area — fields adapt accordingly</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {CLINICAL_AREAS.map((area) => (
              <button
                key={area.value}
                type="button"
                onClick={() => handleAreaChange(area.value)}
                className={`rounded-xl border-2 px-3 py-4 text-left transition-all ${
                  profile.clinicalArea === area.value
                    ? "border-blue-500 bg-blue-600 text-white shadow-md scale-[1.02]"
                    : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                <div className="text-2xl mb-1">{area.icon}</div>
                <div className={`text-sm font-bold ${profile.clinicalArea === area.value ? "text-white" : "text-gray-800"}`}>
                  {area.label}
                </div>
                <div className={`text-[10px] mt-0.5 leading-tight ${profile.clinicalArea === area.value ? "text-blue-100" : "text-gray-400"}`}>
                  {area.description}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patient Demographics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Patient Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={1}
                max={120}
                value={profile.age ?? ""}
                onChange={(e) => setNum("age", e.target.value, parseInt)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="75"
                value={profile.weightKg ?? ""}
                onChange={(e) => setNum("weightKg", e.target.value, parseFloat)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                placeholder="175"
                value={profile.heightCm ?? ""}
                onChange={(e) => setNum("heightCm", e.target.value, parseFloat)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={profile.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Activity Level</Label>
              <Select value={profile.activityLevel} onValueChange={(v) => set("activityLevel", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="recreational">Recreational</SelectItem>
                  <SelectItem value="amateur">Amateur</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sport">Sport</Label>
              <Input
                id="sport"
                placeholder="e.g. Football, Cycling..."
                value={profile.sport ?? ""}
                onChange={(e) => set("sport", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                placeholder="e.g. Office worker, Construction..."
                value={profile.occupation ?? ""}
                onChange={(e) => set("occupation", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Information — CONTEXTUAL per area */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>{areaConfig.icon}</span>
            {areaConfig.label} — Specific Information
          </CardTitle>
          <CardDescription className="text-xs">
            Be specific — better description = better search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="condition">
              {areaConfig.conditionLabel} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="condition"
              required
              rows={2}
              placeholder={areaConfig.conditionPlaceholder}
              value={profile.condition}
              onChange={(e) => set("condition", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="duration">{areaConfig.durationLabel}</Label>
              <Input
                id="duration"
                placeholder={areaConfig.durationPlaceholder}
                value={profile.symptomDuration ?? ""}
                onChange={(e) => set("symptomDuration", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="history">{areaConfig.historyLabel}</Label>
            <Textarea
              id="history"
              rows={2}
              placeholder={areaConfig.historyPlaceholder}
              value={profile.injuryHistory ?? ""}
              onChange={(e) => set("injuryHistory", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="failed">{areaConfig.failedLabel}</Label>
            <Textarea
              id="failed"
              rows={2}
              placeholder={areaConfig.failedPlaceholder}
              value={profile.failedTreatments ?? ""}
              onChange={(e) => set("failedTreatments", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder={areaConfig.notesPlaceholder}
              value={profile.additionalNotes ?? ""}
              onChange={(e) => set("additionalNotes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={isLoading || !profile.condition.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Searching evidence...
          </span>
        ) : (
          "Search Evidence"
        )}
      </Button>
    </form>
  )
}
