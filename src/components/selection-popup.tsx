"use client"

import { useEffect, useRef } from "react"
import { Languages } from "lucide-react"

interface Props {
  text: string
  anchorRect: DOMRect
  onClose: () => void
  onTranslate: (text: string) => void
}

export function SelectionPopup({ text, anchorRect, onClose, onTranslate }: Props) {
  const ref = useRef<HTMLDivElement>(null)

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

  const popupW = 120
  const gap = 6
  const bottomFromViewport = window.innerHeight - anchorRect.top + gap
  let left = anchorRect.left + (anchorRect.width - popupW) / 2
  if (left < 8) left = 8
  if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8

  return (
    <div
      ref={ref}
      style={{ bottom: bottomFromViewport, left, width: popupW }}
      className="fixed z-50 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden"
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { onTranslate(text); onClose() }}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <Languages className="w-3.5 h-3.5" />
        AI 翻译
      </button>
    </div>
  )
}
