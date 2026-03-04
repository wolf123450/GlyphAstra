/**
 * Anthropic provider — Messages API with SSE streaming.
 *
 * Docs: https://docs.anthropic.com/en/api/messages
 * Pricing reference: https://platform.claude.com/docs/en/docs/about-claude/models/overview
 *   (Pricing data is sourced from the public models overview page and is hardcoded.
 *    Anthropic does not expose pricing via their API — figures may drift;
 *    always verify at the link above before making cost-sensitive decisions.)
 *
 * API key stored locally in aiStore; never sent to any Glyph Astra server.
 *
 * Note: Anthropic requires the `anthropic-dangerous-direct-browser-access: true`
 * header when calling from a browser/WebView context.
 */

import type { ModelProvider, ModelInfo, CompletionOptions } from './types'
import { fetchWithRetry } from '@/utils/fetchRetry'
import { splitPrompt, parseSSEStream } from './shared'

/**
 * Pricing as of 2026-02 (USD per 1M tokens, standard tier).
 * Source: https://platform.claude.com/docs/en/docs/about-claude/models/overview
 * NOTE: Not available via API — may become outdated. Verify before use.
 */
const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6',   providerId: 'anthropic', pricing: { inputPer1M:  5.00, outputPer1M: 25.00 } },
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', providerId: 'anthropic', pricing: { inputPer1M:  3.00, outputPer1M: 15.00 } },
  { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  providerId: 'anthropic', pricing: { inputPer1M:  1.00, outputPer1M:  5.00 } },
]



export class AnthropicProvider implements ModelProvider {
  readonly id   = 'anthropic'
  readonly name = 'Anthropic'

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey && this.apiKey.trim())
  }

  async listModels(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS
  }

  async streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { system, user } = splitPrompt(prompt)

    const body: Record<string, unknown> = {
      model:      opts.model,
      stream:     true,
      max_tokens: opts.maxTokens ?? 1024,
      system,
      messages: [
        { role: 'user', content: user },
      ],
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.stop        !== undefined && opts.stop.length > 0 && { stop_sequences: opts.stop }),
    }

    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':          'application/json',
        'x-api-key':             this.apiKey,
        'anthropic-version':     '2023-06-01',
        // Required for direct browser / WebView usage
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${err}`)
    }

    await parseSSEStream(
      response,
      (json) => {
        if (json?.type === 'content_block_delta') {
          const delta = json.delta as { type?: string; text?: string } | undefined
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            return delta.text
          }
        }
        return null
      },
      onChunk,
    )
  }
}
