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
import { Separator } from "@/components/ui/separator"

interface Props {
  onSubmit: (profile: PatientProfile) => void
  isLoading: boolean
}

const defaultProfile: PatientProfile = {
  age: 30,
  sex: "male",
  activityLevel: "recreational",
  condition: "",
  clinicalArea: "physiotherapy",
}

export function PatientForm({ onSubmit, isLoading }: Props) {
  const [profile, setProfile] = useState<PatientProfile>(defaultProfile)

  const set = (field: keyof PatientProfile, value: string | number | null) => {
    if (value === null) return
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile.condition.trim()) return
    onSubmit(profile)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Clinical Area */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Área clínica / Clinical Area</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(["physiotherapy", "training", "nutrition"] as const).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => set("clinicalArea", area)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  profile.clinicalArea === area
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {area === "physiotherapy" ? "Fisioterapia" : area === "training" ? "Entrenamiento" : "Nutrición"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Patient Demographics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos del paciente / Patient Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Edad / Age</Label>
              <Input
                id="age"
                type="number"
                min={1}
                max={120}
                value={profile.age}
                onChange={(e) => set("age", parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="75"
                value={profile.weightKg ?? ""}
                onChange={(e) => set("weightKg", parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="height">Talla (cm)</Label>
              <Input
                id="height"
                type="number"
                placeholder="175"
                value={profile.heightCm ?? ""}
                onChange={(e) => set("heightCm", parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sexo / Sex</Label>
              <Select value={profile.sex} onValueChange={(v) => set("sex", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino / Male</SelectItem>
                  <SelectItem value="female">Femenino / Female</SelectItem>
                  <SelectItem value="other">Otro / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nivel de actividad / Activity Level</Label>
              <Select value={profile.activityLevel} onValueChange={(v) => set("activityLevel", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentario / Sedentary</SelectItem>
                  <SelectItem value="recreational">Recreacional / Recreational</SelectItem>
                  <SelectItem value="amateur">Amateur / Amateur</SelectItem>
                  <SelectItem value="professional">Profesional / Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sport">Deporte / Sport</Label>
              <Input
                id="sport"
                placeholder="Ej: Fútbol, Ciclismo..."
                value={profile.sport ?? ""}
                onChange={(e) => set("sport", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="occupation">Ocupación / Occupation</Label>
              <Input
                id="occupation"
                placeholder="Ej: Oficinista, Obrero..."
                value={profile.occupation ?? ""}
                onChange={(e) => set("occupation", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información clínica / Clinical Information</CardTitle>
          <CardDescription className="text-xs">
            Sé específico — mejor descripción = mejor búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="condition">
              Condición / diagnóstico principal <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="condition"
              required
              rows={2}
              placeholder="Ej: Tendinopatía rotuliana bilateral, dolor crónico lumbar, síndrome de banda iliotibial..."
              value={profile.condition}
              onChange={(e) => set("condition", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="duration">Tiempo de evolución / Duration</Label>
              <Input
                id="duration"
                placeholder="Ej: 6 meses, agudo, crónico..."
                value={profile.symptomDuration ?? ""}
                onChange={(e) => set("symptomDuration", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="history">
              Historia clínica relevante / Clinical History
            </Label>
            <Textarea
              id="history"
              rows={2}
              placeholder="Cirugías previas, comorbilidades, medicación relevante..."
              value={profile.injuryHistory ?? ""}
              onChange={(e) => set("injuryHistory", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="failed">
              Tratamientos previos sin resultado / Failed Treatments
            </Label>
            <Textarea
              id="failed"
              rows={2}
              placeholder="Ej: 8 semanas de excéntricos de Alfredson sin mejoría significativa, fisioterapia convencional 3 meses..."
              value={profile.failedTreatments ?? ""}
              onChange={(e) => set("failedTreatments", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas adicionales / Additional Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Cualquier información relevante adicional..."
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
          "Search Evidence / Buscar Evidencia"
        )}
      </Button>
    </form>
  )
}
