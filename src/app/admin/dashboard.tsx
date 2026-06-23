"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Trash2, RefreshCw, ChevronRight } from "lucide-react"
import type { AdminCacheData, CachedVideo } from "@/app/api/admin/cache/route"
import type { VideoCacheDetail } from "@/app/api/admin/cache/video/[id]/route"

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold text-stone-900">{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}

export function AdminDashboard({ email }: { email: string }) {
  const [data, setData] = useState<AdminCacheData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch("/api/admin/cache")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "load_failed")
        return r.json()
      })
      .then((d: AdminCacheData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const del = useCallback(
    async (type: string, id: string, label: string, level?: string) => {
      if (!confirm(`确定删除「${label}」的缓存？`)) return
      const key = `${type}:${id}:${level ?? ""}`
      setBusy(key)
      const params = new URLSearchParams({ type, id })
      if (level) params.set("level", level)
      try {
        const r = await fetch(`/api/admin/cache?${params}`, { method: "DELETE" })
        if (!r.ok) throw new Error("delete_failed")
        load()
      } catch {
        alert("删除失败")
      } finally {
        setBusy(null)
      }
    },
    [load]
  )

  return (
    <main className="flex-1 overflow-y-auto px-6 py-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">缓存后台</h1>
          <p className="text-xs text-stone-500 mt-1">{email}</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md text-sm text-stone-600 hover:bg-stone-100 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-6">
          加载失败：{error === "no_service_role_key"
            ? "缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量"
            : error}
        </div>
      )}

      {loading && !data && <p className="text-sm text-stone-400">加载中…</p>}

      {data && (
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="已加载视频" value={data.counts.videos} />
            <Stat label="词汇笔记 (视频×等级)" value={data.counts.study_notes} />
            <Stat label="单词定义" value={data.counts.definitions} />
            <Stat label="句子翻译" value={data.counts.translations} />
          </div>

          {/* Today's usage */}
          {data.usageToday.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-stone-700 mb-2">今日额度使用</h2>
              <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
                {data.usageToday.map((u) => (
                  <div key={u.client_key} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-stone-500 truncate">{u.client_key}</span>
                    <span className="text-stone-700">{u.video_count} / 3</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Videos */}
          <section>
            <h2 className="text-sm font-semibold text-stone-700 mb-2">已加载视频</h2>
            {data.videos.length === 0 ? (
              <p className="text-sm text-stone-400">暂无</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                {data.videos.map((v) => (
                  <VideoCard key={v.id} v={v} del={del} busy={busy} />
                ))}
              </div>
            )}
          </section>

          {/* Definitions */}
          <CacheList
            title="单词定义"
            empty={data.definitions.length === 0}
          >
            {data.definitions.map((d) => (
              <div key={d.word} className="flex items-center justify-between px-4 py-2 text-sm gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-stone-900">{d.word}</span>
                  {d.pos && <span className="text-stone-400 ml-1.5">{d.pos}</span>}
                  {d.phonetic && <span className="text-stone-400 ml-1.5 font-mono text-xs">{d.phonetic}</span>}
                  <span className="text-stone-500 ml-2 truncate">{d.zh_definition}</span>
                </div>
                <button
                  onClick={() => del("definition", d.word, d.word)}
                  disabled={busy === `definition:${d.word}:`}
                  className="shrink-0 text-stone-300 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CacheList>

          {/* Translations */}
          <CacheList
            title="句子翻译"
            empty={data.translations.length === 0}
          >
            {data.translations.map((t) => (
              <div key={t.text_hash} className="flex items-center justify-between px-4 py-2 text-sm gap-3">
                <div className="min-w-0">
                  <p className="text-stone-700 truncate">{t.source_text}</p>
                  <p className="text-stone-400 truncate text-xs">{t.zh}</p>
                </div>
                <button
                  onClick={() => del("translation", t.text_hash, t.source_text.slice(0, 20))}
                  disabled={busy === `translation:${t.text_hash}:`}
                  className="shrink-0 text-stone-300 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </CacheList>
        </div>
      )}
    </main>
  )
}

function VideoCard({
  v,
  del,
  busy,
}: {
  v: CachedVideo
  del: (type: string, id: string, label: string, level?: string) => void
  busy: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<VideoCacheDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const hasNotes = v.notes.length > 0

  const toggle = useCallback(() => {
    const next = !expanded
    setExpanded(next)
    if (next && !detail && !loading && hasNotes) {
      setLoading(true)
      setError(false)
      fetch(`/api/admin/cache/video/${v.id}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("load_failed")
          return r.json()
        })
        .then((d: VideoCacheDetail) => setDetail(d))
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }, [expanded, detail, loading, hasNotes, v.id])

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
          alt=""
          className="w-28 h-16 object-cover rounded bg-stone-100 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/watch/${v.youtube_id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-900 hover:underline"
          >
            {v.cefr_level && (
              <span className="shrink-0 rounded bg-stone-200 px-1 text-[10px] font-semibold uppercase text-stone-600">
                {v.cefr_level}
              </span>
            )}
            <span className="truncate">{v.title || v.youtube_id}</span>
          </Link>
          <p className="text-xs text-stone-400 truncate">
            {v.author_name ? `${v.author_name} · ` : ""}<span className="font-mono">{v.youtube_id}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {!hasNotes ? (
              <span className="text-xs text-amber-600">无词汇笔记</span>
            ) : (
              <>
                {v.notes.map((n) => (
                  <span
                    key={n.cefr_level}
                    className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600"
                  >
                    {n.cefr_level.toUpperCase()} · {n.term_count}词
                    <button
                      onClick={() => del("note", v.id, `${v.title || v.youtube_id} ${n.cefr_level}`, n.cefr_level)}
                      className="text-stone-400 hover:text-red-500"
                      title="删除该等级笔记"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  onClick={toggle}
                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                >
                  <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
                  {expanded ? "收起" : "详情"}
                </button>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => del("video", v.id, v.title || v.youtube_id)}
          disabled={busy === `video:${v.id}:`}
          className="shrink-0 self-start text-stone-300 hover:text-red-500 transition-colors"
          title="删除视频及其缓存"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && hasNotes && (
        <div className="border-t border-stone-100 px-3 py-3 space-y-4">
          {loading && <p className="text-xs text-stone-400">加载中…</p>}
          {error && <p className="text-xs text-red-500">加载失败</p>}
          {detail?.notes.map((note) => (
            <div key={note.cefr_level}>
              <p className="text-xs font-semibold uppercase text-stone-500 mb-1.5">
                {note.cefr_level} · {note.terms.length}词
              </p>
              {note.terms.length > 0 && (
                <div className="rounded-md border border-stone-100 divide-y divide-stone-100 mb-2">
                  {note.terms.map((term, i) => (
                    <div key={`${term.term}-${i}`} className="px-2.5 py-1.5">
                      <div className="flex items-baseline gap-1.5 text-sm">
                        <span className="font-medium text-stone-900">{term.term}</span>
                        {term.pos && <span className="text-stone-400 text-xs">{term.pos}</span>}
                        {term.phonetic && <span className="text-stone-400 font-mono text-xs">{term.phonetic}</span>}
                        <span className="shrink-0 rounded bg-stone-100 px-1 text-[10px] uppercase text-stone-500">
                          {term.level}
                        </span>
                        <span className="text-stone-600 ml-auto truncate">{term.definition_zh}</span>
                      </div>
                      {term.example && (
                        <p className="text-xs text-stone-400 mt-0.5 truncate">
                          {term.example}
                          {term.zh_example && <span className="text-stone-300"> · {term.zh_example}</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {note.expressions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-stone-400">表达锦囊 · {note.expressions.length}</p>
                  {note.expressions.map((exp, i) => (
                    <div key={i} className="rounded-md bg-stone-50 px-2.5 py-1.5 text-xs">
                      <p className="text-stone-700">
                        <span className="text-stone-500">{exp.scenario_zh}：</span>
                        {exp.pattern}
                      </p>
                      {exp.video_quote && (
                        <p className="text-stone-400 italic mt-0.5 truncate">“{exp.video_quote}”</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CacheList({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-stone-700 mb-2">{title}</h2>
      {empty ? (
        <p className="text-sm text-stone-400">暂无</p>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100 max-h-96 overflow-y-auto">
          {children}
        </div>
      )}
    </section>
  )
}
