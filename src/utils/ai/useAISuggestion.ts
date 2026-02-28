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
import { makeProvider } from '@/api/providers'
import type { ProviderId } from '@/api/providers'
import { useAIStore } from '@/stores/aiStore'
import { useStoryStore } from '@/stores/storyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { buildContext, type ContextInput } from './contextBuilder'
import { logger } from '@/utils/logger'

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
      logger.debug('AI', `Trimmed ${len}-char overlap from response`)
      return stripped.slice(len)
    }
  }
  return stripped
}

export function useAISuggestion() {
  const aiStore       = useAIStore()
  const storyStore     = useStoryStore()
  const settingsStore  = useSettingsStore()

  const suggestions    = ref<string[]>([])
  const currentIndex   = ref(0)
  const consumed       = ref(0)   // chars typed-through from the active suggestion
  const isGenerating   = ref(false)
  const lastPrompt     = ref('')   // exposed for PromptPreview

  const isActive          = computed(() => suggestions.value.length > 0 || isGenerating.value)
  const currentSuggestion = computed(() => suggestions.value[currentIndex.value] ?? '')
  const remainingText     = computed(() => currentSuggestion.value.slice(consumed.value))
  const totalCount        = computed(() => suggestions.value.length)

  // ─── Internal helpers ──────────────────────────────────────────────────────

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
    const meta = storyStore.metadata
    const settings = settingsStore.settings
    const input: ContextInput = {
      title: meta.title,
      genre: meta.genre,
      tone: meta.tone,
      narrativeVoice: meta.narrativeVoice,
      summary: meta.summary,
      chapters: storyStore.chapters,
      activeContextTags: storyStore.activeContextTags,
      profile: aiStore.getStyle(aiStore.currentStyle),
      suggestionTokens: aiStore.suggestionTokens,
      contextWindowSize: settings.contextWindowSize,
      includeFutureChapters: settings.includeFutureChapters,
    }
    return buildContext(textBefore, storyStore.currentChapterId ?? '', input)
  }

  /** Returns the last prompt sent to the model (for the prompt preview UI). */
  const getLastPrompt = () => lastPrompt.value

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
    if (!aiStore.canGenerate) return
    clear()
    isGenerating.value = true

    const prompt = buildPrompt(textBefore)
    lastPrompt.value = prompt
    const tokens = aiStore.suggestionTokens
    const stop   = stopSequences(tokens)

    // Log so the prompt can be inspected during testing
    logger.debug('AI', 'Prompt:', prompt)
    logger.debug('AI', 'tokens:', tokens, '| stop:', stop)

    // Instantiate once per trigger — avoids recreating on each suggestion loop
    const provider = makeProvider(
      aiStore.activeProviderId as ProviderId,
      aiStore.providerApiKeys
    )

    for (let i = 0; i < MAX_SUGGESTIONS; i++) {
      if (!isGenerating.value) break // user dismissed mid-generation

      try {
        let text        = ''
        let buffer      = ''   // holds initial chars until overlap check is done
        let trimApplied = false

        await provider.streamCompletion(
          prompt,
          {
            model:       aiStore.currentModel,
            temperature: 0.7 + i * 0.12,
            maxTokens:   tokens,
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
    buildPrompt,
    getLastPrompt,
  }
}
