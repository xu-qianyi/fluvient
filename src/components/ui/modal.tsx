"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const

/**
 * Shared centered dialog: backdrop + blurred overlay + white card. Used by the
 * login, onboarding and feedback popups so they share one look and one set of
 * dismiss behaviours.
 *
 * Dismissal is opt-out: by default the dialog closes on Escape, on backdrop
 * click, and via the corner ✕. Forced flows (e.g. first-run onboarding) turn
 * these off and supply their own affordance.
 */
export function Modal({
  onClose,
  children,
  size = "sm",
  className,
  closeOnBackdrop = true,
  closeOnEsc = true,
  showClose = true,
}: {
  onClose: () => void
  children: React.ReactNode
  size?: keyof typeof SIZES
  /** Extra classes for the card (e.g. padding overrides). */
  className?: string
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
  showClose?: boolean
}) {
  useEffect(() => {
    if (!closeOnEsc) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [closeOnEsc, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      {/* Card */}
      <div
        className={cn(
          "relative w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-xl",
          SIZES[size],
          className
        )}
      >
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
