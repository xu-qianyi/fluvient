"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Check, ExternalLink } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { type CefrLevel } from "@/data/cefr-words"
import { CEFR_LEVELS, CEFR_TEST_URL } from "@/lib/learner-options"
import { locales } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Per-level badge colors: a cool→warm difficulty gradient (entry-level green →
// advanced rose) so the badges read as level cues, not as the black CTA button.
const LEVEL_BADGE: Record<CefrLevel, string> = {
  a1: "bg-emerald-100 text-emerald-700",
  a2: "bg-teal-100 text-teal-700",
  b1: "bg-amber-100 text-amber-700",
  b2: "bg-orange-100 text-orange-700",
  c1: "bg-rose-100 text-rose-700",
}

// First-run flow: native language + level + a soft login nudge. Shown ONCE per
// browser (the `onboarded` flag), only on the home page, so shared /watch deep
// links are never interrupted. Anonymous users complete it without logging in;
// their choices live in localStorage.
export function Onboarding() {
  const pathname = usePathname()
  const { loading, showAuthModal } = useAuth()
  const {
    hydrated,
    onboarded,
    locale,
    setLocale,
    cefrLevel,
    setCefrLevel,
    markOnboarded,
    t,
  } = useLanguage()

  const [step, setStep] = useState(0)
  const [level, setLevel] = useState<CefrLevel>(cefrLevel)

  const open = hydrated && !loading && !onboarded && pathname === "/"
  if (!open) return null

  function commit() {
    setCefrLevel(level)
    markOnboarded()
  }

  function finish() {
    commit()
  }

  function loginAndSave() {
    commit()
    showAuthModal()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        {/* Skip — respects "don't force new users"; keeps current defaults. */}
        <button
          onClick={finish}
          className="absolute right-5 top-5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          {t.onboarding.skip}
        </button>

        {/* Progress dots */}
        <div className="mb-5 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-6 bg-stone-900" : "w-2 bg-stone-200"
              )}
            />
          ))}
        </div>

        {/* ── Step 0: app language (UI locale) ── */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {t.onboarding.langTitle}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t.onboarding.langDesc}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {locales.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors",
                    locale === l.code
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:bg-stone-50"
                  )}
                >
                  <span className="text-lg">{l.flag}</span>
                  <span className="text-sm font-medium text-stone-900">{l.label}</span>
                  {locale === l.code && <Check className="ml-auto h-4 w-4 text-stone-900" />}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="mt-5 h-11 w-full rounded-lg bg-stone-900 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              {t.onboarding.continue}
            </button>
          </div>
        )}

        {/* ── Step 1: CEFR level ── */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {t.onboarding.levelTitle}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t.onboarding.levelDesc}
            </p>

            <div className="mt-4 space-y-2">
              {CEFR_LEVELS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLevel(l.code)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    level === l.code
                      ? "border-stone-900 bg-stone-50"
                      : "border-stone-200 hover:bg-stone-50"
                  )}
                >
                  <span className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                    LEVEL_BADGE[l.code]
                  )}>
                    {l.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-900">
                      {l.band[locale]}
                    </span>
                    <span className="block text-xs text-stone-500">{l.canDo[locale]}</span>
                  </span>
                  {level === l.code && <Check className="h-4 w-4 shrink-0 text-stone-900" />}
                </button>
              ))}
            </div>

            <a
              href={CEFR_TEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              {t.onboarding.notSureTest}
              <ExternalLink className="h-3 w-3" />
            </a>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="h-11 rounded-lg border border-stone-200 px-4 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                {t.onboarding.back}
              </button>
              <button
                onClick={() => setStep(2)}
                className="h-11 flex-1 rounded-lg bg-stone-900 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
              >
                {t.onboarding.continue}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: login nudge (optional) ── */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              {t.onboarding.loginTitle}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {t.onboarding.loginDesc}
            </p>

            <button
              onClick={loginAndSave}
              className="mt-5 h-11 w-full rounded-lg bg-stone-900 text-sm font-medium text-white hover:bg-stone-700 transition-colors"
            >
              {t.onboarding.loginAndSave}
            </button>
            <button
              onClick={finish}
              className="mt-2 h-11 w-full rounded-lg text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
            >
              {t.onboarding.maybeLater}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
