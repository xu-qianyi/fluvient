import { YoutubeTranscript } from "youtube-transcript"
import { NextResponse } from "next/server"
import type { CefrLevel } from "@/data/cefr-words"

export interface TranscriptSegment {
  text: string
  startMs: number
  endMs: number
}

interface Thresholds {
  maxWords: number  // emergency cap — only break here if no punctuation found nearby
  maxMs: number     // time cap
  gapMs: number     // silence gap triggers a break
  minForSentence: number  // min words before we break at a sentence end (. ? !)
  minForPhrase: number    // min words before we break at a phrase end (, ; :)
}

// Sentence breaks are always preferred over phrase breaks.
// Emergency (maxWords) breaks look back for the last punctuation to avoid mid-phrase cuts.
const THRESHOLDS: Record<CefrLevel, Thresholds> = {
  a1: { maxWords: 8,  maxMs: 5_000,  gapMs: 300,  minForSentence: 2,  minForPhrase: 4  },
  a2: { maxWords: 12, maxMs: 7_000,  gapMs: 500,  minForSentence: 3,  minForPhrase: 6  },
  b1: { maxWords: 18, maxMs: 10_000, gapMs: 700,  minForSentence: 5,  minForPhrase: 10 },
  b2: { maxWords: 25, maxMs: 14_000, gapMs: 900,  minForSentence: 8,  minForPhrase: 15 },
  c1: { maxWords: 35, maxMs: 18_000, gapMs: 1200, minForSentence: 12, minForPhrase: 20 },
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n/g, " ")
    .trim()
}

function endsWithSentence(text: string): boolean {
  return /[.!?]['"]?\s*$/.test(text.trimEnd())
}

function endsWithPhrase(text: string): boolean {
  return /[,;:]['"]?\s*$/.test(text.trimEnd())
}

function wordCount(items: { text: string }[]): number {
  return items.reduce((n, it) => n + it.text.trim().split(/\s+/).length, 0)
}

function flushGroup(
  group: { text: string; offset: number; duration: number }[],
  segments: TranscriptSegment[]
) {
  if (!group.length) return
  const last = group[group.length - 1]
  segments.push({
    text: group.map((i) => decodeEntities(i.text)).join(" "),
    startMs: group[0].offset,
    endMs: last.offset + last.duration,
  })
}

type RawItem = { text: string; offset: number; duration: number }

// YouTube items sometimes contain multiple sentences in one entry, e.g.
// "I'm walking. Well, I'm out of breath."
// Split them at embedded sentence boundaries before grouping.
function splitAtEmbeddedSentences(items: RawItem[]): RawItem[] {
  const result: RawItem[] = []
  for (const item of items) {
    const parts = item.text.split(/(?<=[.!?])\s+(?=[A-Z"'])/g)
    if (parts.length === 1) {
      result.push(item)
    } else {
      const totalChars = item.text.replace(/\s+/g, " ").length
      let charPosition = 0
      for (const part of parts) {
        const startProportion = charPosition / totalChars
        const endProportion = (charPosition + part.length) / totalChars
        result.push({
          text: part,
          offset: item.offset + startProportion * item.duration,
          duration: Math.max(100, (endProportion - startProportion) * item.duration),
        })
        charPosition += part.length + 1
      }
    }
  }
  return result
}

function mergeShortSegments(segments: TranscriptSegment[], minWords = 4): TranscriptSegment[] {
  const result: TranscriptSegment[] = []
  for (const seg of segments) {
    const wc = seg.text.trim().split(/\s+/).length
    if (wc < minWords && result.length > 0) {
      const prev = result[result.length - 1]
      result[result.length - 1] = {
        text: prev.text + " " + seg.text,
        startMs: prev.startMs,
        endMs: seg.endMs,
      }
    } else {
      result.push(seg)
    }
  }
  return result
}

function groupIntoSegments(
  items: RawItem[],
  level: CefrLevel
): TranscriptSegment[] {
  const { maxWords, maxMs, gapMs, minForSentence, minForPhrase } = THRESHOLDS[level]
  const segments: TranscriptSegment[] = []
  let group: typeof items = []

  for (let i = 0; i < items.length; i++) {
    group.push(items[i])

    const wc = wordCount(group)
    const spanMs = items[i].offset + items[i].duration - group[0].offset
    const next = items[i + 1]
    const gap = next ? next.offset - (items[i].offset + items[i].duration) : Infinity
    const text = items[i].text.trim()

    const isSentenceEnd = endsWithSentence(text)
    const isPhraseEnd = endsWithPhrase(text)
    const isLongPause = gap > 2000  // very long pause always breaks
    const isPauseWithPunct = gap > gapMs && (isSentenceEnd || isPhraseEnd)

    if (
      (isSentenceEnd && wc >= minForSentence) ||
      (isPhraseEnd   && wc >= minForPhrase)   ||
      isLongPause                              ||
      isPauseWithPunct                         ||
      spanMs >= maxMs
    ) {
      flushGroup(group, segments)
      group = []
      continue
    }

    // Emergency: too many words and no natural break found yet.
    // Look back up to 6 items for the last sentence/phrase end and split there.
    if (wc >= maxWords) {
      let splitAt = -1
      const lookback = Math.min(6, group.length - 1)
      for (let b = group.length - 2; b >= group.length - 1 - lookback; b--) {
        const t = group[b].text.trim()
        if (endsWithSentence(t) || endsWithPhrase(t)) {
          splitAt = b
          break
        }
      }

      if (splitAt >= 0) {
        // Flush up to splitAt, keep the rest
        flushGroup(group.slice(0, splitAt + 1), segments)
        group = group.slice(splitAt + 1)
      } else {
        // No punctuation found — flush everything (last resort)
        flushGroup(group, segments)
        group = []
      }
    }
  }

  flushGroup(group, segments)
  return segments
}

const VALID_LEVELS: CefrLevel[] = ["a1", "a2", "b1", "b2", "c1"]

interface Params {
  params: Promise<{ videoId: string }>
}

export async function GET(req: Request, { params }: Params) {
  const { videoId } = await params
  const url = new URL(req.url)
  const rawLevel = url.searchParams.get("level") ?? "b1"
  const level: CefrLevel = VALID_LEVELS.includes(rawLevel as CefrLevel)
    ? (rawLevel as CefrLevel)
    : "b1"

  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId)
    const filtered = raw
      .map((item) => ({ ...item, text: item.text.replace(/\[.*?\]/g, "").trim() }))
      .filter((item) => item.text.length > 0)
    const items = splitAtEmbeddedSentences(filtered)
    const grouped = groupIntoSegments(items, level)
    const segments = mergeShortSegments(grouped)
    return NextResponse.json({ segments })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    const isNoTranscript =
      message.toLowerCase().includes("transcript") ||
      message.toLowerCase().includes("disabled")

    return NextResponse.json(
      { error: isNoTranscript ? "no_transcript" : "fetch_failed" },
      { status: isNoTranscript ? 404 : 500 }
    )
  }
}
