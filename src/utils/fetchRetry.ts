/**
 * Shared fetch wrapper with retry logic and exponential backoff.
 * Used by API providers for transient failures (429, 503, etc.).
 */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const DEFAULT_MAX_RETRIES = 2
const BASE_DELAY_MS = 1000

export interface RetryOptions {
  /** Maximum number of retries (default: 2, so up to 3 total attempts). */
  maxRetries?: number
  /** Base delay in ms — doubled on each retry (default: 1000). */
  baseDelay?: number
}

/**
 * Fetch with automatic retry on transient HTTP errors.
 * Respects `Retry-After` headers when present.
 * Non-retryable errors (4xx except 429) are thrown immediately.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retryOpts?: RetryOptions,
): Promise<Response> {
  const maxRetries = retryOpts?.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelay = retryOpts?.baseDelay ?? BASE_DELAY_MS

  let lastError: Error | undefined
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init)

      // If retryable and we still have attempts left, wait and retry
      if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After')
        const delay = retryAfter
          ? (parseInt(retryAfter, 10) || 1) * 1000
          : baseDelay * 2 ** attempt
        await sleep(delay)
        continue
      }

      return response
    } catch (err) {
      // Network errors are retryable
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        await sleep(baseDelay * 2 ** attempt)
        continue
      }
    }
  }

  throw lastError ?? new Error('fetchWithRetry: all attempts failed')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
