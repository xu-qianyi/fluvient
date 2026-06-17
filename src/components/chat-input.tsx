"use client"

import { useRef, useState } from "react"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  placeholder?: string
  onSend?: (message: string) => void
  disabled?: boolean
  className?: string
}

// Stone-toned conic gradient — light top-left, dark bottom-right
const OUTER = {
  tl: "#d6d3d1", // stone-300
  tr: "#a8a29e", // stone-400
  br: "#78716c", // stone-500
  bl: "#c4bfbb", // stone-350-ish
}
const INNER = {
  tl: "#e7e5e4", // stone-200
  tr: "#d6d3d1", // stone-300
  br: "#a8a29e", // stone-400
  bl: "#dbd8d5", // stone-250-ish
}

function conicGradient(c: typeof OUTER) {
  return `conic-gradient(from 0deg at 50% 50%, ${c.tl} 0deg, ${c.tr} 90deg, ${c.br} 180deg, ${c.bl} 270deg, ${c.tl} 360deg)`
}

export function ChatInput({ placeholder = "Type a message…", onSend, disabled = false, className }: Props) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!message.trim() || disabled) return
    onSend?.(message.trim())
    setMessage("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }

  const canSend = message.trim().length > 0 && !disabled

  return (
    <div className={cn("relative", className)}>
      {/* Outer thin border */}
      <div
        className="absolute inset-0 rounded-[20px] p-px"
        style={{ background: conicGradient(OUTER) }}
      >
        {/* Main thick border */}
        <div
          className="h-full w-full rounded-[19px] p-0.5"
          style={{ background: conicGradient(INNER) }}
        >
          {/* Background fill */}
          <div className="h-full w-full rounded-[17px] bg-white relative">
            {/* Inner inset border */}
            <div
              className="absolute inset-0 rounded-[17px] p-px pointer-events-none"
              style={{
                background: conicGradient({
                  tl: "rgba(215,212,209,0.15)",
                  tr: "rgba(168,162,158,0.15)",
                  br: "rgba(120,113,108,0.15)",
                  bl: "rgba(196,191,187,0.15)",
                }),
              }}
            >
              <div className="h-full w-full rounded-[16px] bg-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative px-4 pt-3 pb-3">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none border-0 bg-transparent",
              "text-stone-900 placeholder:text-stone-400 text-sm leading-6",
              "focus:outline-none focus:ring-0 py-1",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ minHeight: 28, maxHeight: 120 }}
          />

          <button
            onClick={() => handleSubmit()}
            disabled={!canSend}
            className={cn(
              "flex items-center justify-center w-7 h-7 mb-0.5 rounded-full transition-all duration-150",
              canSend
                ? "bg-stone-900 text-white hover:bg-stone-700"
                : "text-stone-300 cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Drop shadow */}
      <div
        className="absolute -bottom-3 left-4 right-4 h-6 rounded-full blur-md pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(28,25,23,0.07) 0%, transparent 100%)" }}
      />
    </div>
  )
}
