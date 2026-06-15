"use client"

import { useEffect, useRef } from "react"

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

  const gap = 6
  const bottomFromViewport = window.innerHeight - anchorRect.top + gap
  const left = anchorRect.left + anchorRect.width / 2

  return (
    <div
      ref={ref}
      style={{ bottom: bottomFromViewport, left, transform: "translateX(-50%)" }}
      className="fixed z-50 rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden"
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { onTranslate(text); onClose() }}
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors whitespace-nowrap"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
          <path d="M18.5 10L22.9 21H20.745L19.544 18H15.454L14.255 21H12.101L16.5 10H18.5ZM10 2V4H16V6L14.0322 6.0006C13.2425 8.36616 11.9988 10.5057 10.4115 12.301C11.1344 12.9457 11.917 13.5176 12.7475 14.0079L11.9969 15.8855C10.9237 15.2781 9.91944 14.5524 8.99961 13.7249C7.21403 15.332 5.10914 16.5553 2.79891 17.2734L2.26257 15.3442C4.2385 14.7203 6.04543 13.6737 7.59042 12.3021C6.46277 11.0281 5.50873 9.57985 4.76742 8.00028L7.00684 8.00037C7.57018 9.03885 8.23979 10.0033 8.99967 10.877C10.2283 9.46508 11.2205 7.81616 11.9095 6.00101L2 6V4H8V2H10ZM17.5 12.8852L16.253 16H18.745L17.5 12.8852Z" />
        </svg>
        AI 翻译
      </button>
    </div>
  )
}
