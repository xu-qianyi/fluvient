import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createModel, getProviderFromHeader } from "@/lib/ai-provider"
import { z } from "zod"

export async function POST(req: Request) {
  const { texts }: { texts: string[] } = await req.json()
  if (!texts?.length) return NextResponse.json({ error: "missing texts" }, { status: 400 })

  const apiKey = req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 })

  const batch = texts.slice(0, 20)

  try {
    const { object } = await generateObject({
      model: createModel(apiKey, getProviderFromHeader(req)),
      maxRetries: 0,
      schema: z.object({
        translations: z
          .array(z.string())
          .describe("Chinese translations in the exact same order as the input sentences"),
      }),
      prompt: `Translate each numbered English sentence into natural, fluent Chinese. Return exactly ${batch.length} translations in the same order. Keep each translation concise.\n\n${batch.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`,
    })
    const translations = batch.map((_, i) => object.translations[i] ?? "")
    return NextResponse.json({ translations })
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
