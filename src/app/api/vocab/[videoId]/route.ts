import { YoutubeTranscript } from "youtube-transcript"
import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createModel, getProviderFromHeader } from "@/lib/ai-provider"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export interface VocabTerm {
  term: string
  definition_zh: string
  level: string
  pos: string
  example: string
  zh_example: string
}

const schema = z.object({
  terms: z.array(z.object({
    term: z.string().describe("the exact word or phrase as it appears in the transcript, lowercase"),
    definition_zh: z.string().describe("concise Chinese definition, 4-12 characters"),
    level: z.enum(["a1", "a2", "b1", "b2", "c1"]).describe("CEFR difficulty level of this term"),
    pos: z.string().describe("part of speech abbreviation: n. / v. / adj. / adv. / prep. / phr. (use phr. for multi-word phrases)"),
    example: z.string().describe("one natural English example sentence using this term, ideally similar to the video context"),
    zh_example: z.string().describe("Chinese translation of the example sentence"),
  })),
})

// L1: in-process memory cache (fast, resets on restart)
const memCache = new Map<string, VocabTerm[]>()

const VALID_LEVELS = ["a1", "a2", "b1", "b2", "c1"]

interface Params {
  params: Promise<{ videoId: string }>
}

export async function GET(req: Request, { params }: Params) {
  const { videoId } = await params
  const url = new URL(req.url)
  const rawLevel = url.searchParams.get("level") ?? "b1"
  const level = VALID_LEVELS.includes(rawLevel) ? rawLevel : "b1"
  const cacheKey = `${videoId}:${level}`

  // L1 hit
  if (memCache.has(cacheKey)) {
    return NextResponse.json({ terms: memCache.get(cacheKey) })
  }

  // L2: database (persists across restarts and deployments)
  try {
    const supabase = await createClient()
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("youtube_id", videoId)
      .single()

    if (video) {
      const { data: note } = await supabase
        .from("study_notes")
        .select("content")
        .eq("video_id", video.id)
        .eq("cefr_level", level)
        .single()

      if (note?.content) {
        const terms = (note.content as { terms: VocabTerm[] }).terms
        memCache.set(cacheKey, terms)
        return NextResponse.json({ terms })
      }
    }
  } catch {
    // DB lookup non-critical — fall through to AI
  }

  const apiKey = (req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 })
  }

  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId)
    const fullText = raw
      .map((item) => item.text.replace(/\[.*?\]/g, "").trim())
      .filter(Boolean)
      .join(" ")

    const { object } = await generateObject({
      model: createModel(apiKey, getProviderFromHeader(req)),
      maxRetries: 0,
      schema,
      prompt: `You are an English teacher for Chinese learners at ${level.toUpperCase()} level.

Analyze this video transcript and pick 10–15 words and phrases most worth learning for a ${level.toUpperCase()} student.

Rules:
- Mix BOTH single words (at least 5) AND multi-word phrases (at least 4). Do not return only phrases.
- Single words: pick vocabulary that is useful but not too basic — words like "collagen", "inspire", "launch", "occasionally", "basically" are good candidates
- Multi-word phrases — include ALL of the following types that appear in the transcript:
  1. Collocations & phrasal verbs: "take a break", "get out of", "look forward to"
  2. Fixed adverbial expressions: "in advance", "as a result", "at this point", "in terms of", "when it comes to"
  3. Common prepositional / structural phrases that Chinese learners often get wrong or find unnatural: "in this case", "on the other hand", "at the same time", "by the way"
  4. Noun phrases with non-obvious combinations: "common misconception", "turning point", "key takeaway"
- Each "term" must appear verbatim (case-insensitive) in the transcript
- definition_zh should be natural Chinese, not a dictionary gloss

Transcript:
${fullText.slice(0, 8000)}`,
    })

    memCache.set(cacheKey, object.terms)

    // Persist to DB (non-critical)
    createClient().then(async (supabase) => {
      const { data: video } = await supabase
        .from("videos")
        .select("id")
        .eq("youtube_id", videoId)
        .single()
      if (!video) return
      await supabase
        .from("study_notes")
        .upsert(
          { video_id: video.id, cefr_level: level, content: { terms: object.terms } },
          { onConflict: "video_id,cefr_level" }
        )
    }).catch(() => { /* non-critical */ })

    return NextResponse.json({ terms: object.terms })
  } catch (err) {
    console.error("[vocab]", err)
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
