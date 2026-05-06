import type { Paper } from "@/types"

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  if (longer.length === 0) return 1
  return (longer.length - editDistance(longer, shorter)) / longer.length
}

function editDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

export function deduplicatePapers(papers: Paper[]): Paper[] {
  const seen = new Map<string, Paper>()
  const result: Paper[] = []

  for (const paper of papers) {
    // Prefer DOI-based dedup (exact)
    if (paper.doi) {
      const doiKey = paper.doi.toLowerCase()
      if (seen.has(doiKey)) {
        // Merge: keep the version with more data (e.g. abstract)
        const existing = seen.get(doiKey)!
        if (!existing.abstract && paper.abstract) {
          existing.abstract = paper.abstract
        }
        if (!existing.openAccessUrl && paper.openAccessUrl) {
          existing.openAccessUrl = paper.openAccessUrl
        }
        continue
      }
      seen.set(doiKey, paper)
      result.push(paper)
      continue
    }

    // Title similarity fallback
    const titleKey = normalizeTitle(paper.title)
    let isDuplicate = false

    for (const [key] of seen) {
      if (key.startsWith("title_") && similarity(titleKey, key.slice(6)) > 0.9) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      seen.set(`title_${titleKey}`, paper)
      result.push(paper)
    }
  }

  return result
}
