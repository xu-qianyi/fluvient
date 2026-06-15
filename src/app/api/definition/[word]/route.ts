import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createModel, getProviderFromHeader } from "@/lib/ai-provider"
import { z } from "zod"

export interface WordDefinition {
  word: string
  pos: string
  zh_definition: string
  example: string
  zh_example: string
}

// In-memory cache — resets on cold start, fine for MVP
const cache = new Map<string, WordDefinition>()

const schema = z.object({
  pos: z.string().describe("part of speech, e.g. adj., n., v."),
  zh_definition: z.string().describe("concise Chinese definition, 2–8 characters"),
  example: z.string().describe("one natural English example sentence using the word"),
  zh_example: z.string().describe("Chinese translation of the example sentence"),
})

interface Params {
  params: Promise<{ word: string }>
}

export async function GET(req: Request, { params }: Params) {
  const { word } = await params
  const lower = word.toLowerCase()

  if (cache.has(lower)) {
    return NextResponse.json(cache.get(lower))
  }

  const apiKey = (req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 })
  }

  try {
    const { object } = await generateObject({
      model: createModel(apiKey, getProviderFromHeader(req)),
      maxRetries: 0,
      schema,
      prompt: `You are a concise English-Chinese dictionary for Chinese learners of English.
Define the word "${lower}" with:
- pos: the most common part of speech (abbreviated, e.g. "adj.", "n.", "v.", "adv.")
- zh_definition: a short Chinese meaning, plain Chinese no brackets, 2-8 characters
- example: one natural, real-world example sentence that clearly shows the word's meaning
- zh_example: accurate Chinese translation of that example sentence`,
    })

    const result: WordDefinition = { word: lower, ...object }
    cache.set(lower, result)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
