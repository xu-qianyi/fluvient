"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import { Modal } from "@/components/ui/modal"

export function AuthModal() {
  const { authModalOpen, hideAuthModal, signInWithGoogle, signInWithEmail } = useAuth()
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [linkSent, setLinkSent] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (authModalOpen) {
      setEmail("")
      setLinkSent(false)
      setEmailError("")
      setResent(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [authModalOpen])

  if (!authModalOpen) return null

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEmailLoading(true)
    setEmailError("")
    const { error } = await signInWithEmail(email.trim(), window.location.pathname)
    setEmailLoading(false)
    if (error) setEmailError(error)
    else setLinkSent(true)
  }

  async function handleResend() {
    if (resending) return
    setResending(true)
    setResent(false)
    const { error } = await signInWithEmail(email.trim(), window.location.pathname)
    setResending(false)
    if (!error) setResent(true)
  }

  return (
    <Modal onClose={hideAuthModal} size="sm" className="p-8">
        {linkSent ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-5 w-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-stone-900">{t.auth.linkSentTitle}</h2>
            <p className="mt-1.5 text-sm text-stone-500">
              {t.auth.linkSentPre}<span className="text-stone-700 font-medium">{email}</span>{t.auth.linkSentPost}{" "}
              {t.auth.checkSpam}
            </p>
            <div className="mt-5 flex w-full flex-col items-center gap-2">
              <button
                onClick={handleResend}
                disabled={resending || resent}
                className="h-9 w-full rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60 disabled:hover:bg-white transition-colors"
              >
                {resending ? t.auth.resending : resent ? t.auth.resent : t.auth.resend}
              </button>
              <button
                onClick={() => { setLinkSent(false); setEmailError(""); setResent(false) }}
                className="text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
              >
                {t.auth.changeEmail}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-stone-900">{t.auth.title}</h2>
              <p className="mt-1.5 text-sm text-stone-500">{t.auth.subtitle}</p>
            </div>

            {/* Google OAuth */}
            <button
              onClick={() => signInWithGoogle(window.location.pathname)}
              className="flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">{t.auth.orEmail}</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleEmailSubmit} className="space-y-2.5">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-11 rounded-lg border border-stone-200 px-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
              {emailError && (
                <p className="text-xs text-red-500">{emailError}</p>
              )}
              <button
                type="submit"
                disabled={emailLoading || !email.trim()}
                className={cn(
                  "w-full h-11 rounded-lg text-sm font-medium transition-colors",
                  email.trim() && !emailLoading
                    ? "bg-stone-900 text-white hover:bg-stone-700"
                    : "bg-stone-100 text-stone-400 cursor-not-allowed"
                )}
              >
                {emailLoading ? t.auth.sending : t.auth.sendLink}
              </button>
            </form>

            {/* Consent */}
            <p className="mt-6 text-center text-xs leading-relaxed text-stone-400">
              {t.auth.consentPre}{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-stone-500 underline underline-offset-2 hover:text-stone-700"
              >
                {t.auth.terms}
              </Link>{" "}
              {t.auth.consentAnd}{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="text-stone-500 underline underline-offset-2 hover:text-stone-700"
              >
                {t.auth.privacy}
              </Link>
            </p>
          </div>
        )}
    </Modal>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
