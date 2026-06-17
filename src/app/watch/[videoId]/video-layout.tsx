"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Languages, MessageSquare, MoreVertical, PenLine, Search, Trash2, X } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useRouter } from "next/navigation"
import { useYouTubePlayer } from "@/hooks/use-youtube-player"
import { TranscriptSegment } from "@/components/transcript-segment"
import { WordPopup } from "@/components/word-popup"
import { SelectionPopup } from "@/components/selection-popup"
import { ChatPanel, type ChatPanelHandle } from "@/components/chat-panel"
import { Footer } from "@/components/footer"
import { tokenizeWithVocab } from "@/lib/vocab-highlight"
import { getUserApiKey, getUserApiProvider, setUserApi, withUserApiKey, type ApiProvider } from "@/lib/user-api-key"
import type { VocabTerm, ExpressionCard } from "@/app/api/vocab/[videoId]/route"
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
  const { t, cefrLevel, hydrated } = useLanguage()
  const router = useRouter()
  // Token guardrail: AI vocab/transcript are generated per (video × level), so
  // we pin the level at load time and DON'T react to live level changes. Editing
  // the level mid-watch would otherwise re-generate everything at a new level.
  // The new level applies on the next video instead.
  const [appliedLevel, setAppliedLevel] = useState<CefrLevel>(cefrLevel)
  const levelRef = useRef<CefrLevel>(cefrLevel)
  const [dismissedForLevel, setDismissedForLevel] = useState<CefrLevel | null>(null)
  const { isReady, seekTo, getCurrentTime } = useYouTubePlayer(PLAYER_ID, videoId)

  const [segments, setSegments] = useState<Segment[]>([])
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [vocabTerms, setVocabTerms] = useState<VocabTerm[]>([])
  const [expressions, setExpressions] = useState<ExpressionCard[]>([])
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
  const [hideTranslation, setHideTranslation] = useState(false)
  // Segment highlighted green when the learner jumps here from a 表达锦囊 card.
  const [quotedIdx, setQuotedIdx] = useState<number | null>(null)

  const segmentRefs = useRef<(HTMLDivElement | null)[]>([])
  const inFlightTranslations = useRef<Set<string>>(new Set())
  const lastActiveIdx = useRef(-1)
  const chatPanelRef = useRef<ChatPanelHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keep the ref in sync, but reads of it (in the fetches below) are deliberately
  // decoupled from re-renders so a live level change won't trigger a re-fetch.
  useEffect(() => {
    levelRef.current = cefrLevel
  }, [cefrLevel])

  const fetchVocab = useCallback(() => {
    setVocabTerms([])
    setExpressions([])
    setVocabError(false)
    setVocabLoading(true)
    fetch(`/api/vocab/${videoId}?level=${levelRef.current}`, { headers: withUserApiKey() })
      .then((r) => r.json())
      .then((data) => {
        if (data.terms) {
          setVocabTerms(data.terms)
          setExpressions(data.expressions ?? [])
        } else setVocabError(true)
      })
      .catch(() => setVocabError(true))
      .finally(() => setVocabLoading(false))
  }, [videoId])

  const fetchTranscript = useCallback(() => {
    setSegments([])
    setTranslations({})
    inFlightTranslations.current = new Set()
    setTranscriptError(null)
    setIsLoading(true)
    setSearchOpen(false)
    setSearchQuery("")
    setMatchIdx(0)
    // Pin this load to the level current at fetch time.
    setAppliedLevel(levelRef.current)
    fetch(`/api/transcript/${videoId}?level=${levelRef.current}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setTranscriptError(data.error)
        else {
          setSegments(data.segments)
          // Only spend vocab tokens once the video has actually loaded (and
          // wasn't blocked by the daily quota).
          fetchVocab()
        }
      })
      .catch(() => setTranscriptError("fetch_failed"))
      .finally(() => setIsLoading(false))
  }, [videoId, fetchVocab])

  // Fires on first load (once localStorage has hydrated, so we use the stored
  // level — not the transient default) and whenever the video changes. Crucially
  // it does NOT depend on cefrLevel, so changing the level mid-watch is free.
  useEffect(() => {
    if (!hydrated) return
    fetchTranscript()
  }, [hydrated, fetchTranscript])

  // On-demand translation: only translate the segment being played, plus a small
  // lookahead. The center "learning display" is the sole consumer, and it shows
  // one segment at a time — so we spend tokens only on what the user actually
  // watches. Results are cached server-side, so re-watches cost zero tokens.
  useEffect(() => {
    if (activeIdx < 0 || !segments.length) return
    const LOOKAHEAD = 3 // current + next 2
    const wanted = [...new Set(segments.slice(activeIdx, activeIdx + LOOKAHEAD).map((s) => s.text))]
    const todo = wanted.filter((t) => !(t in translations) && !inFlightTranslations.current.has(t))
    if (!todo.length) return

    todo.forEach((t) => inFlightTranslations.current.add(t))
    fetch("/api/translate-batch", {
      method: "POST",
      headers: withUserApiKey({ "Content-Type": "application/json" }),
      body: JSON.stringify({ texts: todo }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.translations) {
          setTranslations((prev) => {
            const next = { ...prev }
            todo.forEach((text, j) => { if (data.translations[j]) next[text] = data.translations[j] })
            return next
          })
        }
      })
      .catch(() => { /* leave untranslated; will retry when revisited */ })
      .finally(() => { todo.forEach((t) => inFlightTranslations.current.delete(t)) })
  }, [activeIdx, segments, translations])

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

  // Scroll the green-highlighted 表达锦囊 sentence into view once the transcript
  // tab is actually visible (scrollIntoView is a no-op while it's display:none).
  useEffect(() => {
    if (quotedIdx == null || activeTab !== "transcript") return
    segmentRefs.current[quotedIdx]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [quotedIdx, activeTab])

  // Manual transcript clicks clear any 表达锦囊 green highlight.
  const handleSeek = useCallback((ms: number) => { setQuotedIdx(null); seekTo(ms / 1000) }, [seekTo])

  // Jump here from a 表达锦囊 card: switch to the transcript, seek the video,
  // and green-highlight the matched sentence so the learner can locate it.
  const handleExpressionJump = useCallback((idx: number, ms: number) => {
    setActiveTab("transcript")
    setQuotedIdx(idx)
    seekTo(ms / 1000)
  }, [seekTo])

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
      phonetic: t.phonetic || null,
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

  const showLevelNotice =
    !isLoading && !transcriptError && cefrLevel !== appliedLevel && dismissedForLevel !== cefrLevel

  return (
    <>
      {/* Level-changed-mid-watch hint (token guardrail: applies on next video) */}
      {showLevelNotice && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs text-stone-600 shadow-lg">
          <span>
            {t.watch.levelChangedPre}<span className="font-semibold uppercase">{cefrLevel}</span>{t.watch.levelChangedPost}
          </span>
          <button
            onClick={() => setDismissedForLevel(cefrLevel)}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Full-screen loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white gap-5">
          <div className="w-10 h-10 rounded-full border-[3px] border-stone-200 border-t-stone-500 animate-spin" />
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-[15px] font-semibold text-stone-800">{t.watch.loadingWorkspace}</p>
            <p className="text-sm text-stone-400">{t.watch.fetchingSubtitles}</p>
          </div>
        </div>
      )}

      {/* Full-screen error overlay */}
      {!isLoading && transcriptError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-stone-900/5 px-10 py-10 max-w-md w-full mx-4 text-center">
            <p className="text-lg font-bold text-stone-900 mb-3">
              {transcriptError === "quota_exceeded" ? t.watch.quotaExceededTitle : t.watch.cannotAnalyzeTitle}
            </p>
            <p className="text-sm text-stone-500 leading-relaxed mb-8">
              {transcriptError === "quota_exceeded"
                ? t.watch.quotaExceededBody
                : transcriptError === "no_transcript"
                ? t.watch.noTranscriptBody
                : t.watch.loadFailedBody}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="px-5 py-2 rounded-full text-sm font-medium border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
              >
                {t.watch.backHome}
              </button>
              {transcriptError !== "quota_exceeded" && (
                <button
                  onClick={fetchTranscript}
                  className="px-5 py-2 rounded-full text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  {t.watch.retry}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto bg-stone-100/60">
        <div className="h-full flex gap-4 px-20 py-6">

        {/* ── Left column ── */}
        <div className="flex flex-col w-2/3 min-h-0 gap-4">

          {/* Video */}
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-stone-900 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div id={PLAYER_ID} className="w-full h-full" />
          </div>

          {/* Learning display */}
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col justify-center px-8 py-6 gap-5">
              {!segments.length ? (
                <p className="text-stone-300 text-xl">{t.watch.transcriptLoading}</p>
              ) : activeIdx < 0 ? (
                <p className="text-stone-300 text-xl">{t.watch.playToStart}</p>
              ) : (
                <>
                  <LearningText
                    text={currentSeg?.text ?? ""}
                    vocabTerms={vocabTerms}
                    cefrLevel={appliedLevel}
                    onWordClick={handleWordClick}
                    translation={translations[currentSeg?.text ?? ""] ?? null}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col w-1/3 min-h-0 rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-1 flex-1 bg-stone-100 rounded-xl p-1">
              <TabBtn active={activeTab === "transcript"} onClick={() => setActiveTab("transcript")}>
                <Languages className="w-3.5 h-3.5" />
                {t.watch.tabTranscript}
              </TabBtn>
              <TabBtn active={activeTab === "notes"} onClick={() => setActiveTab("notes")}>
                <PenLine className="w-3.5 h-3.5" />
                {t.watch.tabCards}
              </TabBtn>
              <TabBtn active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>
                <MessageSquare className="w-3.5 h-3.5" />
                {t.watch.tabChat}
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
                      isQuoted={quotedIdx === i}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 生词本 tab */}
          <div className={cn("flex-1 overflow-y-auto pb-2", activeTab !== "notes" && "hidden")}>
            {vocabError ? (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <p className="text-sm text-stone-500">{t.watch.vocabFailed}</p>
                <button
                  onClick={fetchVocab}
                  className="px-4 py-1.5 rounded-full text-xs font-medium border border-stone-300 text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  {t.watch.reanalyze}
                </button>

                <div className="w-full border-t border-stone-100 pt-4 mt-1">
                  {!showKeyInput ? (
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
                    >
                      {t.watch.useOwnKey}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-xs text-stone-500 font-medium text-left">{t.watch.selectProvider}</p>
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
                        {t.watch.saveAndRetry}
                      </button>
                      <p className="text-[11px] text-stone-400">
                        {selectedProvider === "google" && <>{t.watch.keyHintGooglePre}<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">Google AI Studio</a>{t.watch.keyHintGooglePost}</>}
                        {selectedProvider === "openai" && <>{t.watch.keyHintOpenaiPre}<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">OpenAI Platform</a>{t.watch.keyHintOpenaiPost}</>}
                        {selectedProvider === "anthropic" && <>{t.watch.keyHintAnthropicPre}<a href="https://console.anthropic.com/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-600">Anthropic Console</a>{t.watch.keyHintAnthropicPost}</>}
                      </p>
                      <p className="text-[11px] text-stone-400">{t.watch.keyPrivacy}</p>
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
                {t.watch.analyzingVocab}
              </div>
            ) : (
              <>
                {filteredVocab.length > 0 && (
                  <div className="sticky top-0 z-10 bg-white px-3 pt-2 pb-1 flex justify-end">
                    <button
                      onClick={() => setHideTranslation((v) => !v)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        hideTranslation
                          ? "bg-stone-900 text-white border-stone-900"
                          : "border-stone-200 text-stone-500 hover:border-stone-400"
                      )}
                    >
                      {hideTranslation ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {t.watch.hideTranslation}
                    </button>
                  </div>
                )}
                <VocabSection title={t.watch.vocabularyHeading} items={filteredVocab.filter((i) => !i.isPhrase)} onDelete={handleDeleteVocab} hideTranslation={hideTranslation} />
                <VocabSection title={t.watch.shortPhrasesHeading} items={filteredVocab.filter((i) => i.isPhrase)} onDelete={handleDeleteVocab} hideTranslation={hideTranslation} />
                <ExpressionSection expressions={expressions} segments={segments} onJump={handleExpressionJump} hideTranslation={hideTranslation} />
              </>
            )}
          </div>

          {/* Chat tab */}
          <div className={cn("flex-1 min-h-0 flex flex-col", activeTab !== "chat" && "hidden")}>
            <ChatPanel ref={chatPanelRef} transcript={transcriptText} />
          </div>

        </div>
        </div>
        <Footer />
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

// ── 表达锦囊 (functional expressions) ─────────────────────────────────────────

// Resolve a video_quote to the transcript segment that contains it. Falls back
// to matching the quote's first few words (segmentation differs per level, so an
// exact whole-quote match isn't given). Returns the segment index, or null.
function findSegmentIndex(quote: string, segments: Segment[]): number | null {
  const q = quote.toLowerCase().trim().replace(/\s+/g, " ")
  if (!q) return null
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ")
  let idx = segments.findIndex((s) => norm(s.text).includes(q))
  if (idx >= 0) return idx
  const head = q.split(" ").slice(0, 6).join(" ")
  idx = segments.findIndex((s) => norm(s.text).includes(head))
  return idx >= 0 ? idx : null
}

// The AI is asked for the single sentence where an expression appears, but it
// sometimes returns a whole paragraph. Show only the one sentence that contains
// the expression (matched via the pattern's literal text), falling back to the
// first sentence — so the card stays a tidy single line, not a wall of text.
function extractQuoteSentence(quote: string, pattern: string): string {
  const clean = quote.trim().replace(/\s+/g, " ")
  const sentences = (clean.match(/[^.!?]+[.!?]*/g) ?? [clean]).map((s) => s.trim()).filter(Boolean)
  if (sentences.length <= 1) return clean
  // needle = the longest literal fragment of the pattern around its ___ slot
  const needle = pattern
    .split(/_+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0]
  if (needle) {
    const hit = sentences.find((s) => s.toLowerCase().includes(needle.toLowerCase()))
    if (hit) return hit
  }
  return sentences[0]
}

function ExpressionSection({ expressions, segments, onJump, hideTranslation }: {
  expressions: ExpressionCard[]
  segments: Segment[]
  onJump: (idx: number, ms: number) => void
  hideTranslation: boolean
}) {
  const { t } = useLanguage()
  if (!expressions.length) return null
  return (
    <div className="mt-2 border-t border-stone-100 pt-1">
      <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-center">{t.watch.expressionTips}</p>
      {expressions.map((exp, i) => (
        <ExpressionCardItem key={i} exp={exp} segments={segments} onJump={onJump} hideTranslation={hideTranslation} />
      ))}
    </div>
  )
}

function ExpressionCardItem({ exp, segments, onJump, hideTranslation }: {
  exp: ExpressionCard
  segments: Segment[]
  onJump: (idx: number, ms: number) => void
  hideTranslation: boolean
}) {
  const { t } = useLanguage()
  const idx = useMemo(() => findSegmentIndex(exp.video_quote, segments), [exp.video_quote, segments])
  const canJump = idx != null
  const quote = useMemo(() => extractQuoteSentence(exp.video_quote, exp.pattern), [exp.video_quote, exp.pattern])

  return (
    <div className="mx-3 mb-2 rounded-xl bg-stone-50 px-4 py-3">
      <p className="text-xs font-medium text-stone-500">{exp.scenario_zh}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{exp.pattern}</p>

      {/* video original sentence — green underline, click to jump */}
      <button
        type="button"
        disabled={!canJump}
        onClick={() => canJump && onJump(idx!, segments[idx!].startMs)}
        title={canJump ? t.watch.jumpToVideo : undefined}
        className={cn(
          "mt-2 block text-left text-sm italic leading-snug underline decoration-2 underline-offset-2",
          canJump
            ? "text-stone-600 decoration-green-500 hover:decoration-green-600 cursor-pointer"
            : "text-stone-500 decoration-stone-300 cursor-default"
        )}
      >
        &ldquo;{quote}&rdquo;
      </button>

      {exp.transfers?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{t.watch.worksElsewhere}</p>
          {exp.transfers.map((tr, i) => (
            <div key={i} className="leading-snug">
              <p className="text-xs text-stone-600">{tr.en}</p>
              <p className={cn("text-xs text-stone-400", hideTranslation && "blur-sm select-none")}>{tr.zh}</p>
            </div>
          ))}
        </div>
      )}

      {exp.register_zh && (
        <p className="mt-3 text-xs text-stone-400 leading-snug">💡 {exp.register_zh}</p>
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
  phonetic: string | null
  isPhrase: boolean
  example: string | null
  zh_example: string | null
  loadingExample: boolean
}

function VocabSection({ title, items, onDelete, hideTranslation }: { title: string; items: VocabListItem[]; onDelete: (key: string) => void; hideTranslation: boolean }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  if (items.length === 0) return null
  return (
    <div className="mb-1">
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 text-center">{title}</p>
      {items.map((item) => (
        <VocabItem key={item.key} item={item} openKey={openKey} setOpenKey={setOpenKey} onDelete={onDelete} hideTranslation={hideTranslation} />
      ))}
    </div>
  )
}

function VocabItem({ item, openKey, setOpenKey, onDelete, hideTranslation }: {
  item: VocabListItem
  openKey: string | null
  setOpenKey: (key: string | null) => void
  onDelete: (key: string) => void
  hideTranslation: boolean
}) {
  const { t } = useLanguage()
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
              {t.watch.lookUpOnWiktionary}
            </a>
            <a
              href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(item.content)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              onClick={() => setOpenKey(null)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              {t.watch.lookUpOnCambridge}
            </a>
            <a
              href={`https://www.ldoceonline.com/dictionary/${encodeURIComponent(item.content)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
              onClick={() => setOpenKey(null)}
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
              {t.watch.lookUpOnLongman}
            </a>
            <button
              onClick={() => { onDelete(item.key); setOpenKey(null) }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-stone-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              {t.watch.remove}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm font-medium text-stone-900">{item.content}</span>
        {item.phonetic && <span className="text-xs text-stone-400">/{item.phonetic.replace(/^\/|\/$/g, "")}/</span>}
        {item.pos && item.pos !== "phr." && <span className="text-xs text-stone-400 italic">{item.pos}</span>}
        {item.zh_definition && (
          <span className={cn("text-xs text-stone-500", hideTranslation && "blur-sm select-none")}>
            {item.zh_definition}
          </span>
        )}
      </div>
      {item.example ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-xs text-stone-400 italic leading-snug">"{item.example}"</p>
          {item.zh_example && (
            <p className={cn("text-xs text-stone-300 leading-snug", hideTranslation && "blur-sm select-none")}>
              {item.zh_example}
            </p>
          )}
        </div>
      ) : item.loadingExample ? (
        <div className="mt-1 flex items-center gap-1.5">
          <svg className="w-3 h-3 animate-spin text-stone-300 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs text-stone-300">{t.watch.loadingExample}</span>
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

