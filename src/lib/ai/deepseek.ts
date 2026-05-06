// DeepSeek API is OpenAI-compatible — easy to swap to Claude or GPT later
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ""
const BASE_URL = "https://api.deepseek.com/v1"
const MODEL = "deepseek-chat"

interface Message {
  role: "system" | "user" | "assistant"
  content: string
}

export async function callAI(messages: Message[], temperature = 0.3): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured")
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`DeepSeek API error: ${res.status} ${error}`)
  }

  const data: { choices: Array<{ message: { content: string } }> } = await res.json()
  return data.choices[0]?.message?.content ?? ""
}
