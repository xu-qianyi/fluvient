"use client"

import { useEffect, useRef, useState } from "react"
import { Check, SlidersHorizontal } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { CEFR_LEVELS, NATIVE_LANGUAGES } from "@/lib/learner-options"
import { locales } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Header control for changing level / interface language after onboarding. Writes
// to localStorage immediately (and syncs to the DB when logged in). Changing the
// level here does NOT re-generate the current video — it takes effect on the
// next one (see the guardrail in video-layout).
export function SettingsMenu() {
  const { user, showAuthModal } = useAuth()
  const { locale, setLocale, cefrLevel, setCefrLevel, nativeLanguage, setNativeLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm text-stone-600 hover:bg-stone-100 transition-colors"
        title={locale === "zh" ? "学习设置" : "Learning settings"}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold uppercase">{cefrLevel}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg border border-stone-200 bg-white shadow-sm p-2 z-50">
          {/* Level */}
          <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-stone-500">
            {locale === "zh" ? "英语水平" : "English level"}
          </p>
          <div className="space-y-0.5">
            {CEFR_LEVELS.map((l) => (
              <button
                key={l.code}
                onClick={() => setCefrLevel(l.code)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-stone-50",
                  cefrLevel === l.code ? "text-stone-900 font-medium" : "text-stone-600"
                )}
              >
                <span className="w-7 shrink-0 text-xs font-bold uppercase text-stone-400">
                  {l.code}
                </span>
                <span className="flex-1 truncate">{l.band[locale]}</span>
                {cefrLevel === l.code && <Check className="h-3.5 w-3.5 shrink-0 text-stone-900" />}
              </button>
            ))}
          </div>

          {/* Interface language */}
          <p className="px-2 pt-3 pb-1.5 text-xs font-semibold text-stone-500">
            {locale === "zh" ? "界面语言" : "Language"}
          </p>
          <div className="space-y-0.5">
            {locales.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-stone-50",
                  locale === l.code ? "text-stone-900 font-medium" : "text-stone-600"
                )}
              >
                <span>{l.flag}</span>
                <span className="flex-1 truncate">{l.label}</span>
                {locale === l.code && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-stone-900" />
                )}
              </button>
            ))}
          </div>

          {/* Translation language — only Chinese is wired up in the backend
              today; the rest are placeholders to signal the roadmap. */}
          <p className="px-2 pt-3 pb-1.5 text-xs font-semibold text-stone-500">
            {locale === "zh" ? "释义语言" : "Translation language"}
          </p>
          <div className="space-y-0.5">
            {NATIVE_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                disabled={!lang.active}
                onClick={() => setNativeLanguage(lang.code)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  !lang.active && "cursor-not-allowed opacity-50",
                  lang.active && "hover:bg-stone-50",
                  nativeLanguage === lang.code ? "text-stone-900 font-medium" : "text-stone-600"
                )}
              >
                <span>{lang.flag}</span>
                <span className="flex-1 truncate">{lang.label}</span>
                {lang.active && nativeLanguage === lang.code && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-stone-900" />
                )}
                {!lang.active && (
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-400">
                    {locale === "zh" ? "即将支持" : "Soon"}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Login nudge for anonymous users */}
          {!user && (
            <div className="mt-2 border-t border-stone-100 pt-2">
              <button
                onClick={() => {
                  setOpen(false)
                  showAuthModal()
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50 transition-colors"
              >
                {locale === "zh" ? "登录以跨设备保存设置 →" : "Log in to save across devices →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
