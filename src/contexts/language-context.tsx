"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { type Locale, translations } from "@/lib/i18n"
import { type CefrLevel } from "@/data/cefr-words"
import { type NativeLanguage } from "@/lib/learner-options"
import { useAuth } from "@/contexts/auth-context"

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (typeof translations)[Locale]
  cefrLevel: CefrLevel
  setCefrLevel: (level: CefrLevel) => void
  nativeLanguage: NativeLanguage
  setNativeLanguage: (lang: NativeLanguage) => void
  /** True once localStorage has been read. Gate UI on this to avoid flashes. */
  hydrated: boolean
  /** Whether this person has completed (or skipped) onboarding. */
  onboarded: boolean
  markOnboarded: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const LOCALE_KEY = "echolingo-locale"
const CEFR_KEY = "echolingo-cefr"
const NATIVE_KEY = "echolingo-native"
const ONBOARDED_KEY = "echolingo-onboarded"
const VALID_CEFR: CefrLevel[] = ["a1", "a2", "b1", "b2", "c1"]
const VALID_NATIVE: NativeLanguage[] = ["zh", "ko", "es", "fr"]

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<Locale>("zh")
  const [cefrLevel, setCefrLevelState] = useState<CefrLevel>("b1")
  const [nativeLanguage, setNativeLanguageState] = useState<NativeLanguage>("zh")
  const [hydrated, setHydrated] = useState(false)
  const [onboarded, setOnboarded] = useState(false)
  // Guards the one-time server reconcile so it runs once per logged-in user.
  const syncedUserId = useRef<string | null>(null)

  // 1. Hydrate from localStorage on mount (free, login-less persistence).
  useEffect(() => {
    const storedLocale = localStorage.getItem(LOCALE_KEY) as Locale | null
    if (storedLocale === "zh" || storedLocale === "en") setLocaleState(storedLocale)

    const storedCefr = localStorage.getItem(CEFR_KEY) as CefrLevel | null
    if (storedCefr && VALID_CEFR.includes(storedCefr)) setCefrLevelState(storedCefr)

    const storedNative = localStorage.getItem(NATIVE_KEY) as NativeLanguage | null
    if (storedNative && VALID_NATIVE.includes(storedNative)) setNativeLanguageState(storedNative)

    if (localStorage.getItem(ONBOARDED_KEY) === "true") setOnboarded(true)

    setHydrated(true)
  }, [])

  function persist(level: CefrLevel, native: NativeLanguage) {
    if (!user) return // anonymous users live in localStorage only
    // Fire-and-forget: localStorage already holds the truth locally.
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cefr_level: level, native_language: native }),
    }).catch(() => {})
  }

  // 2. On login, reconcile with the server. DB wins if a row exists (it's the
  //    cross-device source of truth); otherwise seed it from local choices.
  useEffect(() => {
    if (!user) {
      syncedUserId.current = null
      return
    }
    if (!hydrated || syncedUserId.current === user.id) return
    syncedUserId.current = user.id
    ;(async () => {
      try {
        const res = await fetch("/api/settings")
        const { settings } = await res.json()
        if (settings) {
          if (VALID_CEFR.includes(settings.cefr_level)) {
            setCefrLevelState(settings.cefr_level)
            localStorage.setItem(CEFR_KEY, settings.cefr_level)
          }
          if (VALID_NATIVE.includes(settings.native_language)) {
            setNativeLanguageState(settings.native_language)
            localStorage.setItem(NATIVE_KEY, settings.native_language)
          }
          // A saved profile means this person has effectively onboarded before,
          // even on a brand-new browser.
          setOnboarded(true)
          localStorage.setItem(ONBOARDED_KEY, "true")
        } else {
          persist(cefrLevel, nativeLanguage)
        }
      } catch {
        // Offline / error → keep local values, retry on next login.
        syncedUserId.current = null
      }
    })()
  }, [user, hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  function setLocale(next: Locale) {
    setLocaleState(next)
    localStorage.setItem(LOCALE_KEY, next)
  }

  function setCefrLevel(next: CefrLevel) {
    setCefrLevelState(next)
    localStorage.setItem(CEFR_KEY, next)
    persist(next, nativeLanguage)
  }

  function setNativeLanguage(next: NativeLanguage) {
    setNativeLanguageState(next)
    localStorage.setItem(NATIVE_KEY, next)
    persist(cefrLevel, next)
  }

  function markOnboarded() {
    setOnboarded(true)
    localStorage.setItem(ONBOARDED_KEY, "true")
    // Note: we deliberately don't persist() here. Onboarding always commits the
    // level via setCefrLevel() first (which persists the *chosen* value and
    // seeds the DB row when logged in). Re-persisting here would race that write
    // with a stale closure snapshot of cefrLevel and could clobber the choice.
  }

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t: translations[locale],
        cefrLevel,
        setCefrLevel,
        nativeLanguage,
        setNativeLanguage,
        hydrated,
        onboarded,
        markOnboarded,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider")
  return ctx
}
