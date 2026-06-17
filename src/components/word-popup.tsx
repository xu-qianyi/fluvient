"use client"

import { useEffect, useRef, useState } from "react"
import type { WordDefinition } from "@/app/api/definition/[word]/route"
import type { VocabTerm } from "@/app/api/vocab/[videoId]/route"
import { withUserApiKey } from "@/lib/user-api-key"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

interface Props {
  term: string
  prefilled?: VocabTerm
  anchorRect: DOMRect
  onClose: () => void
  youtubeId?: string
  onSaved?: (term: VocabTerm) => void
  onExampleReady?: (term: VocabTerm) => void
}

type DetailState =
  | { status: "loading" }
  | { status: "ok"; data: WordDefinition }
  | { status: "error" }

type SaveState = "idle" | "saving" | "saved" | "error"

const clientCache = new Map<string, WordDefinition>()

const LS_PREFIX = "echolingo:def:"

function lsGet(word: string): WordDefinition | null {
  try { const raw = localStorage.getItem(LS_PREFIX + word); return raw ? JSON.parse(raw) : null }
  catch { return null }
}

function lsSet(word: string, def: WordDefinition) {
  try { localStorage.setItem(LS_PREFIX + word, JSON.stringify(def)) }
  catch { /* localStorage full or unavailable */ }
}

export function WordPopup({ term, prefilled, anchorRect, onClose, youtubeId, onSaved, onExampleReady }: Props) {
  const { t } = useLanguage()
  const ref = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<DetailState>({ status: "loading" })
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [pendingExample, setPendingExample] = useState(false)

  useEffect(() => {
    const lower = term.toLowerCase()
    if (clientCache.has(lower)) {
      setDetail({ status: "ok", data: clientCache.get(lower)! })
      return
    }
    const stored = lsGet(lower)
    if (stored) {
      clientCache.set(lower, stored)
      setDetail({ status: "ok", data: stored })
      return
    }
    setDetail({ status: "loading" })
    fetch(`/api/definition/${encodeURIComponent(lower)}`, { headers: withUserApiKey() })
      .then((r) => r.json())
      .then((data: WordDefinition & { error?: string }) => {
        if (data.error) {
          setDetail({ status: "error" })
        } else {
          clientCache.set(lower, data)
          lsSet(lower, data)
          setDetail({ status: "ok", data })
        }
      })
      .catch(() => setDetail({ status: "error" }))
  }, [term])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [onClose])

  const style = (() => {
    const popupW = 280
    const gap = 8
    let left = anchorRect.left
    let top = anchorRect.bottom + gap + window.scrollY
    if (left + popupW > window.innerWidth - 16) left = window.innerWidth - popupW - 16
    if (top + 200 > window.innerHeight + window.scrollY) top = anchorRect.top - 200 + window.scrollY
    return { top, left, width: popupW }
  })()

  const definitionZh = prefilled?.definition_zh
    ?? (detail.status === "ok" ? detail.data.zh_definition : null)

  const pos = detail.status === "ok" ? detail.data.pos : null
  const phonetic = detail.status === "ok" ? detail.data.phonetic : null
  const example = detail.status === "ok" ? detail.data.example : null
  const zhExample = detail.status === "ok" ? detail.data.zh_example : null

  useEffect(() => {
    if (!pendingExample || detail.status !== "ok") return
    onExampleReady?.({
      term,
      definition_zh: prefilled?.definition_zh ?? detail.data.zh_definition ?? "",
      level: "",
      pos: detail.data.pos,
      example: detail.data.example,
      zh_example: detail.data.zh_example,
      phonetic: detail.data.phonetic,
    })
    setPendingExample(false)
  }, [detail, pendingExample, onExampleReady, term, prefilled])

  const handleSave = async () => {
    if (!youtubeId || saveState === "saving" || saveState === "saved") return
    const hasExample = detail.status === "ok"
    setSaveState("saving")
    try {
      const r = await fetch("/api/saved-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          youtubeId,
          content: term,
          type: term.includes(" ") ? "phrase" : "word",
          zh_definition: definitionZh ?? undefined,
          example: example ?? undefined,
          zh_example: zhExample ?? undefined,
        }),
      })
      const data = await r.json()
      if (data.error) {
        setSaveState("error")
      } else {
        setSaveState("saved")
        onSaved?.({
          term,
          definition_zh: definitionZh ?? "",
          level: "",
          pos: pos ?? "",
          example: example ?? "",
          zh_example: zhExample ?? "",
          phonetic: phonetic ?? undefined,
        })
        if (!hasExample) setPendingExample(true)
      }
    } catch {
      setSaveState("error")
    }
  }

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 rounded-xl border border-stone-200 bg-white shadow-lg p-4 text-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-semibold text-stone-900 text-base">{term}</span>
          {phonetic && <span className="ml-2 text-xs text-stone-400">/{phonetic.replace(/^\/|\/$/g, "")}/</span>}
          {pos && pos !== "phr." && <span className="ml-2 text-xs text-stone-400">{pos}</span>}
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {definitionZh ? (
          <p className="text-stone-900 font-medium">{definitionZh}</p>
        ) : detail.status === "loading" ? (
          <div className="flex items-center gap-2 text-stone-400 py-1">
            <Spinner />
            <span>{t.watch.loading}</span>
          </div>
        ) : (
          <p className="text-stone-400 py-1">{t.watch.defLoadFailed}</p>
        )}

        {example && (
          <div className="space-y-0.5">
            <p className="text-stone-600 italic leading-snug">"{example}"</p>
            {zhExample && <p className="text-stone-400 text-xs leading-snug">{zhExample}</p>}
          </div>
        )}

        {!example && detail.status === "loading" && definitionZh && (
          <div className="flex items-center gap-1.5 text-stone-300 text-xs">
            <Spinner size="sm" />
            <span>{t.watch.loadingExample}</span>
          </div>
        )}
      </div>

      {youtubeId && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <button
            onClick={handleSave}
            disabled={saveState === "saving" || saveState === "saved"}
            className={cn(
              "w-full py-1.5 rounded-lg text-xs font-medium transition-colors",
              saveState === "saved"
                ? "bg-stone-100 text-stone-400 cursor-default"
                : saveState === "error"
                ? "bg-red-50 text-red-500 hover:bg-red-100"
                : "bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-50"
            )}
          >
            {saveState === "saved" ? t.watch.saved : saveState === "saving" ? t.watch.saving : saveState === "error" ? t.watch.saveError : t.watch.saveToVocab}
          </button>
        </div>
      )}
    </div>
  )
}

function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-3 h-3" : "w-4 h-4"
  return (
    <svg className={cn(cls, "animate-spin text-stone-400")} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
