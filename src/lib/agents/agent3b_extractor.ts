import type {
  Paper,
  PICOSProtocol,
  ExtractedData,
  ExtractedValue,
  ExtractedGroupValues,
  ExtractedEffectSize,
  DataConfidence,
  Agent3bResult,
} from "@/types"
import { callAI } from "@/lib/ai/deepseek"
import { parseJSON } from "@/lib/ai/parse"

// ---------------------------------------------------------------------------
// extractData — Agent 3b
// ---------------------------------------------------------------------------
export async function extractData(
  papers: Paper[],
  protocol: PICOSProtocol
): Promise<Agent3bResult> {
  const extractedData: ExtractedData[] = []
  const BATCH_SIZE = 4

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE)
    const batchResults = await extractDataBatch(batch, protocol)
    extractedData.push(...batchResults)
  }

  // Calculate extraction completeness: % of papers with at least one extracted value
  const papersWithData = extractedData.filter(
    (d) =>
      (d.sampleSize?.total?.confidence !== "not_reported") ||
      (d.effectSize?.confidence !== "not_reported") ||
      (d.pValue?.confidence !== "not_reported")
  ).length

  const extractionCompleteness =
    extractedData.length > 0
      ? Math.round((papersWithData / extractedData.length) * 100)
      : 0

  return { extractedData, extractionCompleteness }
}

async function extractDataBatch(
  batch: Paper[],
  protocol: PICOSProtocol
): Promise<ExtractedData[]> {
  const papersText = batch
    .map((p) => {
      const abstract = p.abstractText ?? p.abstract ?? "No abstract available"
      return `ID: ${p.id}
Title: ${p.title}
Year: ${p.year ?? "unknown"}
Abstract: ${abstract}`
    })
    .join("\n\n---\n\n")

  const response = await callAI(
    [
      {
        role: "system",
        content: `You are a clinical data extractor for a meta-analysis.
Extract quantitative data from paper abstracts for: ${protocol.outcome}.

CRITICAL RULES — you MUST follow exactly:
1. ONLY extract values explicitly stated in the abstract or directly calculable from stated values.
2. For every extracted value, provide the exact quote from the abstract that supports it.
3. Use confidence: "extracted" = literally in abstract, "derived" = calculated from stated values, "not_reported" = absent.
4. NEVER invent or estimate values. If a value is not in the abstract, use "not_reported".
5. Accuracy is more important than completeness — "not_reported" is the correct honest answer when data is missing.
Return valid JSON only — no markdown, no code fences.`,
      },
      {
        role: "user",
        content: `Extract quantitative data from these abstracts. Target outcomes: ${protocol.outcome}

Papers:
${papersText}

Return JSON array — one object per paper:
[
  {
    "paperId": "exact paper id",
    "sampleSize": {
      "total": { "value": 0, "confidence": "extracted|derived|not_reported", "sourceQuote": "exact quote or empty string" },
      "group1": { "value": 0, "confidence": "extracted|derived|not_reported", "sourceQuote": "..." },
      "group2": { "value": 0, "confidence": "extracted|derived|not_reported", "sourceQuote": "..." }
    },
    "means": {
      "group1": 0,
      "group2": 0,
      "confidence": "extracted|derived|not_reported",
      "sourceQuote": "..."
    },
    "sds": {
      "group1": 0,
      "group2": 0,
      "confidence": "extracted|derived|not_reported",
      "sourceQuote": "..."
    },
    "effectSize": {
      "value": 0,
      "type": "SMD|Hedges_g|Cohen_d|OR|RR|other",
      "ci95": [0, 0],
      "confidence": "extracted|derived|not_reported",
      "sourceQuote": "..."
    },
    "pValue": {
      "value": 0,
      "confidence": "extracted|derived|not_reported",
      "sourceQuote": "..."
    },
    "outcomesMeasured": ["outcome1", "outcome2"],
    "sourceQuotes": [
      { "field": "field name", "quote": "exact quote from abstract" }
    ]
  }
]

IMPORTANT: If any value is not in the abstract, set confidence to "not_reported" and sourceQuote to "".
Do not include null values — use the not_reported pattern consistently.`,
      },
    ],
    0.1
  )

  try {
    type RawExtraction = {
      paperId: string
      sampleSize?: {
        total?: { value: number; confidence: string; sourceQuote: string }
        group1?: { value: number; confidence: string; sourceQuote: string }
        group2?: { value: number; confidence: string; sourceQuote: string }
      }
      means?: { group1?: number; group2?: number; confidence: string; sourceQuote: string }
      sds?: { group1?: number; group2?: number; confidence: string; sourceQuote: string }
      effectSize?: { value: number; type: string; ci95: number[]; confidence: string; sourceQuote: string }
      pValue?: { value: number; confidence: string; sourceQuote: string }
      outcomesMeasured?: string[]
      sourceQuotes?: { field: string; quote: string }[]
    }

    const parsed = parseJSON<RawExtraction[]>(response)

    return batch.map((paper) => {
      const found = parsed.find((r) => r.paperId === paper.id)
      if (!found) return buildFallbackExtraction(paper.id)

      const toExtractedValue = (raw?: {
        value: number
        confidence: string
        sourceQuote: string
      }): ExtractedValue | undefined => {
        if (!raw) return undefined
        return {
          value: raw.value ?? 0,
          confidence: (raw.confidence as DataConfidence) ?? "not_reported",
          sourceQuote: raw.sourceQuote ?? "",
        }
      }

      return {
        paperId: paper.id,
        sampleSize: found.sampleSize
          ? {
              total: toExtractedValue(found.sampleSize.total),
              group1: toExtractedValue(found.sampleSize.group1),
              group2: toExtractedValue(found.sampleSize.group2),
            }
          : undefined,
        means: found.means
          ? ({
              group1: found.means.group1,
              group2: found.means.group2,
              confidence: (found.means.confidence as DataConfidence) ?? "not_reported",
              sourceQuote: found.means.sourceQuote ?? "",
            } as ExtractedGroupValues)
          : undefined,
        sds: found.sds
          ? ({
              group1: found.sds.group1,
              group2: found.sds.group2,
              confidence: (found.sds.confidence as DataConfidence) ?? "not_reported",
              sourceQuote: found.sds.sourceQuote ?? "",
            } as ExtractedGroupValues)
          : undefined,
        effectSize: found.effectSize
          ? ({
              value: found.effectSize.value ?? 0,
              type: (found.effectSize.type as ExtractedEffectSize["type"]) ?? "other",
              ci95: (found.effectSize.ci95 as [number, number]) ?? [0, 0],
              confidence: (found.effectSize.confidence as DataConfidence) ?? "not_reported",
              sourceQuote: found.effectSize.sourceQuote ?? "",
            } as ExtractedEffectSize)
          : undefined,
        pValue: toExtractedValue(found.pValue),
        outcomesMeasured: found.outcomesMeasured ?? [],
        sourceQuotes: found.sourceQuotes ?? [],
      }
    })
  } catch {
    return batch.map((p) => buildFallbackExtraction(p.id))
  }
}

function buildFallbackExtraction(paperId: string): ExtractedData {
  return {
    paperId,
    outcomesMeasured: [],
    sourceQuotes: [{ field: "error", quote: "Data extraction failed — abstract parsing error" }],
  }
}
