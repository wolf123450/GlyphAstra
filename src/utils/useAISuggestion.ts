/**
 * Inline AI Suggestion Composable
 *
 * Manages up to 3 streaming suggestions, character-by-character acceptance,
 * and suggestion cycling. All keyboard interception is handled by the editor
 * component; this composable owns only the state and generation logic.
 *
 * Keybindings (enforced in EditorSeamless.vue):
 *   Ctrl+Space  → trigger()
 *   Tab         → acceptFull()
 *   Escape      → clear()
 *   ↑ / ↓       → prev() / next()
 *   <char>      → tryMatchChar(char) — consumes matching chars one-by-one
 */

import { ref, computed } from 'vue'
import { ollamaClient } from '@/api/ollama'
import { useAIStore } from '@/stores/aiStore'
import { useStoryStore } from '@/stores/storyStore'

const CONTEXT_CHARS  = 1500
const MAX_SUGGESTIONS = 3
/** How many chars to buffer before checking for context overlap. */
const OVERLAP_BUFFER  = 200
/** Minimum overlap length worth trimming (avoids false trims on short common words). */
const MIN_OVERLAP     = 6

/**
 * If the model repeated part of the existing text, strip it.
 * Finds the longest suffix of `textBefore` (up to OVERLAP_BUFFER chars) that
 * exactly matches a prefix of `response` (after stripping leading whitespace).
 */
function trimContextOverlap(textBefore: string, response: string): string {
  const stripped = response.replace(/^[\n\r\s]+/, '')
  if (!stripped) return stripped

  const tail = textBefore.slice(-OVERLAP_BUFFER)
  const maxLen = Math.min(tail.length, stripped.length)

  for (let len = maxLen; len >= MIN_OVERLAP; len--) {
    if (stripped.startsWith(tail.slice(-len))) {
      console.log(`[AI suggestion] trimmed ${len}-char overlap from response`)
      return stripped.slice(len)
    }
  }
  return stripped
}

export function useAISuggestion() {
  const aiStore    = useAIStore()
  const storyStore = useStoryStore()

  const suggestions    = ref<string[]>([])
  const currentIndex   = ref(0)
  const consumed       = ref(0)   // chars typed-through from the active suggestion
  const isGenerating   = ref(false)

  const isActive          = computed(() => suggestions.value.length > 0 || isGenerating.value)
  const currentSuggestion = computed(() => suggestions.value[currentIndex.value] ?? '')
  const remainingText     = computed(() => currentSuggestion.value.slice(consumed.value))
  const totalCount        = computed(() => suggestions.value.length)

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Build the instruction line that tells the model exactly how much to write.
   * The phrasing is deliberately direct so models don't interpret it loosely.
   */
  const lengthInstruction = (tokens: number): string => {
    if (tokens <= 35)  return 'Continue with a SHORT PHRASE only (4-8 words). DO NOT write a full sentence. DO NOT add line breaks. Stop immediately after the phrase.'
    if (tokens <= 100) return 'Continue with EXACTLY ONE sentence, or continuation of a sentence. If the context ends in an incomplete sentence, continue the sentence naturally, omitting words already in the context. Do not write more than one sentence. Do not add any line breaks or start a new paragraph. Stop immediately after the period.'
    return 'Continue with EXACTLY ONE SHORT PARAGRAPH (2-3 sentences maximum). Stop immediately after the paragraph ends. Do not start a second paragraph.'
  }


  /**
   * Choose stop sequences that prevent the model from running over
   * into a second paragraph regardless of the instruction above.
   */
  const stopSequences = (tokens: number): string[] => {
    if (tokens <= 35)  return ['\n', '. ', '! ', '? ']
    if (tokens <= 100) return ['\n\n', '\n \n', '\r\n\r\n']
    return ['\n\n\n']
  }

  const buildPrompt = (textBefore: string): string => {
    const meta   = storyStore.metadata
    const style  = aiStore.getStyle(aiStore.currentStyle)
    const tokens = aiStore.suggestionTokens
    const ctx    = textBefore.slice(-CONTEXT_CHARS)

    const lines: string[] = [
      'You are an inline creative writing assistant embedded in a text editor.',
      lengthInstruction(tokens),
    ]
    if (meta.title) lines.push(`Story title: "${meta.title}".`)
    if (meta.genre) lines.push(`Genre: ${meta.genre}.`)
    if (meta.tone)  lines.push(`Tone: ${meta.tone}.`)
    if (style)      lines.push(`Style: ${style.prompt}.`)

    lines.push(
      '',
      '=== TEXT ALREADY WRITTEN (do NOT repeat any of this) ===',
      ctx || '(beginning of story — nothing written yet)',
      '=== WRITE ONLY THE CONTINUATION FROM THIS EXACT POINT ===',
    )

    return lines.join('\n')
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  const clear = () => {
    suggestions.value  = []
    currentIndex.value = 0
    consumed.value     = 0
    isGenerating.value = false
  }

  /**
   * Trigger generation. Generates up to MAX_SUGGESTIONS sequentially so the
   * first suggestion appears quickly, with extras added in the background.
   */
  const trigger = async (textBefore: string) => {
    if (!aiStore.isConnected) return
    clear()
    isGenerating.value = true

    const prompt = buildPrompt(textBefore)
    const tokens = aiStore.suggestionTokens
    const stop   = stopSequences(tokens)

    // Log so the prompt can be inspected during testing
    console.group('[AI suggestion] prompt')
    console.log(prompt)
    console.log('tokens:', tokens, '| stop:', stop)
    console.groupEnd()

    for (let i = 0; i < MAX_SUGGESTIONS; i++) {
      if (!isGenerating.value) break // user dismissed mid-generation

      try {
        let text        = ''
        let buffer      = ''   // holds initial chars until overlap check is done
        let trimApplied = false

        await ollamaClient.generateStream(
          {
            model: aiStore.currentModel,
            prompt,
            stream: true,
            temperature: 0.7 + i * 0.12,
            num_predict: tokens,
            stop,
          },
          (chunk) => {
            if (!isGenerating.value) return

            if (!trimApplied) {
              // Accumulate into buffer; strip leading whitespace on very first chunk
              buffer += buffer.length === 0 ? chunk.replace(/^[\n\r\s]+/, '') : chunk

              if (buffer.length >= OVERLAP_BUFFER) {
                // Enough buffered — apply overlap trim once
                text        = trimContextOverlap(textBefore, buffer)
                trimApplied = true
                suggestions.value[i] = text
              }
              // Don't show anything until the trim has been applied
            } else {
              text += chunk
              suggestions.value[i] = text
            }
          }
        )

        // Stream ended — apply trim if buffer never filled
        if (!trimApplied && buffer) {
          text = trimContextOverlap(textBefore, buffer)
        }

        if (text.trim()) {
          suggestions.value[i] = text.trimEnd()
        } else {
          suggestions.value.splice(i, 1)
          break
        }
      } catch {
        if (i === 0) clear()
        break
      }
    }

    isGenerating.value = false
  }

  /** Cycle to the next suggestion (↓ key) */
  const next = () => {
    if (suggestions.value.length < 2) return
    currentIndex.value = (currentIndex.value + 1) % suggestions.value.length
    consumed.value     = 0
  }

  /** Cycle to the previous suggestion (↑ key) */
  const prev = () => {
    if (suggestions.value.length < 2) return
    currentIndex.value = (currentIndex.value - 1 + suggestions.value.length) % suggestions.value.length
    consumed.value     = 0
  }

  /**
   * Accept the full remaining suggestion text (Tab key).
   * Returns the text to insert; clears state.
   */
  const acceptFull = (): string => {
    const text = remainingText.value
    clear()
    return text
  }

  /**
   * Called when the user types a character while a suggestion is active.
   * - If the character matches the next suggestion char: advances `consumed` and returns true
   *   (the char is allowed through normally; the suggestion persists, trimmed).
   * - If it does NOT match: clears the suggestion and returns false
   *   (the char is still typed normally).
   */
  const tryMatchChar = (char: string): boolean => {
    if (!currentSuggestion.value) { clear(); return false }
    const nextChar = currentSuggestion.value[consumed.value]
    if (nextChar === char) {
      consumed.value++
      if (consumed.value >= currentSuggestion.value.length) {
        // Fully consumed via typing — clear silently
        clear()
      }
      return true
    }
    // Mismatch — dismiss
    clear()
    return false
  }

  return {
    suggestions,
    currentIndex,
    consumed,
    isActive,
    isGenerating,
    currentSuggestion,
    remainingText,
    totalCount,
    trigger,
    next,
    prev,
    acceptFull,
    tryMatchChar,
    clear,
  }
}
