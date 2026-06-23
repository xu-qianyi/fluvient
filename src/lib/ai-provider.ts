import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import type { ApiProvider } from "./user-api-key"

// Ordered list of models for a provider: primary first, fallbacks after.
// All models in a chain share the same API key, so fallbacks stay within the
// same provider (only a Google key ships by default). When the primary model is
// overloaded (503) we retry the same call with the next model.
export function createModelChain(apiKey: string, provider: ApiProvider = "google"): LanguageModel[] {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey })
      return [openai("gpt-4o-mini")]
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey })
      return [anthropic("claude-haiku-4-5-20251001")]
    }
    default: {
      const google = createGoogleGenerativeAI({ apiKey })
      return [google("gemini-2.5-flash-lite"), google("gemini-2.5-flash")]
    }
  }
}

export function getProviderFromHeader(req: Request): ApiProvider {
  const p = req.headers.get("X-User-Api-Provider")
  if (p === "openai" || p === "anthropic") return p
  return "google"
}

// An error worth retrying on a *different* model: overload / rate limit / 5xx.
// Auth (401) or bad-request (400) errors won't be fixed by another model on the
// same key, so we let those fail fast.
function isTransientModelError(err: unknown): boolean {
  const e = err as { isRetryable?: boolean; statusCode?: number } | null
  if (e?.isRetryable === true) return true
  const sc = e?.statusCode
  return sc === 429 || sc === 500 || sc === 502 || sc === 503 || sc === 529
}

// Run an AI call across the model chain. On a transient failure with one model,
// retry the SAME call with the next model in the chain. Re-throws the last error
// if every model fails (or immediately on a non-transient error).
export async function runWithModelFallback<T>(
  apiKey: string,
  provider: ApiProvider,
  run: (model: LanguageModel) => Promise<T>,
): Promise<T> {
  const models = createModelChain(apiKey, provider)
  let lastErr: unknown
  for (let i = 0; i < models.length; i++) {
    try {
      return await run(models[i])
    } catch (err) {
      lastErr = err
      const isLast = i === models.length - 1
      if (isLast || !isTransientModelError(err)) throw err
      console.warn(
        `[ai] model ${i + 1}/${models.length} failed (${(err as { statusCode?: number })?.statusCode ?? "?"}), falling back`,
      )
    }
  }
  throw lastErr
}
