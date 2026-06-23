// One-time backfill of videos.cefr_level for rows created before the level
// feature. Run AFTER migration 004:  npx tsx scripts/backfill-levels.ts
import { readFileSync } from "node:fs"
import { YoutubeTranscript } from "youtube-transcript"
import { generateObject } from "ai"
import { z } from "zod"
import { runWithModelFallback } from "@/lib/ai-provider"
import { createClient } from "@supabase/supabase-js"

// Load .env.local (tsx doesn't do this automatically).
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const { data: videos } = await sb.from("videos").select("id, youtube_id, cefr_level")
  for (const v of videos ?? []) {
    if (v.cefr_level) {
      console.log(`${v.youtube_id}  已有 ${v.cefr_level}，跳过`)
      continue
    }
    try {
      const raw = await YoutubeTranscript.fetchTranscript(v.youtube_id)
      const text = raw
        .map((r) => r.text.replace(/\[.*?\]/g, "").trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 8000)
      const { object } = await runWithModelFallback(process.env.GOOGLE_GENERATIVE_AI_API_KEY!, "google", (model) =>
        generateObject({
          model,
          schema: z.object({ video_level: z.enum(["a1", "a2", "b1", "b2", "c1"]) }),
          prompt: `Judge the OVERALL CEFR difficulty of this video for a listener, based on vocabulary, sentence complexity and speaking pace.\n\nTranscript:\n${text}`,
        }),
      )
      await sb.from("videos").update({ cefr_level: object.video_level }).eq("id", v.id)
      console.log(`${v.youtube_id}  => ${object.video_level}`)
    } catch (e) {
      console.log(`${v.youtube_id}  失败: ${e}`)
    }
  }
}

main()
