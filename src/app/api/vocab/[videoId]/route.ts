import { YoutubeTranscript } from "youtube-transcript"
import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { createModel, getProviderFromHeader } from "@/lib/ai-provider"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getAdminClient } from "@/lib/supabase/admin"
import { fetchPhonetic } from "@/lib/dictionary"

export interface VocabTerm {
  term: string
  definition_zh: string
  level: string
  pos: string
  example: string
  zh_example: string
  phonetic?: string
}

// 表达锦囊: a functional expression organized by communicative intent — teaches
// the learner to actively USE a chunk, not just recognize it.
export interface ExpressionCard {
  scenario_zh: string
  pattern: string
  video_quote: string
  transfers: { en: string; zh: string }[]
  register_zh: string
}

const schema = z.object({
  video_level: z.enum(["a1", "a2", "b1", "b2", "c1"]).describe(
    "the OVERALL CEFR difficulty of the whole video for a listener — based on vocabulary, sentence complexity and speaking pace. Judge the video itself, independent of the target student level mentioned above."
  ),
  terms: z.array(z.object({
    term: z.string().describe("the exact word or phrase as it appears in the transcript, lowercase"),
    definition_zh: z.string().describe("concise Chinese definition, 4-12 characters"),
    level: z.enum(["a1", "a2", "b1", "b2", "c1"]).describe("CEFR difficulty level of this term"),
    pos: z.string().describe("part of speech abbreviation: n. / v. / adj. / adv. / prep. / phr. (use phr. for multi-word phrases)"),
    example: z.string().describe("one natural English example sentence using this term, ideally similar to the video context"),
    zh_example: z.string().describe("Chinese translation of the example sentence"),
  })),
  expressions: z.array(z.object({
    scenario_zh: z.string().describe("the real-life communicative scenario in natural Chinese, e.g. 夸别人事情做得漂亮"),
    pattern: z.string().describe("a reusable sentence frame with a ___ slot, e.g. 'You did a great job (on ___).'"),
    video_quote: z.string().describe("ONE short sentence (≤ 25 words) copied verbatim from the transcript (must be a case-insensitive substring of it) — the single sentence where this expression appears. Never multiple sentences or a paragraph."),
    transfers: z.array(z.object({
      en: z.string().describe("a natural English sentence applying the SAME expression in a DIFFERENT everyday scenario"),
      zh: z.string().describe("Chinese translation of the English sentence"),
    })).min(1).max(2),
    register_zh: z.string().describe("a short Chinese note on tone/formality and who you'd say it to"),
  })).min(2).max(4).describe("3 functional expressions worth learning to actively use"),
})

interface CachedNote {
  terms: VocabTerm[]
  expressions: ExpressionCard[]
}

// L1: in-process memory cache (fast, resets on restart)
const memCache = new Map<string, CachedNote>()

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
    return NextResponse.json(memCache.get(cacheKey))
  }

  // Old cached notes (pre-表达锦囊) only have `terms`. We remember them here so
  // that if regeneration isn't possible (no API key) we can still serve the
  // vocab, and otherwise fall through to regenerate so old videos get 表达锦囊 too.
  let staleTerms: VocabTerm[] | null = null

  // L2: database (persists across restarts and deployments). Prefer the
  // service-role client so reads/writes work for anonymous viewers too (the
  // study_notes RLS insert policy requires auth); fall back to the SSR client.
  try {
    const supabase = getAdminClient() ?? (await createClient())
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
        const content = note.content as { terms: VocabTerm[]; expressions?: ExpressionCard[] }
        // Fully-formed cache (has 表达锦囊) — serve it. Old notes without
        // expressions fall through to regenerate (老视频也补上).
        if (content.expressions?.length) {
          const result: CachedNote = { terms: content.terms, expressions: content.expressions }
          memCache.set(cacheKey, result)
          return NextResponse.json(result)
        }
        staleTerms = content.terms ?? null
      }
    }
  } catch {
    // DB lookup non-critical — fall through to AI
  }

  const apiKey = (req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (!apiKey) {
    // Can't regenerate — serve the old vocab (without 表达锦囊) rather than fail.
    if (staleTerms) {
      return NextResponse.json({ terms: staleTerms, expressions: [] })
    }
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

Also pick 3 FUNCTIONAL EXPRESSIONS for "expressions" — useful "chunks" organized by communicative INTENT (e.g. praising someone, declining politely, expressing surprise, making a suggestion) that a learner should learn to actively USE, not just recognize. For each:
- scenario_zh: the real-life situation in natural Chinese
- pattern: a reusable sentence frame with a ___ slot (not a fixed sentence)
- video_quote: the EXACT single sentence from the transcript (verbatim, case-insensitive substring) where this expression is used — ONE sentence only (≤ 25 words), never a paragraph or multiple sentences
- transfers: 1–2 example sentences that apply the SAME expression in a DIFFERENT everyday scenario, each with a Chinese translation
- register_zh: a short note on tone/formality and who you'd say it to
Pick expressions that are genuinely transferable and high-value — quality over quantity.

Transcript:
${fullText.slice(0, 8000)}`,
    })

    const phonetics = await Promise.all(object.terms.map((t) => fetchPhonetic(t.term)))
    const terms: VocabTerm[] = object.terms.map((t, i) => ({
      ...t, ...(phonetics[i] ? { phonetic: phonetics[i]! } : {}),
    }))
    const expressions: ExpressionCard[] = object.expressions ?? []
    const result: CachedNote = { terms, expressions }

    memCache.set(cacheKey, result)

    // Persist to DB (non-critical). Service-role client bypasses the
    // auth-only insert policy so the cache fills for anonymous viewers too.
    ;(async () => {
      const supabase = getAdminClient() ?? (await createClient())
      const { data: video } = await supabase
        .from("videos")
        .select("id, cefr_level")
        .eq("youtube_id", videoId)
        .single()
      if (!video) return
      await supabase
        .from("study_notes")
        .upsert(
          { video_id: video.id, cefr_level: level, content: { terms, expressions } },
          { onConflict: "video_id,cefr_level" }
        )
      // Store the video's overall difficulty once (the AI judged it above).
      // Only set when missing so it stays stable across learner levels.
      if (!video.cefr_level) {
        await supabase.from("videos").update({ cefr_level: object.video_level }).eq("id", video.id)
      }
    })().catch(() => { /* non-critical */ })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[vocab]", err)
    // Regeneration failed. If we have old (pre-表达锦囊) cached vocab, serve it
    // rather than erroring out — the learner keeps their words, just without the
    // expression cards until a later successful run.
    if (staleTerms) {
      return NextResponse.json({ terms: staleTerms, expressions: [] })
    }
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
