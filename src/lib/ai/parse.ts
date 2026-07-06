// DeepSeek (and other LLMs) sometimes wrap JSON in markdown code fences.
// This strips them before parsing.
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
  return JSON.parse(cleaned) as T
}
