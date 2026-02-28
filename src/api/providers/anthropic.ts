/**
 * Anthropic provider — Messages API with SSE streaming.
 *
 * Docs: https://docs.anthropic.com/en/api/messages
 * Pricing reference: https://platform.claude.com/docs/en/docs/about-claude/models/overview
 *   (Pricing data is sourced from the public models overview page and is hardcoded.
 *    Anthropic does not expose pricing via their API — figures may drift;
 *    always verify at the link above before making cost-sensitive decisions.)
 *
 * API key stored locally in aiStore; never sent to any BlockBreaker server.
 *
 * Note: Anthropic requires the `anthropic-dangerous-direct-browser-access: true`
 * header when calling from a browser/WebView context.
 */

import type { ModelProvider, ModelInfo, CompletionOptions } from './types'

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

function splitPrompt(prompt: string): { system: string; user: string } {
  const MARKER = '=== TEXT ALREADY WRITTEN ==='
  const idx = prompt.indexOf(MARKER)
  if (idx > -1) {
    return {
      system: prompt.slice(0, idx).trim(),
      user:   prompt.slice(idx).trim(),
    }
  }
  return {
    system: 'You are a creative writing assistant. Generate only the next portion of the story. Do not repeat text that has already been written.',
    user:   prompt,
  }
}

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':          'application/json',
        'x-api-key':             this.apiKey,
        'anthropic-version':     '2023-06-01',
        // Required for direct browser / WebView usage
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic error ${response.status}: ${err}`)
    }

    const reader  = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          // content_block_delta carries the actual text chunk
          if (json?.type === 'content_block_delta' && json?.delta?.type === 'text_delta') {
            const text = json.delta.text
            if (typeof text === 'string') onChunk(text)
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }
}
