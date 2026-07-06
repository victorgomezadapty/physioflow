import type {
  ExtractedData,
  QualityAssessment,
  StatisticalResult,
  ForestPlotEntry,
  Agent4Result,
} from "@/types"
import {
  calculateEffectSize,
  randomEffectsModel,
  heterogeneityTests,
  failSafeN,
  type StudyEffect,
} from "@/lib/stats/meta_analysis"
import { generateForestPlotSvg } from "@/lib/stats/forest_plot"

// Minimum studies required for a pooled meta-analysis
const MIN_STUDIES_FOR_META = 3

// ---------------------------------------------------------------------------
// analyzeEvidence — Agent 4 (pure math, no AI calls)
// ---------------------------------------------------------------------------
export async function analyzeEvidence(
  extractedData: ExtractedData[],
  qualityAssessments: QualityAssessment[]
): Promise<Agent4Result> {
  const redFlags: string[] = []

  // ── Filter: only papers with usable effect size data ──
  const usable = extractedData.filter(
    (d) =>
      d.effectSize &&
      (d.effectSize.confidence === "extracted" || d.effectSize.confidence === "derived")
  )

  const unusable = extractedData.length - usable.length
  if (unusable > 0) {
    redFlags.push(
      `${unusable} of ${extractedData.length} studies lacked reportable effect sizes in abstracts and were excluded from quantitative analysis.`
    )
  }

  // Always include this limitation
  const limitations = [
    "Effect sizes estimated from abstract-level data, not full-text extraction — estimates carry additional uncertainty.",
    "Standard errors may be imprecise due to incomplete reporting in abstracts.",
    "Publication bias not formally assessed — requires full-text data and accurate standard errors.",
  ]

  // Average cannotAssessPercentage across papers
  const avgCannotAssess =
    qualityAssessments.length > 0
      ? Math.round(
          qualityAssessments.reduce((sum, q) => sum + q.cannotAssessPercentage, 0) /
            qualityAssessments.length
        )
      : 100

  if (avgCannotAssess > 50) {
    redFlags.push(
      `Quality assessment severely limited: ${avgCannotAssess}% of quality domains could not be evaluated from abstract-only data.`
    )
  }

  // ── Insufficient data case ──
  if (usable.length < MIN_STUDIES_FOR_META) {
    const forestPlotData = buildForestPlotData(usable, extractedData)
    const forestPlotSvg =
      forestPlotData.length > 0
        ? generateForestPlotSvg(forestPlotData)
        : undefined

    if (usable.length < 3) {
      redFlags.push("Very few studies — interpret all findings with extreme caution.")
    }

    return {
      statisticalResult: {
        studiesIncludedInMeta: usable.length,
        studiesExcluded: unusable,
        exclusionReason: `Only ${usable.length} of ${extractedData.length} included studies reported effect sizes — minimum ${MIN_STUDIES_FOR_META} required for pooled meta-analysis.`,
        forestPlotData,
        forestPlotSvg,
        limitations,
        publicationBiasNote:
          "Publication bias not assessed — requires full-text data extraction and accurate standard errors.",
        redFlags,
        insufficientDataNarrative: buildInsufficientDataNarrative(usable.length, extractedData.length),
      },
    }
  }

  // ── Full meta-analysis ──
  const studyEffects: StudyEffect[] = usable.map((d) => {
    const qa = qualityAssessments.find((q) => q.paperId === d.paperId)
    const label = buildStudyLabel(d.paperId, extractedData)
    let effectSize = d.effectSize!.value
    let variance = 0.05 // Default variance when only ES is reported

    // If we have means + SDs + sample sizes, recalculate precisely
    if (
      d.means?.group1 != null &&
      d.means?.group2 != null &&
      d.sds?.group1 != null &&
      d.sds?.group2 != null &&
      d.sampleSize?.group1?.value &&
      d.sampleSize?.group2?.value
    ) {
      const calc = calculateEffectSize({
        mean1: d.means.group1,
        sd1: d.sds.group1,
        n1: d.sampleSize.group1.value,
        mean2: d.means.group2,
        sd2: d.sds.group2,
        n2: d.sampleSize.group2.value,
      })
      effectSize = calc.hedgesG
      variance = calc.variance
    } else if (d.sampleSize?.total?.value) {
      // Approximate variance from sample size when SD not reported
      const n = d.sampleSize.total.value
      variance = 4 / n + effectSize ** 2 / (2 * n)
    }

    // Downweight high-risk-of-bias papers slightly
    const robRating = qa
      ? qa.cochraneRoB.filter((r) => r.rating === "high").length
      : 0
    if (robRating >= 3) variance *= 1.3 // Inflate variance for poor quality

    return { paperId: d.paperId, label, effectSize, variance }
  })

  const { result: pooledResult, tau2 } = randomEffectsModel(studyEffects)
  const hetero = heterogeneityTests(studyEffects, pooledResult.pooledEffect.value)
  const fsN = failSafeN(studyEffects)

  // Apply weights back to studyEffects for forest plot
  const weightedEffects = studyEffects.map((e, i) => ({
    ...e,
    weight: pooledResult.weights[i] ?? 0,
  }))

  // ── Auto red flags ──
  if (usable.length < 5) {
    redFlags.push(`Only ${usable.length} studies contributed to the meta-analysis — interpret pooled estimate cautiously.`)
  }
  if (hetero.iSquared > 75) {
    redFlags.push(`High heterogeneity detected (I² = ${hetero.iSquared}%) — studies may not be measuring the same effect. Pooled estimate should be interpreted with caution.`)
  }
  if (tau2 > 0.5) {
    redFlags.push("Large between-study variance (τ² > 0.5) suggests substantial clinical and methodological diversity.")
  }

  // ── Forest plot ──
  const forestPlotData: ForestPlotEntry[] = weightedEffects.map((e) => ({
    paperId: e.paperId,
    label: e.label,
    effectSize: Math.round(e.effectSize * 1000) / 1000,
    ci95: [
      Math.round((e.effectSize - 1.96 * Math.sqrt(e.variance)) * 1000) / 1000,
      Math.round((e.effectSize + 1.96 * Math.sqrt(e.variance)) * 1000) / 1000,
    ],
    weight: e.weight,
  }))

  const forestPlotSvg = generateForestPlotSvg(forestPlotData, {
    pooledEffect: pooledResult.pooledEffect,
  })

  return {
    statisticalResult: {
      pooledEffect: pooledResult.pooledEffect,
      heterogeneity: hetero,
      studiesIncludedInMeta: usable.length,
      studiesExcluded: unusable,
      exclusionReason:
        unusable > 0
          ? `${unusable} studies excluded: insufficient quantitative data in abstracts.`
          : "All included studies contributed to meta-analysis.",
      forestPlotData,
      forestPlotSvg,
      failSafeN: fsN,
      limitations,
      publicationBiasNote:
        "Publication bias not assessed — requires full-text data extraction and accurate standard errors.",
      redFlags,
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildForestPlotData(
  usable: ExtractedData[],
  allData: ExtractedData[]
): ForestPlotEntry[] {
  return usable.map((d) => ({
    paperId: d.paperId,
    label: buildStudyLabel(d.paperId, allData),
    effectSize: d.effectSize!.value,
    ci95: d.effectSize!.ci95,
    weight: Math.round(100 / Math.max(usable.length, 1)),
  }))
}

function buildStudyLabel(paperId: string, _allData: ExtractedData[]): string {
  // paperId format: "pubmed_12345678" or "semantic_abc123" etc.
  // Use the ID as label for now; orchestrator will enrich with author/year
  return paperId.split("_").slice(-1)[0]?.slice(0, 20) ?? paperId.slice(0, 20)
}

function buildInsufficientDataNarrative(usableCount: number, totalCount: number): string {
  if (usableCount === 0) {
    return `None of the ${totalCount} included studies reported effect sizes in their abstracts. A quantitative meta-analysis could not be performed. This is common when studies report only categorical outcomes or descriptive statistics. Review the individual papers for qualitative synthesis.`
  }
  return `Only ${usableCount} of ${totalCount} included studies (${Math.round((usableCount / totalCount) * 100)}%) reported sufficient quantitative data in their abstracts for effect size calculation. The minimum required for a pooled meta-analysis is ${MIN_STUDIES_FOR_META} studies. Individual study effects are shown below without pooling.`
}
