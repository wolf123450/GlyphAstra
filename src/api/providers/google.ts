/**
 * Google Gemini provider — Generative Language API with SSE streaming.
 *
 * Docs: https://ai.google.dev/api/generate-content
 * Pricing reference: https://ai.google.dev/pricing
 *   (Pricing data is sourced from the public pricing page and is hardcoded.
 *    The models list endpoint does not include pricing — figures may drift;
 *    always verify at the link above before making cost-sensitive decisions.)
 *
 * API key stored locally in aiStore; never sent to any BlockBreaker server.
 */

import type { ModelProvider, ModelInfo, CompletionOptions } from './types'

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

function splitPrompt(prompt: string): { systemInstruction: string; userContent: string } {
  const MARKER = '=== TEXT ALREADY WRITTEN ==='
  const idx = prompt.indexOf(MARKER)
  if (idx > -1) {
    return {
      systemInstruction: prompt.slice(0, idx).trim(),
      userContent:       prompt.slice(idx).trim(),
    }
  }
  return {
    systemInstruction: 'You are a creative writing assistant. Generate only the next portion of the story. Do not repeat text that has already been written.',
    userContent:       prompt,
  }
}

export class GoogleProvider implements ModelProvider {
  readonly id   = 'google'
  readonly name = 'Google Gemini'

  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey && this.apiKey.trim())
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey.trim()) return GOOGLE_FALLBACK
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
      return models.length ? models : GOOGLE_FALLBACK
    } catch {
      return GOOGLE_FALLBACK
    }
  }

  async streamCompletion(
    prompt: string,
    opts: CompletionOptions,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { systemInstruction, userContent } = splitPrompt(prompt)

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

    const response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Google Gemini error ${response.status}: ${err}`)
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
          const json  = JSON.parse(trimmed.slice(6))
          const parts = json?.candidates?.[0]?.content?.parts as Array<{ text?: string }> | undefined
          if (parts) {
            for (const part of parts) {
              if (typeof part.text === 'string') onChunk(part.text)
            }
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }
}
