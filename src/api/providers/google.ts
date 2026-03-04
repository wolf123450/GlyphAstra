/**
 * Google Gemini provider — Generative Language API with SSE streaming.
 *
 * Docs: https://ai.google.dev/api/generate-content
 * Pricing reference: https://ai.google.dev/pricing
 *   (Pricing data is sourced from the public pricing page and is hardcoded.
 *    The models list endpoint does not include pricing — figures may drift;
 *    always verify at the link above before making cost-sensitive decisions.)
 *
 * API key stored locally in aiStore; never sent to any Glyph Astra server.
 */

import type { ModelProvider, ModelInfo, CompletionOptions } from './types'
import { fetchWithRetry } from '@/utils/fetchRetry'
import { splitPrompt, parseSSEStream } from './shared'

/**
 * Pricing as of 2026-02 (USD per 1M tokens, standard tier, >128K context).
 * Source: https://ai.google.dev/pricing
 * NOTE: Not available via models list API — may become outdated. Verify before use.
 */
const GOOGLE_PRICING: Record<string, { name: string; inputPer1M: number; outputPer1M: number }> = {
  'gemini-2.5-pro':           { name: 'Gemini 2.5 Pro',          inputPer1M: 1.25,  outputPer1M: 10.00 },
  'gemini-2.5-flash':         { name: 'Gemini 2.5 Flash',        inputPer1M: 0.15,  outputPer1M:  0.60 },
  'gemini-2.0-flash':         { name: 'Gemini 2.0 Flash',        inputPer1M: 0.10,  outputPer1M:  0.40 },
  'gemini-2.0-flash-lite':    { name: 'Gemini 2.0 Flash Lite',   inputPer1M: 0.075, outputPer1M:  0.30 },
  'gemini-1.5-pro':           { name: 'Gemini 1.5 Pro',          inputPer1M: 1.25,  outputPer1M:  5.00 },
  'gemini-1.5-flash':         { name: 'Gemini 1.5 Flash',        inputPer1M: 0.075, outputPer1M:  0.30 },
  'gemini-1.5-flash-8b':      { name: 'Gemini 1.5 Flash 8B',     inputPer1M: 0.0375,outputPer1M:  0.15 },
}

/** Fallback list used when the API key is absent or request fails. */
const GOOGLE_FALLBACK: ModelInfo[] = [
  { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',   providerId: 'google', pricing: { inputPer1M: 1.25, outputPer1M: 10.00 } },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash',  providerId: 'google', pricing: { inputPer1M: 0.15, outputPer1M:  0.60 } },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash',  providerId: 'google', pricing: { inputPer1M: 0.10, outputPer1M:  0.40 } },
]

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'



export class GoogleProvider implements ModelProvider {
  readonly id   = 'google'
  readonly name = 'Google Gemini'

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
    if (!this.apiKey.trim()) return GOOGLE_FALLBACK
    if (this._modelCache && Date.now() - this._modelCacheTime < GoogleProvider.MODEL_CACHE_TTL) {
      return this._modelCache
    }
    try {
      const resp = await fetch(
        `${GEMINI_BASE}?key=${encodeURIComponent(this.apiKey)}&pageSize=50`,
      )
      if (!resp.ok) return GOOGLE_FALLBACK

      const data = await resp.json() as {
        models: Array<{
          name: string                         // e.g. "models/gemini-2.0-flash"
          displayName: string
          supportedGenerationMethods: string[]
        }>
      }
      const models: ModelInfo[] = data.models
        .filter(m =>
          m.supportedGenerationMethods.includes('generateContent') &&
          !m.name.includes('vision') &&
          !m.name.includes('embedding') &&
          m.name.includes('gemini'),
        )
        .map(m => {
          // API returns "models/gemini-2.0-flash" — strip the prefix
          const id    = m.name.replace(/^models\//, '')
          const known = GOOGLE_PRICING[id]
          return {
            id,
            name:       known?.name ?? m.displayName ?? id,
            providerId: 'google' as const,
            ...(known && { pricing: { inputPer1M: known.inputPer1M, outputPer1M: known.outputPer1M } }),
          }
        })
        .sort((a, b) => a.id.localeCompare(b.id))
      const result = models.length ? models : GOOGLE_FALLBACK
      this._modelCache = result
      this._modelCacheTime = Date.now()
      return result
    } catch {
      return GOOGLE_FALLBACK
    }
  }

  async streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { system: systemInstruction, user: userContent } = splitPrompt(prompt)

    const genConfig: Record<string, unknown> = {}
    if (opts.temperature !== undefined) genConfig.temperature    = opts.temperature
    if (opts.maxTokens   !== undefined) genConfig.maxOutputTokens = opts.maxTokens
    if (opts.stop        !== undefined && opts.stop.length > 0)  genConfig.stopSequences = opts.stop

    const body: Record<string, unknown> = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [
        { role: 'user', parts: [{ text: userContent }] },
      ],
      generationConfig: genConfig,
    }

    const url = `${GEMINI_BASE}/${opts.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`

    const response = await fetchWithRetry(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  opts.signal ?? AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Google Gemini error ${response.status}: ${err}`)
    }

    await parseSSEStream(
      response,
      (json) => {
        const candidates = json.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
        const parts = candidates?.[0]?.content?.parts
        if (parts) {
          // Gemini may return multiple parts; concatenate them
          return parts
            .filter((p): p is { text: string } => typeof p.text === 'string')
            .map(p => p.text)
            .join('') || null
        }
        return null
      },
      onChunk,
    )
  }
}
