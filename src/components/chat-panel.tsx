"use client"

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react"
import { withUserApiKey } from "@/lib/user-api-key"
import { useLanguage } from "@/contexts/language-context"
import { Send, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Props {
  transcript: string
}

export interface ChatPanelHandle {
  sendMessage: (text: string) => void
}

const DEFAULT_PROMPTS: { label: string; icon?: boolean }[] = [
  { label: "What are the key takeaways?", icon: false },
  { label: "What are the most interesting quotes?", icon: false },
  { label: "Summarize this video in 3 sentences", icon: false },
  { label: "Generate a vocabulary cheatsheet", icon: true },
]

export const ChatPanel = forwardRef<ChatPanelHandle, Props>(({ transcript }, ref) => {
  const { t } = useLanguage()
  const [messages, setMessagesState] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesRef = useRef<Message[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const setMessages = useCallback((msgs: Message[]) => {
    messagesRef.current = msgs
    setMessagesState(msgs)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { role: "user", content: text }
    const next = [...messagesRef.current, userMsg]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: withUserApiKey({ "Content-Type": "application/json" }),
        body: JSON.stringify({ messages: next, transcript }),
      })
      const data = await r.json()
      setMessages([...next, {
        role: "assistant",
        content: data.message ?? t.chat.errorRetry,
      }])
    } catch {
      setMessages([...next, { role: "assistant", content: t.chat.errorRetry }])
    } finally {
      setLoading(false)
    }
  }, [transcript, setMessages, t])

  useImperativeHandle(ref, () => ({ sendMessage }), [sendMessage])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages / Default prompts */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5">
            {DEFAULT_PROMPTS.map(({ label, icon }) => (
              <button
                key={label}
                onClick={() => sendMessage(label)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 hover:border-stone-300 transition-colors"
              >
                {icon && <Sparkles className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "user" ? (
                  <div className="max-w-[88%] rounded-2xl rounded-tr-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap bg-stone-200 text-stone-900">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-1 items-center py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-stone-100 px-3 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat.placeholder}
            disabled={loading}
            className="flex-1 text-sm bg-stone-100 rounded-full px-4 py-2 outline-none placeholder:text-stone-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center disabled:opacity-30 transition-opacity hover:bg-stone-700"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
})

ChatPanel.displayName = "ChatPanel"
