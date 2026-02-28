import { describe, it, expect } from 'vitest'
import { splitPrompt, parseSSEStream } from '@/api/providers/shared'

const MARKER = '=== TEXT ALREADY WRITTEN ==='

describe('splitPrompt', () => {
  it('splits on the marker when present', () => {
    const prompt = `System instructions here\n\n${MARKER}\n\nStory content after marker`
    const { system, user } = splitPrompt(prompt)
    expect(system).toBe('System instructions here')
    expect(user).toBe(`${MARKER}\n\nStory content after marker`)
  })

  it('returns default system prompt when marker is absent', () => {
    const { system, user } = splitPrompt('Just a plain prompt')
    expect(system).toContain('creative writing assistant')
    expect(user).toBe('Just a plain prompt')
  })

  it('handles marker at the very start', () => {
    const prompt = `${MARKER}\nContent`
    const { system, user } = splitPrompt(prompt)
    expect(system).toBe('')
    expect(user).toContain(MARKER)
    expect(user).toContain('Content')
  })

  it('handles empty string', () => {
    const { system, user } = splitPrompt('')
    expect(system).toContain('creative writing assistant')
    expect(user).toBe('')
  })

  it('trims whitespace around system and user portions', () => {
    const prompt = `  Sys  \n\n${MARKER}\n\n  User text  `
    const { system, user } = splitPrompt(prompt)
    expect(system).toBe('Sys')
    expect(user).toBe(`${MARKER}\n\n  User text`)
  })
})

describe('parseSSEStream', () => {
  /** Helper: build a Response with a ReadableStream from string chunks. */
  function makeSSEResponse(...chunks: string[]): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    })
    return new Response(stream)
  }

  it('parses well-formed SSE events', async () => {
    const response = makeSSEResponse(
      'data: {"text":"Hello"}\n\n',
      'data: {"text":" World"}\n\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.text as string) ?? null,
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual(['Hello', ' World'])
  })

  it('skips [DONE] sentinel lines', async () => {
    const response = makeSSEResponse(
      'data: {"text":"A"}\n',
      'data: [DONE]\n',
      'data: {"text":"B"}\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.text as string) ?? null,
      (c) => chunks.push(c),
    )
    // [DONE] is skipped but processing continues for remaining data
    expect(chunks).toEqual(['A', 'B'])
  })

  it('skips empty lines and non-data lines', async () => {
    const response = makeSSEResponse(
      '\n',
      ': comment line\n',
      'event: ping\n',
      'data: {"text":"ok"}\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.text as string) ?? null,
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual(['ok'])
  })

  it('ignores malformed JSON lines', async () => {
    const response = makeSSEResponse(
      'data: not-json\n',
      'data: {"text":"valid"}\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.text as string) ?? null,
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual(['valid'])
  })

  it('skips events where extractChunk returns null', async () => {
    const response = makeSSEResponse(
      'data: {"type":"start"}\n',
      'data: {"type":"content","text":"data"}\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.type === 'content' ? (json.text as string) : null),
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual(['data'])
  })

  it('handles data split across read boundaries', async () => {
    // "data: {\"t\":\"hi\"}\n" split mid-JSON
    const response = makeSSEResponse(
      'data: {"t"',
      ':"hi"}\n',
    )
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.t as string) ?? null,
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual(['hi'])
  })

  it('does nothing if response has no body', async () => {
    const response = new Response(null)
    const chunks: string[] = []
    await parseSSEStream(
      response,
      (json) => (json.text as string) ?? null,
      (c) => chunks.push(c),
    )
    expect(chunks).toEqual([])
  })
})
