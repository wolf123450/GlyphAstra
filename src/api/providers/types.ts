/**
 * Shared types for AI model provider abstraction (Phase 16).
 *
 * All providers implement `ModelProvider` so the rest of the app
 * can swap between Ollama, OpenAI, Anthropic, and Google without
 * touching generation or UI logic.
 */

export interface ModelInfo {
  /** Model identifier as expected by the provider API (e.g. "gpt-4o", "llama2"). */
  id: string
  /** Human-readable display name. */
  name: string
  /** ID of the provider that owns this model. */
  providerId: string
  /**
   * Per-token pricing in USD per 1 million tokens.
   * Present for well-known models; absent for Ollama / unknown IDs.
   */
  pricing?: {
    inputPer1M:  number   // USD per 1M input tokens
    outputPer1M: number   // USD per 1M output tokens
  }
}

export interface CompletionOptions {
  /** Model identifier to use for this request. */
  model: string
  /** Sampling temperature (0.0 – 2.0). */
  temperature?: number
  /** Maximum tokens / predicted chars in the response. */
  maxTokens?: number
  /** Sequences that cause the model to stop generating. */
  stop?: string[]
  /** AbortSignal to cancel the request mid-stream. */
  signal?: AbortSignal
  /**
   * Called when the model transitions between thinking and responding.
   * Fired with `true` when the first thinking token arrives,
   * and with `false` when the first actual response token arrives.
   * Only invoked by providers that have a distinct thinking phase (Ollama native-thinking models).
   */
  onThinkingChange?: (isThinking: boolean) => void
}

/**
 * Canonical provider interface.
 *
 * Implementations live in:
 *   src/api/providers/ollama.ts
 *   src/api/providers/openai.ts
 *   src/api/providers/anthropic.ts
 *   src/api/providers/google.ts
 */
export interface ModelProvider {
  /** Stable identifier, e.g. "ollama" | "openai" | "anthropic" | "google". */
  readonly id: string
  /** Display name shown in the UI. */
  readonly name: string

  /**
   * Returns true if the provider can accept requests right now.
   * For Ollama: checks local server. For cloud: checks that a key is set.
   */
  isAvailable(): Promise<boolean>

  /**
   * Returns the list of models available from this provider.
   * Cloud providers return a static curated list; Ollama queries the local API.
   */
  listModels(): Promise<ModelInfo[]>

  /**
   * Stream a continuation. Calls `onChunk` with each incremental text fragment
   * as it arrives, then resolves. Throws on unrecoverable errors.
   */
  streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void>
}
