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

const CONTEXT_CHARS = 1500
const MAX_SUGGESTIONS = 3

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
    if (tokens <= 35)  return 'Continue with a SHORT PHRASE only (4–8 words). DO NOT write a full sentence. DO NOT add line breaks. Stop immediately after the phrase.'
    if (tokens <= 100) return 'Continue with EXACTLY ONE sentence. Do not write more than one sentence. Do not add any line breaks or start a new paragraph. Stop immediately after the period.'
    return 'Continue with EXACTLY ONE SHORT PARAGRAPH (2–3 sentences maximum). Stop immediately after the paragraph ends. Do not start a second paragraph.'
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
    return [
      'You are an inline creative writing assistant embedded in a text editor.',
      lengthInstruction(tokens),
      meta.title ? `Story title: "${meta.title}".` : '',
      meta.genre ? `Genre: ${meta.genre}.` : '',
      meta.tone  ? `Tone: ${meta.tone}.` : '',
      style      ? `Style: ${style.prompt}.` : '',
      'Output ONLY the continuation text. No preamble, no quotes, no commentary:',
      '',
      ctx || '(beginning of story)',
    ].filter(Boolean).join('\n')
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

    for (let i = 0; i < MAX_SUGGESTIONS; i++) {
      if (!isGenerating.value) break // user dismissed mid-generation

      try {
        let text = ''
        await ollamaClient.generateStream(
          {
            model: aiStore.currentModel,
            prompt,
            stream: true,
            // Vary temperature slightly so each suggestion differs
            temperature: 0.7 + i * 0.12,
            num_predict: tokens,
            stop,
          },
          (chunk) => {
            if (!isGenerating.value) return
            // Strip leading newline/space that many models prepend
            const cleaned = text.length === 0 ? chunk.replace(/^[\n\r\s]+/, '') : chunk
            text += cleaned
            suggestions.value[i] = text   // live token-by-token update
          }
        )

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
