import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { runWithModelFallback, getProviderFromHeader } from "@/lib/ai-provider"
import { createClient } from "@/lib/supabase/server"
import { createHash } from "crypto"
import { z } from "zod"

const hashText = (s: string) => createHash("sha256").update(s).digest("hex")

export async function POST(req: Request) {
  const { texts }: { texts: string[] } = await req.json()
  if (!texts?.length) return NextResponse.json({ error: "missing texts" }, { status: 400 })

  const batch = texts.slice(0, 20)
  const hashes = batch.map(hashText)
  const result: Record<string, string> = {} // source text -> zh

  // ── L1: DB cache (shared across videos / users / levels) ──────────────────
  let supabase
  try {
    supabase = await createClient()
    const { data } = await supabase
      .from("segment_translations")
      .select("text_hash, zh")
      .in("text_hash", hashes)
    if (data) {
      const byHash = new Map(data.map((r) => [r.text_hash, r.zh as string]))
      batch.forEach((t, i) => {
        const zh = byHash.get(hashes[i])
        if (zh) result[t] = zh
      })
    }
  } catch {
    // DB lookup non-critical — fall through to AI for everything
  }

  const missing = [...new Set(batch.filter((t) => !(t in result)))]

  // ── L2: AI for cache misses only ──────────────────────────────────────────
  if (missing.length) {
    const apiKey = req.headers.get("X-User-Api-Key") || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 })

    try {
      const { object } = await runWithModelFallback(apiKey, getProviderFromHeader(req), (model) =>
        generateObject({
        model,
        maxRetries: 0,
        schema: z.object({
          translations: z
            .array(z.string())
            .describe("Chinese translations in the exact same order as the input sentences"),
        }),
        prompt: `Translate each numbered English sentence into natural, fluent Chinese. Return exactly ${missing.length} translations in the same order. Keep each translation concise.\n\n${missing.map((t, i) => `${i + 1}. "${t}"`).join("\n")}`,
        }),
      )
      missing.forEach((t, i) => {
        const zh = object.translations[i]
        if (zh) result[t] = zh
      })

      // Persist new translations (non-critical, fire-and-forget)
      if (supabase) {
        const rows = missing
          .filter((t) => result[t])
          .map((t) => ({ text_hash: hashText(t), source_text: t, zh: result[t] }))
        if (rows.length) {
          supabase
            .from("segment_translations")
            .upsert(rows, { onConflict: "text_hash", ignoreDuplicates: true })
            .then(() => {}, () => { /* non-critical */ })
        }
      }
    } catch {
      return NextResponse.json({ error: "ai_failed" }, { status: 500 })
    }
  }

  const translations = batch.map((t) => result[t] ?? "")
  return NextResponse.json({ translations })
}
