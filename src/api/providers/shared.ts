/**
 * Shared utilities for cloud AI providers.
 *
 * - splitPrompt():   splits a contextBuilder prompt into system + user portions
 * - parseSSEStream(): consumes a ReadableStream of SSE events
 */

/** Default system prompt used when the prompt lacks the context marker. */
const DEFAULT_SYSTEM_PROMPT =
  'You are a creative writing assistant. Generate only the next portion of the story. Do not repeat text that has already been written.'

/** Marker emitted by contextBuilder to separate system instructions from story text. */
const MARKER = '=== TEXT ALREADY WRITTEN ==='

/**
 * Split a contextBuilder prompt into system + user portions for chat APIs.
 * Everything before the MARKER becomes the system message; everything from
 * the MARKER onward becomes the user message.
 */
export function splitPrompt(prompt: string): { system: string; user: string } {
  const idx = prompt.indexOf(MARKER)
  if (idx > -1) {
    return {
      system: prompt.slice(0, idx).trim(),
      user:   prompt.slice(idx).trim(),
    }
  }
  return { system: DEFAULT_SYSTEM_PROMPT, user: prompt }
}

/**
 * Generic SSE stream parser.
 *
 * Reads from a {@link Response} body, parses `data:` lines as JSON, and calls
 * {@link extractChunk} to pull the text content from each provider-specific
 * JSON shape.  If `extractChunk` returns a non-empty string, it is forwarded
 * to {@link onChunk}.
 *
 * @param response      The fetch Response whose body is an SSE stream.
 * @param extractChunk  Provider callback: receives parsed JSON, returns the
 *                      text chunk or `null`/`undefined` if the event should
 *                      be skipped.
 * @param onChunk       Called with each extracted text fragment.
 */
export async function parseSSEStream(
  response: Response,
  extractChunk: (json: Record<string, unknown>) => string | null | undefined,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const reader  = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>
          const text = extractChunk(json)
          if (typeof text === 'string' && text) onChunk(text)
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
