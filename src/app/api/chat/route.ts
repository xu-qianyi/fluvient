import { NextResponse } from "next/server"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface Body {
  messages: ChatMessage[]
  transcript?: string
}

export async function POST(req: Request) {
  const { messages, transcript }: Body = await req.json()
  if (!messages?.length) return NextResponse.json({ error: "missing messages" }, { status: 400 })

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 })

  try {
    const google = createGoogleGenerativeAI({ apiKey })
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system: `You are a helpful AI assistant built into an English learning app for Chinese speakers.
The user is learning English by watching videos. Help them understand the content.
- When asked for translation, translate English to natural Chinese.
- When asked about the video, answer based on the transcript below.
- Respond in Chinese unless the user explicitly asks for English.
- Keep answers concise and clear.

${transcript ? `Video transcript:\n${transcript.slice(0, 8000)}` : ""}`,
      messages,
    })
    return NextResponse.json({ message: text })
  } catch (err) {
    console.error("[chat]", err)
    return NextResponse.json({ error: "ai_failed" }, { status: 500 })
  }
}
