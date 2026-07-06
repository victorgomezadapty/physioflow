/**
 * Pure statistical functions for meta-analysis.
 * No AI calls — all deterministic math.
 * Formulas follow standard meta-analytic methods.
 */

import type { PooledEffect, HeterogeneityResult } from "@/types"

// ---------------------------------------------------------------------------
// Effect size input/output types
// ---------------------------------------------------------------------------
export interface EffectSizeInput {
  mean1: number  // Intervention group mean
  sd1: number    // Intervention group SD
  n1: number     // Intervention group N
  mean2: number  // Control group mean
  sd2: number    // Control group SD
  n2: number     // Control group N
}

export interface EffectSizeResult {
  hedgesG: number
  variance: number
  se: number
  ci95: [number, number]
}

export interface StudyEffect {
  paperId: string
  label: string
  effectSize: number
  variance: number
  weight?: number // Filled in by randomEffectsModel
}

export interface PooledResult {
  pooledEffect: PooledEffect
  weights: number[]
}

// ---------------------------------------------------------------------------
// 1. calculateEffectSize — Hedges' g (bias-corrected SMD)
// ---------------------------------------------------------------------------
export function calculateEffectSize(input: EffectSizeInput): EffectSizeResult {
  const { mean1, sd1, n1, mean2, sd2, n2 } = input

  // Pooled standard deviation (Cohen's pooled SD)
  const pooledSD = Math.sqrt(
    ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) / (n1 + n2 - 2)
  )

  if (pooledSD === 0) {
    return { hedgesG: 0, variance: 0, se: 0, ci95: [0, 0] }
  }

  // Cohen's d
  const d = (mean1 - mean2) / pooledSD

  // Hedges' correction factor J (small-sample bias correction)
  const df = n1 + n2 - 2
  // Approximation of J: 1 - 3/(4*df - 1)
  const J = 1 - 3 / (4 * df - 1)
  const g = d * J

  // Variance of g
  const variance = (n1 + n2) / (n1 * n2) + g ** 2 / (2 * (n1 + n2 - 2))

  const se = Math.sqrt(variance)
  const z95 = 1.96
  const ci95: [number, number] = [g - z95 * se, g + z95 * se]

  return { hedgesG: g, variance, se, ci95 }
}

// ---------------------------------------------------------------------------
// 2. randomEffectsModel — DerSimonian-Laird estimator
// ---------------------------------------------------------------------------
export function randomEffectsModel(effects: StudyEffect[]): {
  result: PooledResult
  tau2: number // Between-study variance
} {
  if (effects.length === 0) {
    return {
      result: {
        pooledEffect: { value: 0, ci95: [0, 0], pValue: 1 },
        weights: [],
      },
      tau2: 0,
    }
  }

  const k = effects.length
  const variances = effects.map((e) => e.variance)
  const fixedWeights = variances.map((v) => 1 / v)
  const sumW = fixedWeights.reduce((a, b) => a + b, 0)
  const sumWEs = effects.reduce((sum, e, i) => sum + fixedWeights[i] * e.effectSize, 0)
  const fixedPooled = sumWEs / sumW

  // Cochran's Q for DL tau² estimation
  const Q = effects.reduce(
    (sum, e, i) => sum + fixedWeights[i] * (e.effectSize - fixedPooled) ** 2,
    0
  )
  const sumW2 = fixedWeights.reduce((a, b) => a + b ** 2, 0)
  const C = sumW - sumW2 / sumW

  // DerSimonian-Laird tau²
  const tau2 = Math.max(0, (Q - (k - 1)) / C)

  // Random-effects weights
  const reWeights = variances.map((v) => 1 / (v + tau2))
  const sumREW = reWeights.reduce((a, b) => a + b, 0)

  const pooledValue =
    effects.reduce((sum, e, i) => sum + reWeights[i] * e.effectSize, 0) / sumREW

  const pooledVariance = 1 / sumREW
  const pooledSE = Math.sqrt(pooledVariance)
  const z95 = 1.96
  const ci95: [number, number] = [
    pooledValue - z95 * pooledSE,
    pooledValue + z95 * pooledSE,
  ]

  // Two-tailed p-value (z-test)
  const z = pooledValue / pooledSE
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))

  // Percentage weights for forest plot display
  const totalWeight = reWeights.reduce((a, b) => a + b, 0)
  const weights = reWeights.map((w) => Math.round((w / totalWeight) * 100 * 10) / 10)

  return {
    result: {
      pooledEffect: {
        value: Math.round(pooledValue * 1000) / 1000,
        ci95: [Math.round(ci95[0] * 1000) / 1000, Math.round(ci95[1] * 1000) / 1000],
        pValue: Math.round(pValue * 10000) / 10000,
      },
      weights,
    },
    tau2,
  }
}

// ---------------------------------------------------------------------------
// 3. heterogeneityTests — Cochran's Q + I²
// ---------------------------------------------------------------------------
export function heterogeneityTests(
  effects: StudyEffect[],
  pooledEffect: number
): HeterogeneityResult {
  const k = effects.length
  if (k < 2) {
    return {
      Q: 0,
      df: k - 1,
      pValue: 1,
      iSquared: 0,
      interpretation: "very_low",
    }
  }

  const variances = effects.map((e) => e.variance)
  const weights = variances.map((v) => 1 / v)

  // Cochran's Q
  const Q = effects.reduce(
    (sum, e, i) => sum + weights[i] * (e.effectSize - pooledEffect) ** 2,
    0
  )
  const df = k - 1

  // P-value from chi-squared distribution (approximation)
  const pValue = 1 - chiSquaredCDF(Q, df)

  // I² = max(0, (Q - df) / Q * 100)
  const iSquared = Math.max(0, Math.round(((Q - df) / Q) * 100))

  const interpretation: HeterogeneityResult["interpretation"] =
    iSquared < 25
      ? "very_low"
      : iSquared < 50
      ? "low"
      : iSquared < 75
      ? "moderate"
      : "high"

  return {
    Q: Math.round(Q * 100) / 100,
    df,
    pValue: Math.round(pValue * 10000) / 10000,
    iSquared,
    interpretation,
  }
}

// ---------------------------------------------------------------------------
// 4. failSafeN — Orwin's fail-safe N
// How many null-result studies needed to reduce effect to trivial level (d=0.2)
// ---------------------------------------------------------------------------
export function failSafeN(
  effects: StudyEffect[],
  trivialEffect = 0.2
): number {
  if (effects.length === 0) return 0

  const currentMeanEffect =
    effects.reduce((sum, e) => sum + e.effectSize, 0) / effects.length

  if (Math.abs(currentMeanEffect) <= trivialEffect) return 0

  // Orwin's formula: N_fs = k * (|mean_effect| - trivial) / trivial
  const n_fs = effects.length * (Math.abs(currentMeanEffect) - trivialEffect) / trivialEffect

  return Math.max(0, Math.ceil(n_fs))
}

// ---------------------------------------------------------------------------
// Statistical distribution helpers
// ---------------------------------------------------------------------------

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(z: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = z >= 0 ? 1 : -1
  const x = Math.abs(z) / Math.sqrt(2)
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/** Chi-squared CDF via regularized incomplete gamma (Wilson-Hilferty approximation) */
function chiSquaredCDF(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 0
  // Wilson-Hilferty approximation
  const k = df
  const h = (x / k) ** (1 / 3)
  const mu = 1 - 2 / (9 * k)
  const sigma = Math.sqrt(2 / (9 * k))
  const z = (h - mu) / sigma
  return normalCDF(z)
}
