export type ApiProvider = "google" | "openai" | "anthropic"

const KEY_STORAGE = "echolingo_user_api_key"
const PROVIDER_STORAGE = "echolingo_user_api_provider"

export function getUserApiKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(KEY_STORAGE) || null
}

export function getUserApiProvider(): ApiProvider {
  if (typeof window === "undefined") return "google"
  return (localStorage.getItem(PROVIDER_STORAGE) as ApiProvider) || "google"
}

export function setUserApi(key: string, provider: ApiProvider) {
  localStorage.setItem(KEY_STORAGE, key)
  localStorage.setItem(PROVIDER_STORAGE, provider)
}

export function clearUserApi() {
  localStorage.removeItem(KEY_STORAGE)
  localStorage.removeItem(PROVIDER_STORAGE)
}

export function withUserApiKey(headers: HeadersInit = {}): HeadersInit {
  const key = getUserApiKey()
  if (!key) return headers
  return {
    ...headers,
    "X-User-Api-Key": key,
    "X-User-Api-Provider": getUserApiProvider(),
  }
}
