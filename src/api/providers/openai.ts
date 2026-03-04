/**
 * OpenAI provider — Chat Completions API with SSE streaming.
 *
 * Docs: https://platform.openai.com/docs/api-reference/chat
 * Pricing reference: https://developers.openai.com/api/docs/pricing
 *   (Pricing data is sourced from the public pricing page and is hardcoded.
 *    OpenAI does not expose pricing via their API — figures may drift;
 *    always verify at the link above before making cost-sensitive decisions.)
 *
 * API key stored locally in aiStore; never sent to any Glyph Astra server.
 */

import type { ModelProvider, ModelInfo, CompletionOptions } from './types'
import { fetchWithRetry } from '@/utils/fetchRetry'
import { splitPrompt, parseSSEStream } from './shared'

/**
 * Pricing as of 2026-02 (USD per 1M tokens, standard tier).
 * Source: https://developers.openai.com/api/docs/pricing
 * NOTE: Not available via API — may become outdated. Verify before use.
 */
const OPENAI_PRICING: Record<string, { name: string; inputPer1M: number; outputPer1M: number }> = {
  // GPT-5 family
  'gpt-5':               { name: 'GPT-5',               inputPer1M:  1.25, outputPer1M: 10.00 },
  'gpt-5-mini':          { name: 'GPT-5 Mini',          inputPer1M:  0.25, outputPer1M:  2.00 },
  // GPT-4.1 family
  'gpt-4.1':             { name: 'GPT-4.1',             inputPer1M:  2.00, outputPer1M:  8.00 },
  'gpt-4.1-mini':        { name: 'GPT-4.1 Mini',        inputPer1M:  0.40, outputPer1M:  1.60 },
  'gpt-4.1-nano':        { name: 'GPT-4.1 Nano',        inputPer1M:  0.10, outputPer1M:  0.40 },
  // GPT-4o family
  'gpt-4o':              { name: 'GPT-4o',              inputPer1M:  2.50, outputPer1M: 10.00 },
  'gpt-4o-mini':         { name: 'GPT-4o Mini',         inputPer1M:  0.15, outputPer1M:  0.60 },
  // GPT-4 Turbo / legacy GPT-4
  'gpt-4-turbo':         { name: 'GPT-4 Turbo',         inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-4-turbo-preview': { name: 'GPT-4 Turbo Preview', inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-4-0613':          { name: 'GPT-4',               inputPer1M: 30.00, outputPer1M: 60.00 },
  // Legacy GPT-3.5
  'gpt-3.5-turbo':       { name: 'GPT-3.5 Turbo',       inputPer1M:  0.50, outputPer1M:  1.50 },
  // o-series reasoning models
  'o4-mini':             { name: 'o4 Mini',             inputPer1M:  1.10, outputPer1M:  4.40 },
  'o3':                  { name: 'o3',                  inputPer1M:  2.00, outputPer1M:  8.00 },
  'o3-mini':             { name: 'o3 Mini',             inputPer1M:  1.10, outputPer1M:  4.40 },
  'o1':                  { name: 'o1',                  inputPer1M: 15.00, outputPer1M: 60.00 },
  'o1-mini':             { name: 'o1 Mini',             inputPer1M:  1.10, outputPer1M:  4.40 },
}

/** Fallback static list used when the API cannot be reached or key is absent. */
const OPENAI_FALLBACK: ModelInfo[] = [
  { id: 'gpt-4.1',       name: 'GPT-4.1',       providerId: 'openai', pricing: { inputPer1M:  2.00, outputPer1M:  8.00 } },
  { id: 'gpt-4.1-mini',  name: 'GPT-4.1 Mini',  providerId: 'openai', pricing: { inputPer1M:  0.40, outputPer1M:  1.60 } },
  { id: 'gpt-4o',        name: 'GPT-4o',        providerId: 'openai', pricing: { inputPer1M:  2.50, outputPer1M: 10.00 } },
  { id: 'gpt-4o-mini',   name: 'GPT-4o Mini',   providerId: 'openai', pricing: { inputPer1M:  0.15, outputPer1M:  0.60 } },
  { id: 'o4-mini',       name: 'o4 Mini',       providerId: 'openai', pricing: { inputPer1M:  1.10, outputPer1M:  4.40 } },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', providerId: 'openai', pricing: { inputPer1M:  0.50, outputPer1M:  1.50 } },
]

/** Matches chat-capable GPT / o-series models; excludes audio/realtime/image/embedding/moderation variants. */
const EXCLUDE_PATTERN = /instruct|audio|realtime|vision|tts|whisper|dall-e|embedding|moderation|transcribe|search|codex|computer|image|preview-\d{4}|pro$/i
const INCLUDE_PATTERN = /^(gpt-5|gpt-4|o[1-9])/



export class OpenAIProvider implements ModelProvider {
  readonly id   = 'openai'
  readonly name = 'OpenAI'

  private apiKey: string
  private _modelCache: ModelInfo[] | null = null
  private _modelCacheTime = 0
  private static MODEL_CACHE_TTL = 5 * 60 * 1000  // 5 minutes

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey && this.apiKey.trim())
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey.trim()) return OPENAI_FALLBACK
    if (this._modelCache && Date.now() - this._modelCacheTime < OpenAIProvider.MODEL_CACHE_TTL) {
      return this._modelCache
    }
    try {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })
      if (!resp.ok) return OPENAI_FALLBACK

      const data = await resp.json() as { data: Array<{ id: string }> }
      const models: ModelInfo[] = data.data
        .filter(m => INCLUDE_PATTERN.test(m.id) && !EXCLUDE_PATTERN.test(m.id))
        .sort((a, b) => b.id.localeCompare(a.id))
        .map(m => {
          const known = OPENAI_PRICING[m.id]
          return {
            id:         m.id,
            name:       known?.name ?? m.id,
            providerId: 'openai' as const,
            ...(known && { pricing: { inputPer1M: known.inputPer1M, outputPer1M: known.outputPer1M } }),
          }
        })
      const result = models.length ? models : OPENAI_FALLBACK
      this._modelCache = result
      this._modelCacheTime = Date.now()
      return result
    } catch {
      return OPENAI_FALLBACK
    }
  }

  async streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { system, user } = splitPrompt(prompt)

    const body: Record<string, unknown> = {
      model:       opts.model,
      stream:      true,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.maxTokens   !== undefined && { max_tokens:  opts.maxTokens }),
      ...(opts.stop        !== undefined && opts.stop.length > 0 && { stop: opts.stop }),
    }

    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal ?? AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI error ${response.status}: ${err}`)
    }

    await parseSSEStream(
      response,
      (json) => {
        const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined
        const delta = choices?.[0]?.delta?.content
        return typeof delta === 'string' ? delta : null
      },
      onChunk,
    )
  }
}
