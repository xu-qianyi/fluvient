"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Languages, MessageSquare, PenLine } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { useYouTubePlayer } from "@/hooks/use-youtube-player"
import { TranscriptSegment } from "@/components/transcript-segment"
import { WordPopup } from "@/components/word-popup"
import { SelectionPopup } from "@/components/selection-popup"
import { ChatPanel, type ChatPanelHandle } from "@/components/chat-panel"
import { tokenizeWithVocab } from "@/lib/vocab-highlight"
import type { VocabTerm } from "@/app/api/vocab/[videoId]/route"
import type { TranscriptSegment as Segment } from "@/app/api/transcript/[videoId]/route"
import type { WordDefinition } from "@/app/api/definition/[word]/route"
import { cn } from "@/lib/utils"

type Tab = "transcript" | "notes" | "chat"

const PLAYER_ID = "yt-player"
const POLL_MS = 250

export function VideoLayout({ videoId }: { videoId: string }) {
  const { t, cefrLevel } = useLanguage()
  const router = useRouter()
  const { isReady, seekTo, getCurrentTime } = useYouTubePlayer(PLAYER_ID, videoId)

  const [segments, setSegments] = useState<Segment[]>([])
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [vocabTerms, setVocabTerms] = useState<VocabTerm[]>([])
  const [vocabDefinitions, setVocabDefinitions] = useState<Map<string, WordDefinition>>(new Map())
  const [activeIdx, setActiveIdx] = useState(-1)
  const [activeTab, setActiveTab] = useState<Tab>("transcript")
  const [popup, setPopup] = useState<{
    term: string
    prefilled?: VocabTerm
    rect: DOMRect
  } | null>(null)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; rect: DOMRect } | null>(null)

  const segmentRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastActiveIdx = useRef(-1)
  const chatPanelRef = useRef<ChatPanelHandle>(null)

  const fetchTranscript = useCallback(() => {
    setSegments([])
    setTranscriptError(null)
    setIsLoading(true)
    setVocabTerms([])

    fetch(`/api/transcript/${videoId}?level=${cefrLevel}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setTranscriptError(data.error)
        else setSegments(data.segments)
      })
      .catch(() => setTranscriptError("fetch_failed"))
      .finally(() => setIsLoading(false))

    fetch(`/api/vocab/${videoId}?level=${cefrLevel}`)
      .then((r) => r.json())
      .then((data) => { if (data.terms) setVocabTerms(data.terms) })
      .catch(() => {/* vocab is optional — fail silently */})

  }, [videoId, cefrLevel])

  useEffect(() => {
    fetchTranscript()
  }, [fetchTranscript])

  useEffect(() => {
    if (!vocabTerms.length) return
    setVocabDefinitions(new Map())
    Promise.all(
      vocabTerms.map(async (t) => {
        const lower = t.term.toLowerCase()
        try {
          const r = await fetch(`/api/definition/${encodeURIComponent(lower)}`)
          const data: WordDefinition & { error?: string } = await r.json()
          if (data.error) return null
          return [lower, data] as [string, WordDefinition]
        } catch {
          return null
        }
      })
    ).then((entries) => {
      setVocabDefinitions(new Map(entries.filter((e): e is [string, WordDefinition] => e !== null)))
    })
  }, [vocabTerms])

  useEffect(() => {
    if (!isReady || !segments.length) return
    const id = setInterval(() => {
      const ms = getCurrentTime() * 1000
      const idx = segments.findIndex((s) => ms >= s.startMs && ms < s.endMs)
      setActiveIdx(idx)
    }, POLL_MS)
    return () => clearInterval(id)
  }, [isReady, segments, getCurrentTime])

  useEffect(() => {
    if (activeIdx < 0 || activeIdx === lastActiveIdx.current) return
    lastActiveIdx.current = activeIdx
    segmentRefs.current[activeIdx]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeIdx])

  const handleSeek = useCallback((ms: number) => seekTo(ms / 1000), [seekTo])

  const handleWordClick = useCallback((term: string, vocabTerm: VocabTerm, rect: DOMRect) => {
    setSelectionPopup(null)
    setPopup({ term, prefilled: vocabTerm, rect })
  }, [])

  const handleTranscriptMouseUp = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (!text) { setSelectionPopup(null); return }
    const range = selection!.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelectionPopup({ text, rect })
  }, [])

  const handleTranslate = useCallback((text: string) => {
    setActiveTab("chat")
    chatPanelRef.current?.sendMessage(`请将以下英文翻译成中文：\n"${text}"`)
  }, [])

  useEffect(() => { setSelectionPopup(null) }, [activeTab])

  const currentSeg = activeIdx >= 0 ? segments[activeIdx] : null
  const nextSeg = activeIdx >= 0 ? segments[activeIdx + 1] : null

  // Sort AI vocab: words before phrases
  const mergedVocab = useMemo(() => vocabTerms
    .map((t) => {
      const lower = t.term.toLowerCase()
      const def = vocabDefinitions.get(lower)
      return {
        key: lower,
        content: t.term,
        zh_definition: t.definition_zh,
        pos: t.pos as string | undefined,
        isPhrase: t.term.includes(" "),
        example: def?.example ?? null,
        zh_example: def?.zh_example ?? null,
      }
    })
    .sort((a, b) => Number(a.isPhrase) - Number(b.isPhrase))
  , [vocabTerms, vocabDefinitions])

  const transcriptText = useMemo(() => segments.map((s) => s.text).join(" "), [segments])

  return (
    <>
      {/* Full-screen loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white gap-5">
          <div className="w-10 h-10 rounded-full border-[3px] border-stone-200 border-t-stone-500 animate-spin" />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[15px] font-semibold text-stone-800">正在加载视频工作区</p>
            <p className="text-sm text-stone-400">正在获取字幕...</p>
          </div>
        </div>
      )}

      {/* Full-screen error overlay */}
      {!isLoading && transcriptError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-stone-900/5 px-10 py-10 max-w-md w-full mx-4 text-center">
            <p className="text-lg font-bold text-stone-900 mb-3">无法分析该视频</p>
            <p className="text-sm text-stone-500 leading-relaxed mb-8">
              {transcriptError === "no_transcript"
                ? "该视频没有可用的字幕，可能未开启字幕功能。请换一个有字幕的视频试试。"
                : "字幕加载失败，请检查网络后重试。"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="px-5 py-2 rounded-full text-sm font-medium border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                返回首页
              </button>
              <button
                onClick={fetchTranscript}
                className="px-5 py-2 rounded-full text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-6 px-20 py-8 bg-stone-100/60">

        {/* ── Left column ── */}
        <div className="flex flex-col w-2/3 min-h-0 gap-6">

          {/* Video */}
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-stone-900 shrink-0 shadow-sm ring-1 ring-stone-900/5">
            <div id={PLAYER_ID} className="w-full h-full" />
          </div>

          {/* Learning display */}
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col justify-center px-8 py-6 gap-5">
              {!segments.length ? (
                <p className="text-stone-300 text-xl">{t.watch.transcriptLoading}</p>
              ) : activeIdx < 0 ? (
                <p className="text-stone-300 text-xl">播放视频开始学习</p>
              ) : (
                <>
                  <LearningText
                    text={currentSeg?.text ?? ""}
                    vocabTerms={vocabTerms}
                    cefrLevel={cefrLevel}
                    onWordClick={handleWordClick}
                    size="current"
                  />
                  {nextSeg && (
                    <LearningText
                      text={nextSeg.text}
                      vocabTerms={vocabTerms}
                      cefrLevel={cefrLevel}
                      onWordClick={handleWordClick}
                      size="next"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col w-1/3 min-h-0 rounded-2xl bg-white shadow-sm ring-1 ring-stone-900/5 overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-1 flex-1 bg-stone-100 rounded-xl p-1">
              <TabBtn active={activeTab === "transcript"} onClick={() => setActiveTab("transcript")}>
                <Languages className="w-3.5 h-3.5" />
                字幕
              </TabBtn>
              <TabBtn active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>
                <PenLine className="w-3.5 h-3.5" />
                生词本
              </TabBtn>
              <TabBtn active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>
                <MessageSquare className="w-3.5 h-3.5" />
                AI 聊天
              </TabBtn>
            </div>
          </div>

          {/* Transcript tab */}
          <div onMouseUp={handleTranscriptMouseUp} className={cn("flex-1 overflow-y-auto px-2 py-2", activeTab !== "transcript" && "hidden")}>
            {!segments.length ? (
              <p className="text-sm text-stone-400 px-2 py-4">{t.watch.transcriptLoading}</p>
            ) : (
              <div className="space-y-0.5">
                {segments.map((seg, i) => (
                  <div key={i} ref={(el) => { segmentRefs.current[i] = el }}>
                    <TranscriptSegment
                      text={seg.text}
                      startMs={seg.startMs}
                      isActive={activeIdx === i}
                      vocabTerms={vocabTerms}
                      cefrLevel={cefrLevel}
                      onSeek={handleSeek}
                      onWordClick={handleWordClick}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 生词本 tab */}
          <div className={cn("flex-1 overflow-y-auto py-2", activeTab !== "notes" && "hidden")}>
            {mergedVocab.length === 0 ? (
              <p className="text-sm text-stone-400 px-4 py-4">正在分析生词…</p>
            ) : (
              <>
                <VocabSection title="Vocabulary" items={mergedVocab.filter((i) => !i.isPhrase)} />
                <VocabSection title="Short Phrases" items={mergedVocab.filter((i) => i.isPhrase)} />
              </>
            )}
          </div>

          {/* Chat tab */}
          <div className={cn("flex-1 min-h-0 flex flex-col", activeTab !== "chat" && "hidden")}>
            <ChatPanel ref={chatPanelRef} transcript={transcriptText} />
          </div>

        </div>
      </div>

      {popup && (
        <WordPopup
          term={popup.term}
          prefilled={popup.prefilled}
          anchorRect={popup.rect}
          onClose={() => setPopup(null)}
        />
      )}

      {selectionPopup && (
        <SelectionPopup
          text={selectionPopup.text}
          anchorRect={selectionPopup.rect}
          onClose={() => setSelectionPopup(null)}
          onTranslate={handleTranslate}
        />
      )}
    </>
  )
}

// ── Learning display text ────────────────────────────────────────────────────

function LearningText({
  text, vocabTerms, cefrLevel, onWordClick, size,
}: {
  text: string
  vocabTerms: VocabTerm[]
  cefrLevel: import("@/data/cefr-words").CefrLevel
  onWordClick: (term: string, vocabTerm: VocabTerm, rect: DOMRect) => void
  size: "current" | "next"
}) {
  const tokens = tokenizeWithVocab(text, vocabTerms, cefrLevel)
  const isCurrent = size === "current"

  return (
    <p className={cn(
      "leading-relaxed transition-all duration-300",
      isCurrent ? "text-3xl font-medium text-stone-900" : "text-xl text-stone-300"
    )}>
      {tokens.map((token, i) => {
        if (token.type === "text") return <span key={i}>{token.text}</span>
        return (
          <button
            key={i}
            onClick={(e) => {
              if (!isCurrent) return
              e.stopPropagation()
              onWordClick(token.text, token.term, (e.currentTarget as HTMLElement).getBoundingClientRect())
            }}
            className={cn(
              "relative inline-block rounded-md transition-colors",
              isCurrent
                ? cn(
                    "px-1 mx-0.5 cursor-pointer rounded",
                    token.term.term.includes(" ")
                      ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                      : "bg-blue-100 text-blue-900 hover:bg-blue-200"
                  )
                : "text-stone-300 cursor-default"
            )}
          >
            {token.text}
          </button>
        )
      })}
    </p>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

type VocabListItem = {
  key: string
  content: string
  zh_definition: string | null
  pos: string | undefined
  isPhrase: boolean
  example: string | null
  zh_example: string | null
}

function VocabSection({ title, items }: { title: string; items: VocabListItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-1">
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-center">{title}</p>
      {items.map((item) => (
        <div key={item.key} className="px-3 py-2 rounded-lg hover:bg-stone-50">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-stone-900">{item.content}</span>
            {item.pos && (
              <span className="text-xs text-stone-400 italic">{item.pos}</span>
            )}
            {item.zh_definition && (
              <span className="text-xs text-stone-500">{item.zh_definition}</span>
            )}
          </div>
          {item.example && (
            <div className="mt-1 space-y-0.5">
              <p className="text-xs text-stone-400 italic leading-snug">"{item.example}"</p>
              {item.zh_example && (
                <p className="text-xs text-stone-300 leading-snug">{item.zh_example}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 px-3 h-7 rounded-lg text-xs font-medium transition-all",
        active ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
      )}
    >
      {children}
    </button>
  )
}

