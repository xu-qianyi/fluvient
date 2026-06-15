import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createModel, getProviderFromHeader } from "@/lib/ai-provider"
import { z } from "zod"

export async function POST(req: Request) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 })

  const apiKey = (req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 })

  try {
    const { object } = await generateObject({
      model: createModel(apiKey, getProviderFromHeader(req)),
      schema: z.object({
        translation: z.string().describe("natural Chinese translation of the input text"),
      }),
      prompt: `Translate the following English text into natural, fluent Chinese. Output only the translation.\n\n"${text}"`,
    })
    return NextResponse.json(object)
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
