"use client"

import { tokenizeWithVocab } from "@/lib/vocab-highlight"
import type { VocabTerm } from "@/app/api/vocab/[videoId]/route"
import type { CefrLevel } from "@/data/cefr-words"
import { cn } from "@/lib/utils"

interface Props {
  text: string
  startMs: number
  isActive: boolean
  vocabTerms: VocabTerm[]
  cefrLevel: CefrLevel
  onSeek: (startMs: number) => void
  onWordClick: (term: string, vocabTerm: VocabTerm, rect: DOMRect) => void
  searchQuery?: string
  isCurrentMatch?: boolean
  isQuoted?: boolean
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  return `${m}:${String(sec).padStart(2, "0")}`
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightMatches(text: string, query: string): React.ReactNode {
  const re = new RegExp(`(${escapeRegExp(query)})`, "gi")
  const parts = text.split(re)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <mark key={i} className="bg-yellow-200 text-stone-900 rounded-sm">{part}</mark>
      : part
  )
}

export function TranscriptSegment({ text, startMs, isActive, vocabTerms, cefrLevel, onSeek, onWordClick, searchQuery, isCurrentMatch, isQuoted }: Props) {
  const tokens = tokenizeWithVocab(text, vocabTerms, cefrLevel)
  const query = searchQuery?.trim() ?? ""

  return (
    <div
      onClick={() => {
        if (window.getSelection()?.toString().trim()) return
        onSeek(startMs)
      }}
      className={cn(
        "group flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer",
        isQuoted ? "bg-green-50" : isActive ? "bg-stone-100" : "hover:bg-stone-50",
        isCurrentMatch && "ring-1 ring-amber-400"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onSeek(startMs) }}
        className="shrink-0 mt-0.5 text-[11px] text-stone-400 hover:text-stone-900 font-mono tabular-nums transition-colors select-none"
      >
        {formatTime(startMs)}
      </button>

      <p className={cn(
        "text-sm leading-relaxed",
        isActive ? "text-stone-900 font-medium" : "text-stone-500",
        isQuoted && "underline decoration-green-500 decoration-2 underline-offset-2"
      )}>
        {tokens.map((token, i) => {
          if (token.type === "text") return <span key={i}>{query ? highlightMatches(token.text, query) : token.text}</span>
          return (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                onWordClick(token.text, token.term, (e.currentTarget as HTMLElement).getBoundingClientRect())
              }}
              className={cn(
                "relative inline rounded px-0.5 transition-colors cursor-pointer",
                token.term.term.includes(" ")
                  ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                  : "bg-blue-100 text-blue-900 hover:bg-blue-200"
              )}
            >
              {query ? highlightMatches(token.text, query) : token.text}
            </button>
          )
        })}
      </p>
    </div>
  )
}
