/**
 * Ollama Integration Tests
 *
 * Validates the communication assumptions between GlyphAstra and Ollama that
 * underpin our thinking-mode handling logic in OllamaClient.generateStream().
 *
 * Run separately from unit tests (requires a live Ollama instance):
 *   npm run test:integration
 *
 * Models expected (individual test suites skip if the model is not installed):
 *   qwen3:30b     — native-thinking model; thinking/response are separate fields
 *   qwen3.5:9b    — hybrid model; think:false cleanly disables thinking
 *   gemma3:27b    — standard non-thinking model
 *
 * Key assumptions being tested:
 *   1. qwen3 natively routes thinking into the "thinking" JSON field, not "response"
 *   2. Sending think:false to qwen3 BREAKS this — thinking leaks into "response"
 *   3. qwen3 needs a +2048 token overhead so thinking finishes before the budget runs out
 *   4. qwen3.5 with think:false produces a clean response with no reasoning preamble
 *   5. OllamaClient.generateStream() applies all of the above correctly
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { OllamaClient }    from '@/api/ollama'
import { OllamaProvider }  from '@/api/providers/ollama'

// ─── Constants ──────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:11434'

/** Short creative prompt that reliably triggers thinking in reasoning models. */
const PROMPT = 'Continue this sentence in exactly one sentence, nothing else: The old lighthouse stood'

/** Phrases that indicate reasoning/thinking content rather than a real response. */
const REASONING_PATTERN = /\b(hmm|okay,?\s+let me|let me think|i (?:need to|should|will) think|considering|thinking (?:about|through)|step[- ]by[- ]step|my (?:thought|reasoning|analysis))\b/i

// ─── Shared state set in beforeAll ──────────────────────────────────────────

let ollamaUp        = false
let availableModels: string[] = []

const client   = new OllamaClient(BASE_URL)
const provider = new OllamaProvider(BASE_URL)

// ─── Helpers ────────────────────────────────────────────────────────────────

type RawResponse = {
  response:    string
  thinking?:   string
  done:        boolean
  done_reason: string
}

/** Direct API call, bypassing our OllamaClient wrapper. */
async function rawGenerate(
  model: string,
  numPredict: number,
  extra: Record<string, unknown> = {},
): Promise<RawResponse> {
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model,
      prompt:  PROMPT,
      stream:  false,
      options: { num_predict: numPredict },
      ...extra,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<RawResponse>
}

/** Collect all streamed chunks from OllamaClient into a single string. */
async function collectStream(
  model:      string,
  numPredict: number,
  extra: Partial<{ temperature: number; stop: string[] }> = {},
): Promise<string> {
  let out = ''
  await client.generateStream(
    { model, prompt: PROMPT, stream: true, num_predict: numPredict, ...extra },
    (chunk) => { out += chunk },
  )
  return out
}

/** Collect all streamed chunks from OllamaProvider (higher-level wrapper). */
async function collectProvider(model: string, maxTokens: number): Promise<string> {
  let out = ''
  await provider.streamCompletion(
    PROMPT,
    { model, maxTokens, temperature: 0.7 },
    (chunk) => { out += chunk },
  )
  return out
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (res.ok) {
      const data = await res.json() as { models: Array<{ name: string }> }
      availableModels = data.models.map((m) => m.name)
      ollamaUp = true
      console.log('\nAvailable models:', availableModels.join(', '))
    }
  } catch {
    console.warn('\nWARN: Ollama not reachable at', BASE_URL, '— all tests will be skipped.')
  }
}, 10_000)

/** Skip helper that works inside a test body after beforeAll has run. */
function skipIf(ctx: { skip: () => never }, condition: boolean, reason: string): void {
  if (condition) {
    console.log(`  → SKIP: ${reason}`)
    ctx.skip()
  }
}

// ─── Suite 1: Connectivity ───────────────────────────────────────────────────

describe('Suite 1 — Connectivity', () => {
  it('Ollama is reachable at localhost:11434', async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    expect(await client.checkConnection()).toBe(true)
  })

  it('OllamaProvider.isAvailable() returns true', async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    expect(await provider.isAvailable()).toBe(true)
  })

  it('lists installed models (qwen3:30b and qwen3.5:9b expected)', async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    const models = await client.listModels()
    expect(models.length).toBeGreaterThan(0)
    console.log('  Installed models:', models)

    // Soft-warn about expected models — don't fail, just inform
    for (const expected of ['qwen3:30b', 'qwen3.5:9b', 'gemma3:27b']) {
      if (!models.includes(expected)) {
        console.warn(`  WARN: ${expected} not installed — its suite will be skipped`)
      }
    }
  })
})

// ─── Suite 2: qwen3 family — native thinking ─────────────────────────────────
//
// qwen3 has a built-in "thinking" phase that it outputs to a separate JSON field.
// Our client relies on this separation: the "thinking" field is discarded and
// only the "response" field is passed to onChunk().

describe('Suite 2 — qwen3:30b (native-thinking model)', () => {
  const MODEL = 'qwen3:30b'

  it('raw API: thinking goes to "thinking" field, "response" is empty with small budget', { timeout: 90_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    // With only 80 tokens, all budget is consumed by thinking — response stays empty.
    // This confirms the field separation we rely on.
    const r = await rawGenerate(MODEL, 80)
    console.log(`  thinking length: ${r.thinking?.length ?? 0}`)
    console.log(`  response: [${r.response}]`)
    console.log(`  done_reason: ${r.done_reason}`)

    expect(r.thinking?.length ?? 0).toBeGreaterThan(0)
    // Response is empty or near-empty because all tokens went to thinking
    expect(r.response.length).toBeLessThan(20)
  })

  it('raw API: think:false BREAKS native separation — thinking leaks into "response"', { timeout: 60_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    // IMPORTANT: this test documents WHY we do NOT send think:false to qwen3.
    // When passed to qwen3, think:false reroutes thinking content to "response",
    // which completely breaks our field-based filtering.
    const r = await rawGenerate(MODEL, 80, { think: false })
    console.log(`  [think:false] thinking field: [${r.thinking ?? '(absent)'}]`)
    console.log(`  [think:false] response starts: [${r.response.slice(0, 120)}]`)

    // thinking field should be absent/empty
    expect((r.thinking ?? '').length).toBe(0)
    // response gets the reasoning text instead
    expect(r.response.length).toBeGreaterThan(10)
    expect(REASONING_PATTERN.test(r.response)).toBe(true)
  })

  it('raw API: with 2048-token overhead budget, "response" gets real prose', { timeout: 360_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    // 2048 overhead + 60 response tokens = budget that our client applies.
    const OVERHEAD = 2048
    const r = await rawGenerate(MODEL, OVERHEAD + 60)
    console.log(`  thinking length: ${r.thinking?.length ?? 0}`)
    console.log(`  response: [${r.response}]`)
    console.log(`  done_reason: ${r.done_reason}`)

    expect(r.done_reason).toBe('stop')
    expect(r.response.trim().length).toBeGreaterThan(5)
    // Response should be prose, not reasoning
    expect(REASONING_PATTERN.test(r.response.trim())).toBe(false)
  })

  it('OllamaClient: onChunk receives only prose (thinking discarded, overhead applied)', { timeout: 360_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    // Our wrapper adds THINKING_OVERHEAD automatically for qwen3 family.
    // Passing a small maxTokens here; the client inflates it internally.
    const out = await collectStream(MODEL, 60)
    console.log(`  streamed output (no stop): [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })

  it('OllamaClient: stop sequences do NOT fire during thinking (root-cause regression)', { timeout: 360_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    // This is the exact bug that caused thinking content to appear in completions.
    // Without the fix, stop:['\n\n'] fires while qwen3 is still thinking (thinking
    // output contains \n\n freely), done_reason becomes "stop" with no response
    // chunk, and the thinking buffer falls back to onChunk — surfacing raw reasoning.
    // With the fix, stop sequences are suppressed for native-thinking models.
    const out = await collectStream(MODEL, 60, { stop: ['\n\n', '\n \n', '\r\n\r\n'] })
    console.log(`  streamed output (with stop): [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })

  it('OllamaProvider: streamCompletion delivers clean prose via the provider layer', { timeout: 360_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const out = await collectProvider(MODEL, 60)
    console.log(`  provider output: [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })
})

// ─── Suite 3: qwen3.5 family — think:false capable ───────────────────────────
//
// qwen3.5 supports a think:false API parameter that cleanly disables its
// reasoning phase. Without it, thinking output appears as prose in "response".

describe('Suite 3 — qwen3.5:9b (think:false-capable model)', () => {
  const MODEL = 'qwen3.5:9b'

  it('raw API: with think:false, "thinking" field is absent and response is clean prose', { timeout: 90_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const r = await rawGenerate(MODEL, 150, { think: false })
    console.log(`  [think:false] thinking field: [${r.thinking ?? '(absent)'}]`)
    console.log(`  [think:false] response: [${r.response}]`)

    expect((r.thinking ?? '').length).toBe(0)
    expect(r.response.trim().length).toBeGreaterThan(0)
    // Must not contain a preamble like "Thinking Process:"
    expect(r.response.toLowerCase()).not.toMatch(/thinking process/i)
    expect(REASONING_PATTERN.test(r.response.trim())).toBe(false)
  })

  it('raw API: without think:false, thinking content appears (field or prose preamble)', { timeout: 90_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const r = await rawGenerate(MODEL, 150)
    console.log(`  [no think param] thinking field: [${(r.thinking ?? '').slice(0, 80)}]`)
    console.log(`  [no think param] response starts: [${r.response.slice(0, 120)}]`)

    // Either the thinking field is populated OR reasoning leaks into response
    const thinkingFieldUsed  = (r.thinking ?? '').length > 0
    const reasoningInResponse = REASONING_PATTERN.test(r.response) ||
                                /thinking process/i.test(r.response)
    expect(thinkingFieldUsed || reasoningInResponse).toBe(true)
  })

  it('OllamaClient: onChunk receives clean prose (think:false applied by wrapper)', { timeout: 120_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const out = await collectStream(MODEL, 150)
    console.log(`  streamed output: [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(out.toLowerCase()).not.toMatch(/thinking process/i)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })

  it('OllamaProvider: streamCompletion delivers clean prose', { timeout: 120_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const out = await collectProvider(MODEL, 150)
    console.log(`  provider output: [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })
})

// ─── Suite 4: Standard model — no thinking (gemma3:27b) ──────────────────────

describe('Suite 4 — gemma3:27b (standard non-thinking model)', () => {
  const MODEL = 'gemma3:27b'

  it('raw API: no thinking field, response has direct prose', { timeout: 90_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const r = await rawGenerate(MODEL, 80)
    console.log(`  thinking field: [${r.thinking ?? '(absent)'}]`)
    console.log(`  response: [${r.response}]`)

    expect((r.thinking ?? '').length).toBe(0)
    expect(r.response.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(r.response.trim())).toBe(false)
  })

  it('OllamaClient: onChunk receives prose, no overhead added', { timeout: 120_000 }, async (ctx) => {
    skipIf(ctx, !ollamaUp, 'Ollama not running')
    skipIf(ctx, !availableModels.includes(MODEL), `${MODEL} not installed`)

    const out = await collectStream(MODEL, 80)
    console.log(`  streamed output: [${out}]`)

    expect(out.trim().length).toBeGreaterThan(5)
    expect(REASONING_PATTERN.test(out.trim())).toBe(false)
  })
})

// ─── Suite 5: Model classification logic ────────────────────────────────────
//
// These are pure synchronous checks — no Ollama needed.
// They verify that our regex patterns correctly match the intended model families.

describe('Suite 5 — Model classification regexes (no Ollama required)', () => {
  // These mirror the patterns used in OllamaClient.generateStream()
  const isGptOss      = (m: string) => m.toLowerCase().startsWith('gpt-oss')
  const isQwen35      = (m: string) => /^qwen3\.5/.test(m.toLowerCase())
  const isNativeThink = (m: string) => /^(qwen3(?!\.5)|qwq|deepseek-r1)/.test(m.toLowerCase())

  it('gpt-oss models are correctly identified', () => {
    expect(isGptOss('gpt-oss:7b')).toBe(true)
    expect(isGptOss('gpt-oss')).toBe(true)
    expect(isGptOss('gpt4')).toBe(false)
  })

  it('qwen3.5 models are correctly separated from qwen3', () => {
    expect(isQwen35('qwen3.5:9b')).toBe(true)
    expect(isQwen35('qwen3.5:35b')).toBe(true)
    expect(isQwen35('qwen3:30b')).toBe(false)
    expect(isQwen35('qwen3-coder:30b')).toBe(false)
  })

  it('native-thinking models are correctly identified', () => {
    // qwen3 (but NOT qwen3.5) is a native thinker
    expect(isNativeThink('qwen3:30b')).toBe(true)
    expect(isNativeThink('qwen3-coder:30b')).toBe(true)
    expect(isNativeThink('qwen3.5:9b')).toBe(false)   // must NOT match
    expect(isNativeThink('qwen3.5:35b')).toBe(false)  // must NOT match

    expect(isNativeThink('qwq:32b')).toBe(true)
    expect(isNativeThink('deepseek-r1:70b')).toBe(true)
    expect(isNativeThink('deepseek-r1-distill:8b')).toBe(true)

    expect(isNativeThink('gemma3:27b')).toBe(false)
    expect(isNativeThink('llama3:8b')).toBe(false)
    expect(isNativeThink('gpt-oss:7b')).toBe(false)
  })

  it('each model family maps to exactly one treatment', () => {
    const treatments = (model: string) => ({
      gptOss:      isGptOss(model),
      qwen35:      isQwen35(model),
      nativeThink: isNativeThink(model),
    })

    // Verify no model matches multiple categories
    for (const model of ['qwen3:30b', 'qwen3.5:9b', 'gemma3:27b', 'gpt-oss:7b', 'qwq:32b', 'deepseek-r1:7b']) {
      const t = treatments(model)
      const matched = Object.values(t).filter(Boolean).length
      expect(matched, `${model} matched ${matched} categories: ${JSON.stringify(t)}`).toBeLessThanOrEqual(1)
    }
  })
})
