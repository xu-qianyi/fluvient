import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import type { ApiProvider } from "./user-api-key"

export function createModel(apiKey: string, provider: ApiProvider = "google"): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })("gpt-4o-mini")
    case "anthropic":
      return createAnthropic({ apiKey })("claude-haiku-4-5-20251001")
    default:
      return createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash")
  }
}

export function getProviderFromHeader(req: Request): ApiProvider {
  const p = req.headers.get("X-User-Api-Provider")
  if (p === "openai" || p === "anthropic") return p
  return "google"
}
