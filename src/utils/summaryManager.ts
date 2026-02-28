/**
 * summaryManager.ts
 *
 * Background auto-summariser for chapters.
 *
 * Watches all chapter contents and, when a chapter's text has changed by
 * more than DELTA_THRESHOLD chars since the last summary was generated,
 * and the cooldown has elapsed, sends a non-streaming Ollama request to
 * regenerate the chapter summary.
 *
 * The user can:
 *   - Pause auto-summary for a chapter (`summaryPaused = true`)
 *   - Manually edit a summary (`summaryManuallyEdited = true`).
 *     Manual edits are preserved until the user clicks "Regenerate".
 *   - Manually trigger regeneration via `triggerSummary(chapterId)`.
 *
 * Usage: call `useSummaryManager()` once from App.vue or a top-level
 * component to start the watcher.  Multiple calls are safe (guarded by
 * a module-level `started` flag).
 */

import { watch } from 'vue'
import { makeProvider } from '@/api/providers'
import type { ProviderId } from '@/api/providers'
import { useAIStore } from '@/stores/aiStore'
import { useStoryStore } from '@/stores/storyStore'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum character delta before auto-triggering a new summary. */
const DELTA_THRESHOLD = 250

/** Minimum ms between auto-generated summaries for the same chapter. */
const COOLDOWN_MS = 5 * 60 * 1000   // 5 minutes

/** Max tokens for the summary response. */
const SUMMARY_MAX_TOKENS = 120

/** Max chars of chapter content sent to the model. Large chapters are truncated. */
const MAX_CONTENT_CHARS = 6000

// ─── Module-level state ───────────────────────────────────────────────────────

/** Already-started guard (singleton). */
let started = false

/** Maps chapterId → cheap content hash at the time the last summary was generated. */
const watchedHashes = new Map<string, string>()

/** Maps chapterId → timestamp (ms) of the last auto-summary call. */
const cooldowns = new Map<string, number>()

/** Chapters currently being summarised (prevents concurrent calls per chapter). */
const inFlight = new Set<string>()

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Cheap, non-cryptographic content hash.
 * Encodes length + first 50 chars + last 50 chars.
 * Good enough to detect meaningful edits without hashing the whole string.
 */
function contentHash(text: string): string {
  return `${text.length}:${text.slice(0, 50)}:${text.slice(-50)}`
}

/**
 * Collect all stream chunks into a single string.
 * Works for every provider since they all implement streamCompletion.
 */
async function generateFull(
  aiStore: ReturnType<typeof useAIStore>,
  prompt: string,
): Promise<string> {
  const pid   = aiStore.activeProviderId as ProviderId
  // Use the dedicated summary model if set; fall back to completions model.
  const model = aiStore.summaryProviderModel[pid] ?? aiStore.currentModel
  if (!model) throw new Error('No model configured for summary generation')

  const provider = makeProvider(pid, aiStore.providerApiKeys)
  let result = ''
  await provider.streamCompletion(
    prompt,
    { model, temperature: 0.3, maxTokens: SUMMARY_MAX_TOKENS },
    (chunk) => { result += chunk },
  )
  return result.trim()
}

/**
 * Prompt sent to the model for summarisation.
 * Kept concise so small models can handle it reliably.
 */
function buildSummaryPrompt(chapterName: string, content: string): string {
  const trimmed = content.slice(0, MAX_CONTENT_CHARS)
  return [
    'You are a story assistant. Summarise the following chapter in 2-3 sentences.',
    'Focus on: key events, character actions, and any important reveals.',
    'Be concise. Do not add commentary. Output only the summary.',
    '',
    `Chapter title: "${chapterName}"`,
    '',
    '=== CHAPTER TEXT ===',
    trimmed,
    '=== END ===',
    '',
    'Summary:',
  ].join('\n')
}

// ─── Core summarisation logic ─────────────────────────────────────────────────

/**
 * Run auto-summary for a single chapter.
 * Skips if: no model, paused, manual edit, cooldown active, in-flight, or hash unchanged.
 */
async function autoSummariseChapter(chapterId: string): Promise<void> {
  const storyStore = useStoryStore()
  const aiStore    = useAIStore()

  const ch = storyStore.getChapterById(chapterId)
  if (!ch)                       return
  if (ch.summaryPaused)          return
  if (ch.summaryManuallyEdited)  return
  if (!aiStore.canGenerate)      return   // works for both Ollama and cloud
  if (inFlight.has(chapterId))   return

  const content = ch.content ?? ''
  if (content.trim().length < 20) return   // not enough text to summarise

  const hash = contentHash(content)
  const prevHash = watchedHashes.get(chapterId)

  // Only proceed if content changed meaningfully since last summary.
  if (prevHash) {
    const prevLen = parseInt(prevHash.split(':')[0] ?? '0', 10)
    const curLen  = content.length
    if (Math.abs(curLen - prevLen) < DELTA_THRESHOLD) return
  }

  // Enforce cooldown.
  const lastRun = cooldowns.get(chapterId) ?? 0
  if (Date.now() - lastRun < COOLDOWN_MS) return

  // All checks passed — run summary.
  inFlight.add(chapterId)
  console.log(`[summaryManager] Generating summary for chapter "${ch.name}"…`)

  try {
    const prompt        = buildSummaryPrompt(ch.name, content)
    const trimmedSummary = await generateFull(aiStore, prompt)
    if (!trimmedSummary) return

    storyStore.updateChapter(chapterId, {
      summary:               trimmedSummary,
      summaryGeneratedAt:    Date.now(),
      summaryContentHash:    hash,
      summaryManuallyEdited: false,
    })

    watchedHashes.set(chapterId, hash)
    cooldowns.set(chapterId, Date.now())
    console.log(`[summaryManager] Summary updated for chapter "${ch.name}".`)
  } catch (err) {
    console.warn(`[summaryManager] Failed to summarise chapter "${ch.name}":`, err)
  } finally {
    inFlight.delete(chapterId)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Manually trigger a summary regeneration for a chapter,
 * bypassing cooldown and manual-edit guard.
 * Useful for the "Regenerate" button in the Chapter Metadata Editor.
 */
export async function triggerSummary(chapterId: string): Promise<void> {
  const storyStore = useStoryStore()
  const aiStore    = useAIStore()

  const ch = storyStore.getChapterById(chapterId)
  if (!ch)                      return
  if (!aiStore.canGenerate)     return   // works for both Ollama and cloud
  if (inFlight.has(chapterId))  return

  const content = ch.content ?? ''
  if (content.trim().length < 20) return

  const hash = contentHash(content)
  inFlight.add(chapterId)
  console.log(`[summaryManager] Manual regeneration for chapter "${ch.name}"…`)

  try {
    const prompt         = buildSummaryPrompt(ch.name, content)
    const trimmedSummary = await generateFull(aiStore, prompt)
    if (!trimmedSummary) return

    storyStore.updateChapter(chapterId, {
      summary:               trimmedSummary,
      summaryGeneratedAt:    Date.now(),
      summaryContentHash:    hash,
      summaryManuallyEdited: false,
    })

    watchedHashes.set(chapterId, hash)
    cooldowns.set(chapterId, Date.now())
    console.log(`[summaryManager] Manual summary complete for "${ch.name}".`)
  } catch (err) {
    console.warn(`[summaryManager] Manual summary failed for "${ch.name}":`, err)
  } finally {
    inFlight.delete(chapterId)
  }
}

/**
 * Start the background summary watcher.
 * Call once from App.vue.  Subsequent calls are no-ops.
 */
export function useSummaryManager(): void {
  if (started) return
  started = true

  const storyStore = useStoryStore()

  // Deep-watch every chapter's content field.
  // When a chapter changes, schedule an auto-summary check.
  watch(
    () => storyStore.chapters.map(c => ({ id: c.id, content: c.content })),
    (newChapters, oldChapters) => {
      if (!oldChapters) return

      const oldMap = new Map(oldChapters.map(c => [c.id, c.content]))
      for (const { id, content } of newChapters) {
        const oldContent = oldMap.get(id)
        // Only react to actual content changes (not newly added chapters).
        if (oldContent !== undefined && oldContent !== content) {
          // Debounce: run after a short idle period so we don't fire on every keystroke.
          setTimeout(() => autoSummariseChapter(id), 3000)
        }
      }
    },
    { deep: false }   // shallow enough — we only compare content strings
  )

  console.log('[summaryManager] Background chapter summariser active.')
}
