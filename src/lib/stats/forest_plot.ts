import type { ForestPlotEntry, PooledEffect } from "@/types"

interface ForestPlotOptions {
  width?: number
  rowHeight?: number
  pooledEffect?: PooledEffect
}

/**
 * Generates an SVG string representing a forest plot.
 * No charting library — pure SVG for zero bundle cost.
 */
export function generateForestPlotSvg(
  entries: ForestPlotEntry[],
  options: ForestPlotOptions = {}
): string {
  if (entries.length === 0) return ""

  const {
    width = 700,
    rowHeight = 32,
    pooledEffect,
  } = options

  const LABEL_WIDTH = 180
  const WEIGHT_WIDTH = 50
  const PLOT_WIDTH = width - LABEL_WIDTH - WEIGHT_WIDTH - 20
  const PLOT_X = LABEL_WIDTH + 10
  const HEADER_H = 36
  const FOOTER_H = pooledEffect ? 48 : 8
  const totalRows = entries.length
  const height = HEADER_H + totalRows * rowHeight + FOOTER_H + 24

  // Determine axis range — pad 20% beyond max CI
  const allValues = entries.flatMap((e) => [e.effectSize, e.ci95[0], e.ci95[1]])
  if (pooledEffect) allValues.push(pooledEffect.value, pooledEffect.ci95[0], pooledEffect.ci95[1])
  const minVal = Math.min(...allValues, -0.5)
  const maxVal = Math.max(...allValues, 0.5)
  const range = maxVal - minVal
  const axisMin = minVal - range * 0.1
  const axisMax = maxVal + range * 0.1

  const toX = (val: number): number =>
    PLOT_X + ((val - axisMin) / (axisMax - axisMin)) * PLOT_WIDTH

  const nullX = toX(0)

  const lines: string[] = []

  // ── Header ──
  lines.push(`<text x="${LABEL_WIDTH / 2}" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#374151">Study</text>`)
  lines.push(`<text x="${PLOT_X + PLOT_WIDTH / 2}" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#374151">Effect Size (95% CI)</text>`)
  lines.push(`<text x="${PLOT_X + PLOT_WIDTH + WEIGHT_WIDTH / 2 + 10}" y="20" text-anchor="middle" font-size="11" font-weight="bold" fill="#374151">Weight%</text>`)
  lines.push(`<line x1="${LABEL_WIDTH}" y1="26" x2="${PLOT_X + PLOT_WIDTH + WEIGHT_WIDTH + 10}" y2="26" stroke="#d1d5db" stroke-width="1"/>`)

  // ── Null line ──
  lines.push(`<line x1="${nullX}" y1="${HEADER_H}" x2="${nullX}" y2="${height - FOOTER_H}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,3"/>`)

  // ── Study rows ──
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const y = HEADER_H + i * rowHeight + rowHeight / 2

    const ciX1 = toX(entry.ci95[0])
    const ciX2 = toX(entry.ci95[1])
    const esX = toX(entry.effectSize)

    // Size of square proportional to weight (min 4, max 12)
    const sqSize = Math.max(4, Math.min(12, (entry.weight / 100) * 80 + 4))

    // CI line
    lines.push(`<line x1="${ciX1}" y1="${y}" x2="${ciX2}" y2="${y}" stroke="#3b82f6" stroke-width="1.5"/>`)
    // CI end caps
    lines.push(`<line x1="${ciX1}" y1="${y - 4}" x2="${ciX1}" y2="${y + 4}" stroke="#3b82f6" stroke-width="1.5"/>`)
    lines.push(`<line x1="${ciX2}" y1="${y - 4}" x2="${ciX2}" y2="${y + 4}" stroke="#3b82f6" stroke-width="1.5"/>`)
    // Effect square
    lines.push(`<rect x="${esX - sqSize / 2}" y="${y - sqSize / 2}" width="${sqSize}" height="${sqSize}" fill="#3b82f6" opacity="0.85"/>`)

    // Label
    const labelText = entry.label.length > 22 ? entry.label.slice(0, 21) + "…" : entry.label
    lines.push(`<text x="${LABEL_WIDTH - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#374151">${escapeXml(labelText)}</text>`)

    // Effect size value label
    const esLabel = `${entry.effectSize.toFixed(2)} [${entry.ci95[0].toFixed(2)}, ${entry.ci95[1].toFixed(2)}]`
    lines.push(`<text x="${PLOT_X + PLOT_WIDTH + 6}" y="${y + 4}" font-size="9" fill="#6b7280">${escapeXml(esLabel)}</text>`)

    // Weight
    lines.push(`<text x="${PLOT_X + PLOT_WIDTH + WEIGHT_WIDTH / 2 + 10}" y="${y + 4}" text-anchor="middle" font-size="10" fill="#374151">${entry.weight}%</text>`)

    // Zebra stripe
    if (i % 2 === 0) {
      lines.unshift(`<rect x="0" y="${HEADER_H + i * rowHeight}" width="${width}" height="${rowHeight}" fill="#f9fafb"/>`)
    }
  }

  // ── Pooled effect diamond ──
  if (pooledEffect) {
    const diamondY = HEADER_H + totalRows * rowHeight + 8
    const dY = 12
    const dX1 = toX(pooledEffect.ci95[0])
    const dX2 = toX(pooledEffect.ci95[1])
    const dCenter = toX(pooledEffect.value)

    // Separator line
    lines.push(`<line x1="${LABEL_WIDTH}" y1="${diamondY - 4}" x2="${PLOT_X + PLOT_WIDTH}" y2="${diamondY - 4}" stroke="#d1d5db" stroke-width="1"/>`)

    // Diamond
    lines.push(`<polygon points="${dX1},${diamondY} ${dCenter},${diamondY - dY} ${dX2},${diamondY} ${dCenter},${diamondY + dY}"
      fill="#1d4ed8" opacity="0.9"/>`)

    // Pooled label
    lines.push(`<text x="${LABEL_WIDTH - 6}" y="${diamondY + 4}" text-anchor="end" font-size="10" font-weight="bold" fill="#1d4ed8">Pooled Effect</text>`)

    // Pooled values
    const pLabel = `${pooledEffect.value.toFixed(2)} [${pooledEffect.ci95[0].toFixed(2)}, ${pooledEffect.ci95[1].toFixed(2)}] p=${pooledEffect.pValue.toFixed(3)}`
    lines.push(`<text x="${PLOT_X + PLOT_WIDTH + 6}" y="${diamondY + 4}" font-size="9" font-weight="bold" fill="#1d4ed8">${escapeXml(pLabel)}</text>`)
  }

  // ── Axis labels ──
  const axisY = height - 10
  lines.push(`<text x="${nullX}" y="${axisY}" text-anchor="middle" font-size="9" fill="#9ca3af">0</text>`)
  lines.push(`<text x="${toX(axisMin + range * 0.1)}" y="${axisY}" text-anchor="start" font-size="9" fill="#9ca3af">Favors control</text>`)
  lines.push(`<text x="${toX(axisMax - range * 0.1)}" y="${axisY}" text-anchor="end" font-size="9" fill="#9ca3af">Favors intervention</text>`)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-sans-serif,system-ui,sans-serif">
  <rect width="${width}" height="${height}" fill="white" rx="8"/>
  ${lines.join("\n  ")}
</svg>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
