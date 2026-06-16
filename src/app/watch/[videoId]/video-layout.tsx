"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, ExternalLink, Languages, MessageSquare, MoreVertical, PenLine, Search, Trash2, X } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { useYouTubePlayer } from "@/hooks/use-youtube-player"
import { TranscriptSegment } from "@/components/transcript-segment"
import { WordPopup } from "@/components/word-popup"
import { SelectionPopup } from "@/components/selection-popup"
import { ChatPanel, type ChatPanelHandle } from "@/components/chat-panel"
import { tokenizeWithVocab } from "@/lib/vocab-highlight"
import { getUserApiKey, getUserApiProvider, setUserApi, withUserApiKey, type ApiProvider } from "@/lib/user-api-key"
import type { VocabTerm } from "@/app/api/vocab/[videoId]/route"
import type { TranscriptSegment as Segment } from "@/app/api/transcript/[videoId]/route"
import type { CefrLevel } from "@/data/cefr-words"
import { cn } from "@/lib/utils"

// ── Chip tokenizer ────────────────────────────────────────────────────────────

type WordChip = { text: string; vocabTerm?: VocabTerm }

function tokenizeToChips(text: string, vocabTerms: VocabTerm[], cefrLevel: CefrLevel): WordChip[] {
  const tokens = tokenizeWithVocab(text, vocabTerms, cefrLevel)
  const chips: WordChip[] = []
  for (const token of tokens) {
    if (token.type === "vocab") {
      chips.push({ text: token.text, vocabTerm: token.term })
    } else {
      for (const word of token.text.split(/\s+/).filter(Boolean)) {
        chips.push({ text: word })
      }
    }
  }
  return chips
}

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
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [vocabTerms, setVocabTerms] = useState<VocabTerm[]>([])
  const [vocabError, setVocabError] = useState(false)
  const [vocabLoading, setVocabLoading] = useState(false)
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyInputValue, setKeyInputValue] = useState(() => getUserApiKey() ?? "")
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>(() => getUserApiProvider())
  const [activeIdx, setActiveIdx] = useState(-1)
  const [activeTab, setActiveTab] = useState<Tab>("transcript")
  const [popup, setPopup] = useState<{
    term: string
    prefilled?: VocabTerm
    rect: DOMRect
  } | null>(null)
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; rect: DOMRect } | null>(null)
  const [deletedVocabKeys, setDeletedVocabKeys] = useState<Set<string>>(new Set())
  const [loadingExampleKeys, setLoadingExampleKeys] = useState<Set<string>>(new Set())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [matchIdx, setMatchIdx] = useState(0)

  const segmentRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastActiveIdx = useRef(-1)
  const chatPanelRef = useRef<ChatPanelHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fetchVocab = useCallback(() => {
    setVocabTerms([])
    setVocabError(false)
    setVocabLoading(true)
    fetch(`/api/vocab/${videoId}?level=${cefrLevel}`, { headers: withUserApiKey() })
      .then((r) => r.json())
      .then((data) => {
        if (data.terms) setVocabTerms(data.terms)
        else setVocabError(true)
      })
      .catch(() => setVocabError(true))
      .finally(() => setVocabLoading(false))
  }, [videoId, cefrLevel])

  const fetchTranscript = useCallback(() => {
    setSegments([])
    setTranscriptError(null)
    setIsLoading(true)
    setSearchOpen(false)
    setSearchQuery("")
    setMatchIdx(0)
    fetch(`/api/transcript/${videoId}?level=${cefrLevel}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setTranscriptError(data.error)
        else setSegments(data.segments)
      })
      .catch(() => setTranscriptError("fetch_failed"))
      .finally(() => setIsLoading(false))
    fetchVocab()
  }, [videoId, cefrLevel, fetchVocab])

  useEffect(() => {
    fetchTranscript()
  }, [fetchTranscript])

  useEffect(() => {
    if (!segments.length) return
    const unique = [...new Set(segments.map((s) => s.text))]
    setTranslations({})

    const CHUNK = 20
    let cancelled = false

    const run = async () => {
      for (let i = 0; i < unique.length; i += CHUNK) {
        if (cancelled) return
        const batch = unique.slice(i, i + CHUNK)
        try {
          const r = await fetch("/api/translate-batch", {
            method: "POST",
            headers: withUserApiKey({ "Content-Type": "application/json" }),
            body: JSON.stringify({ texts: batch }),
          })
          const data = await r.json()
          if (cancelled) return
          if (data.translations) {
            setTranslations((prev) => {
              const next = { ...prev }
              batch.forEach((text, j) => { if (data.translations[j]) next[text] = data.translations[j] })
              return next
            })
          } else {
            console.error("[translate-batch] chunk", i, "returned:", data)
          }
        } catch (err) {
          console.error("[translate-batch] chunk", i, "failed:", err)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [segments])

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

  const handleWordClick = useCallback((term: string, vocabTerm: VocabTerm | undefined, rect: DOMRect) => {
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

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return segments.reduce<number[]>((acc, seg, i) => {
      if (seg.text.toLowerCase().includes(q)) acc.push(i)
      return acc
    }, [])
  }, [segments, searchQuery])

  useEffect(() => { setMatchIdx(0) }, [searchQuery])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (!searchMatches.length) return
    const idx = searchMatches[matchIdx]
    segmentRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [searchMatches, matchIdx])

  const handleNextMatch = useCallback(() => {
    setMatchIdx((i) => (searchMatches.length ? (i + 1) % searchMatches.length : 0))
  }, [searchMatches.length])

  const handlePrevMatch = useCallback(() => {
    setMatchIdx((i) => (searchMatches.length ? (i - 1 + searchMatches.length) % searchMatches.length : 0))
  }, [searchMatches.length])

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery("")
    setMatchIdx(0)
  }, [])

  const currentSeg = activeIdx >= 0 ? segments[activeIdx] : null

  // Sort AI vocab: words before phrases
  const mergedVocab = useMemo(() => vocabTerms
    .map((t) => ({
      key: t.term.toLowerCase(),
      content: t.term,
      zh_definition: t.definition_zh,
      pos: t.pos as string | undefined,
      isPhrase: t.term.includes(" "),
      example: t.example || null,
      zh_example: t.zh_example || null,
      loadingExample: loadingExampleKeys.has(t.term.toLowerCase()),
    }))
    .sort((a, b) => Number(a.isPhrase) - Number(b.isPhrase))
  , [vocabTerms, loadingExampleKeys])

  const filteredVocab = useMemo(
    () => mergedVocab.filter((i) => !deletedVocabKeys.has(i.key)),
    [mergedVocab, deletedVocabKeys]
  )

  const handleDeleteVocab = useCallback((key: string) => {
    setDeletedVocabKeys((prev) => new Set([...prev, key]))
  }, [])

  const handleVocabSaved = useCallback((newTerm: VocabTerm) => {
    setVocabTerms((prev) => {
      if (prev.some((t) => t.term.toLowerCase() === newTerm.term.toLowerCase())) return prev
      return [...prev, newTerm]
    })
    if (!newTerm.example) {
      setLoadingExampleKeys((prev) => new Set([...prev, newTerm.term.toLowerCase()]))
    }
  }, [])

  const handleExampleReady = useCallback((updatedTerm: VocabTerm) => {
    setVocabTerms((prev) =>
      prev.map((t) => t.term.toLowerCase() === updatedTerm.term.toLowerCase() ? updatedTerm : t)
    )
    setLoadingExampleKeys((prev) => {
      const next = new Set(prev)
      next.delete(updatedTerm.term.toLowerCase())
      return next
    })
  }, [])

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
                    translation={translations[currentSeg?.text ?? ""] ?? null}
                  />
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
          <div onMouseUp={handleTranscriptMouseUp} className={cn("flex-1 overflow-y-auto", activeTab !== "transcript" && "hidden")}>
            <div className="sticky top-0 z-10 bg-white px-2 pt-2 pb-2 flex justify-end">
              <div className="relative group">
                <div
                  className={cn(
                    "flex items-center rounded-xl overflow-hidden transition-all duration-300 ease-out",
                    searchOpen ? "w-full gap-2 px-2 py-0.5" : "w-9 h-9 gap-0 px-0 py-0"
                  )}
                >
                  <button
                    onClick={() => setSearchOpen(true)}
                    className={cn(
                      "shrink-0 rounded-lg text-stone-400 transition-colors",
                      searchOpen ? "p-1" : "p-1.5 hover:bg-stone-100 hover:text-stone-700"
                    )}
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); e.shiftKey ? handlePrevMatch() : handleNextMatch() }
                      if (e.key === "Escape") handleCloseSearch()
                    }}
                    placeholder="Search transcript..."
                    className={cn(
                      "text-xs outline-none placeholder:text-stone-300 min-w-0 overflow-hidden",
                      searchOpen ? "flex-1" : "w-0 grow-0 shrink-0"
                    )}
                    tabIndex={searchOpen ? 0 : -1}
                  />
                  <span className={cn(
                    "text-xs text-stone-400 font-mono tabular-nums shrink-0 overflow-hidden",
                    !searchOpen && "w-0"
                  )}>
                    {searchMatches.length === 0 ? "0/0" : `${matchIdx + 1}/${searchMatches.length}`}
                  </span>
                  <button
                    onClick={handlePrevMatch}
                    disabled={!searchMatches.length}
                    tabIndex={searchOpen ? 0 : -1}
                    className={cn(
                      "rounded text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors shrink-0 overflow-hidden",
                      searchOpen ? "p-0.5" : "w-0 p-0"
                    )}
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleNextMatch}
                    disabled={!searchMatches.length}
                    tabIndex={searchOpen ? 0 : -1}
                    className={cn(
                      "rounded text-stone-400 hover:text-stone-700 disabled:opacity-30 transition-colors shrink-0 overflow-hidden",
                      searchOpen ? "p-0.5" : "w-0 p-0"
                    )}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCloseSearch}
                    tabIndex={searchOpen ? 0 : -1}
                    className={cn(
                      "rounded text-stone-400 hover:text-stone-700 transition-colors shrink-0 overflow-hidden",
                      searchOpen ? "p-0.5" : "w-0 p-0"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {!searchOpen && (
                  <span className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-stone-800 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-20">
                    Search transcript
                  </span>
                )}
              </div>
            </div>
            {!segments.length ? (
              <p className="text-sm text-stone-400 px-2 py-4">{t.watch.transcriptLoading}</p>
            ) : (
              <div className="space-y-0.5 px-2 pb-2">
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
                      searchQuery={searchQuery}
                      isCurrentMatch={searchMatches.length > 0 && searchMatches[matchIdx] === i}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 生词本 tab */}
          <div className={cn("flex-1 overflow-y-auto py-2", activeTab !== "notes" && "hidden")}>
            {vocabError ? (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <p className="text-sm text-stone-500">生词分析失败，可能是 API 配额已用完</p>
                <button
                  onClick={fetchVocab}
                  className="px-4 py-1.5 rounded-full text-xs font-medium border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  重新分析
                </button>

                <div className="w-full border-t border-stone-100 pt-4 mt-1">
                  {!showKeyInput ? (
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
                    >
                      使用自己的 API Key
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-xs text-stone-500 font-medium text-left">选择 AI 服务商</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["google", "openai", "anthropic"] as ApiProvider[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => { setSelectedProvider(p); setKeyInputValue("") }}
                            className={cn(
                              "py-1.5 rounded-lg text-xs font-medium border transition-colors",
                              selectedProvider === p
                                ? "bg-stone-900 text-white border-stone-900"
                                : "border-stone-200 text-stone-500 hover:border-stone-400"
                            )}
                          >
                            {p === "google" ? "Google" : p === "openai" ? "OpenAI" : "Anthropic"}
                          </button>
                        ))}
                      </div>
                      <input
                        value={keyInputValue}
                        onChange={(e) => setKeyInputValue(e.target.value)}
                        placeholder={
                          selectedProvider === "openai" ? "sk-..." :
                          selectedProvider === "anthropic" ? "sk-ant-..." :
                          "AIza..."
                        }
                        className="w-full text-xs bg-stone-100 rounded-lg px-3 py-2 outline-none font-mono placeholder:text-stone-300"
                      />
                      <button
                        onClick={() => {
                          const k = keyInputValue.trim()
                          if (!k) return
                          setUserApi(k, selectedProvider)
                          setShowKeyInput(false)
                          fetchVocab()
                        }}
                        disabled={!keyInputValue.trim()}
                        className="w-full py-2 rounded-lg bg-stone-900 text-white text-xs font-medium disabled:opacity-30 hover:bg-stone-700 transition-colors"
                      >
                        保存并重试
                      </button>
                      <p className="text-[11px] text-stone-400">
                        {selectedProvider === "google" && <>从{" "}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">Google AI Studio</a>{" "}免费获取</>}
                        {selectedProvider === "openai" && <>从{" "}<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">OpenAI Platform</a>{" "}获取（按量付费）</>}
                        {selectedProvider === "anthropic" && <>从{" "}<a href="https://console.anthropic.com/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">Anthropic Console</a>{" "}获取（按量付费）</>}
                      </p>
                      <p className="text-[11px] text-stone-400">Key 仅存在你的本地浏览器，仅用于转发 AI 请求，不会被存储或记录。</p>
                    </div>
                  )}
                </div>
              </div>
            ) : vocabLoading ? (
              <div className="flex items-center gap-2.5 px-4 py-4 text-sm text-stone-400">
                <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                正在分析生词…
              </div>
            ) : (
              <>
                <VocabSection title="Vocabulary" items={filteredVocab.filter((i) => !i.isPhrase)} onDelete={handleDeleteVocab} />
                <VocabSection title="Short Phrases" items={filteredVocab.filter((i) => i.isPhrase)} onDelete={handleDeleteVocab} />
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
          onClose={() => {
            setLoadingExampleKeys((prev) => {
              const next = new Set(prev)
              next.delete(popup.term.toLowerCase())
              return next
            })
            setPopup(null)
          }}
          youtubeId={videoId}
          onSaved={handleVocabSaved}
          onExampleReady={handleExampleReady}
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
  text, vocabTerms, cefrLevel, onWordClick, translation,
}: {
  text: string
  vocabTerms: VocabTerm[]
  cefrLevel: CefrLevel
  onWordClick: (term: string, vocabTerm: VocabTerm | undefined, rect: DOMRect) => void
  translation: string | null
}) {
  const chips = tokenizeToChips(text, vocabTerms, cefrLevel)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              onWordClick(chip.text, chip.vocabTerm, (e.currentTarget as HTMLElement).getBoundingClientRect())
            }}
            className={cn(
              "rounded-md px-2 py-0.5 text-xl font-medium transition-colors cursor-pointer",
              chip.vocabTerm
                ? "bg-stone-200 text-stone-800 hover:bg-stone-300"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            )}
          >
            {chip.text}
          </button>
        ))}
      </div>
      {translation && (
        <p className="mt-3 text-base text-stone-400 leading-relaxed">{translation}</p>
      )}
    </div>
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
  loadingExample: boolean
}

function VocabSection({ title, items, onDelete }: { title: string; items: VocabListItem[]; onDelete: (key: string) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  if (items.length === 0) return null
  return (
    <div className="mb-1">
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-center">{title}</p>
      {items.map((item) => (
        <VocabItem key={item.key} item={item} openKey={openKey} setOpenKey={setOpenKey} onDelete={onDelete} />
      ))}
    </div>
  )
}

function VocabItem({ item, openKey, setOpenKey, onDelete }: {
  item: VocabListItem
  openKey: string | null
  setOpenKey: (key: string | null) => void
  onDelete: (key: string) => void
}) {
  const isOpen = openKey === item.key
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenKey(null)
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [isOpen, setOpenKey])

  return (
    <div className="group relative px-3 py-2 rounded-lg hover:bg-stone-50">
      <div ref={menuRef} className="absolute right-2 top-2">
        <button
          onClick={(e) => { e.stopPropagation(); setOpenKey(isOpen ? null : item.key) }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-opacity"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-md ring-1 ring-stone-900/10 py-1 min-w-[190px] whitespace-nowrap">
            <a
              href={`https://en.wiktionary.org/wiki/${encodeURIComponent(item.content)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              onClick={() => setOpenKey(null)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              Look up on Wiktionary
            </a>
            <a
              href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(item.content)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              onClick={() => setOpenKey(null)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              Look up on Cambridge
            </a>
            <a
              href={`https://www.ldoceonline.com/dictionary/${encodeURIComponent(item.content)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              onClick={() => setOpenKey(null)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              Look up on Longman
            </a>
            <button
              onClick={() => { onDelete(item.key); setOpenKey(null) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-stone-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              移除
            </button>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-stone-900">{item.content}</span>
        {item.pos && item.pos !== "phr." && <span className="text-xs text-stone-400 italic">{item.pos}</span>}
        {item.zh_definition && <span className="text-xs text-stone-500">{item.zh_definition}</span>}
      </div>
      {item.example ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-xs text-stone-400 italic leading-snug">"{item.example}"</p>
          {item.zh_example && <p className="text-xs text-stone-300 leading-snug">{item.zh_example}</p>}
        </div>
      ) : item.loadingExample ? (
        <div className="mt-1 flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin text-stone-300 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs text-stone-300">加载例句…</span>
        </div>
      ) : null}
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

