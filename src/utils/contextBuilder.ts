/**
 * contextBuilder.ts
 *
 * Assembles the full AI prompt for inline writing suggestions.
 * Uses a layered context stack with a token budget to keep prompts
 * within the user-configured context window size.
 *
 * Priority (highest → lowest):
 *   1. System instruction + length instruction  (always)
 *   2. Story metadata (title, genre, tone)      (always)
 *   3. Writing style profile                    (always)
 *   4. Plot outline chapters                    (high)
 *   5. Past chapter summaries, newest-first     (medium)
 *   6. Current chapter text                     (always — mandatory)
 *   7. Future chapter summaries                 (low, optional toggle)
 *   8. Prompt separators / markers              (always)
 */

import { useStoryStore, type Chapter } from '@/stores/storyStore'
import { useAIStore } from '@/stores/aiStore'
import { useSettingsStore } from '@/stores/settingsStore'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Tokens → chars multiplier (rough LLM approximation). */
const CHARS_PER_TOKEN = 4

/** If textBefore exceeds this, compress to summary + tail. */
const VERBATIM_THRESHOLD = 2000

/** Tail kept when compressing current chapter. */
const COMPRESSED_TAIL = 800

/** Fallback verbatim length when no summary exists and text is long. */
const FALLBACK_TAIL = 1500

// ─── Internal helpers ─────────────────────────────────────────────────────────

function lengthInstruction(tokens: number): string {
  if (tokens <= 35)
    return 'Continue with a SHORT PHRASE only (4-8 words). DO NOT write a full sentence. DO NOT add line breaks. Stop immediately after the phrase.'
  if (tokens <= 100)
    return 'Continue with EXACTLY ONE sentence, or continuation of a sentence. If the context ends in an incomplete sentence, continue the sentence naturally. Do not write more than one sentence. Do not add any line breaks or start a new paragraph. Stop immediately after the period.'
  return 'Continue with EXACTLY ONE SHORT PARAGRAPH (2-3 sentences maximum). Stop immediately after the paragraph ends. Do not start a second paragraph.'
}

/**
 * Whether a chapter should be included in context given the current active tag filter.
 * A chapter is included if:
 *   - No active tag filter is set (activeTags is empty), OR
 *   - The chapter has no contextTags (always included), OR
 *   - The chapter has at least one tag that overlaps with activeTags.
 */
function isTagVisible(ch: Chapter, activeTags: string[]): boolean {
  if (activeTags.length === 0) return true
  const chTags = ch.contextTags ?? []
  if (chTags.length === 0) return true
  return chTags.some(t => activeTags.includes(t))
}

/**
 * Format a single chapter contribution as a compact summary block.
 */
function summaryBlock(ch: Chapter, label: string): string {
  const tag = ch.isPlotOutline ? 'PLOT OUTLINE' : label
  const text = ch.summary?.trim() ?? '(no summary yet)'
  return `[${tag}: "${ch.name}"]\n${text}`
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build the full AI prompt for inline suggestions.
 *
 * @param textBefore  - Everything in the current chapter before the cursor.
 * @param currentChapterId - The chapter currently open in the editor (may be '').
 * @returns Complete prompt string ready to pass to OllamaClient.generateStream().
 */
export function buildContext(textBefore: string, currentChapterId: string): string {
  const storyStore    = useStoryStore()
  const aiStore       = useAIStore()
  const settingsStore = useSettingsStore()

  const meta       = storyStore.metadata
  const profile    = aiStore.getStyle(aiStore.currentStyle)
  const tokens     = aiStore.suggestionTokens
  const activeTags = storyStore.activeContextTags
  const settings   = settingsStore.settings

  /** Hard limit in characters for the whole prompt. */
  const maxChars = settings.contextWindowSize * CHARS_PER_TOKEN

  // ── Separate chapters by role ──────────────────────────────────────────────
  const allChapters = storyStore.chapters
  const currentIdx  = allChapters.findIndex(c => c.id === currentChapterId)

  const plotOutlines   = allChapters.filter(c => c.isPlotOutline && isTagVisible(c, activeTags))

  const pastChapters   = allChapters
    .slice(0, currentIdx >= 0 ? currentIdx : allChapters.length)
    .filter(c => !c.isPlotOutline && isTagVisible(c, activeTags))
    .reverse()   // newest first for budget fitting

  const futureChapters = currentIdx >= 0
    ? allChapters
        .slice(currentIdx + 1)
        .filter(c => !c.isPlotOutline && isTagVisible(c, activeTags))
    : []

  // ── Current chapter contribution ──────────────────────────────────────────
  const currentChapter = currentIdx >= 0 ? allChapters[currentIdx] : null

  let currentChapterText: string
  if (textBefore.length <= VERBATIM_THRESHOLD || !currentChapter?.summary) {
    // Either short enough for verbatim, or no summary to fall back to.
    currentChapterText = textBefore.slice(-FALLBACK_TAIL)
  } else {
    // Long chapter with a summary: show compressed version.
    const tail = textBefore.slice(-COMPRESSED_TAIL)
    currentChapterText = `[Chapter summary: ${currentChapter.summary.trim()}]\n\n…${tail}`
  }

  // ── Fixed sections (always present) ───────────────────────────────────────
  const fixedLines: string[] = [
    'You are an inline creative writing assistant embedded in a text editor.',
    lengthInstruction(tokens),
  ]
  if (meta.title) fixedLines.push(`Story title: "${meta.title}".`)
  if (meta.genre) fixedLines.push(`Genre: ${meta.genre}.`)
  if (meta.tone)  fixedLines.push(`Tone: ${meta.tone}.`)
  if (meta.narrativeVoice) fixedLines.push(`Narrative voice: ${meta.narrativeVoice}.`)
  if (meta.summary) fixedLines.push(`Premise: ${meta.summary}`)
  if (profile)    fixedLines.push('', `Writing style instructions: ${profile.prompt}`)

  const fixedBlock  = fixedLines.join('\n')
  const markers     = '\n=== TEXT ALREADY WRITTEN (do NOT repeat any of this) ===\n'
  const endMarker   = '\n=== WRITE ONLY THE CONTINUATION FROM THIS EXACT POINT ==='
  const overhead    = fixedBlock.length + markers.length + endMarker.length + currentChapterText.length

  let budget = maxChars - overhead
  const middleParts: string[] = []

  // ── Layer 1: Plot outline chapters ────────────────────────────────────────
  if (plotOutlines.length > 0 && budget > 0) {
    const header = '\n--- STORY OUTLINE ---'
    let block = header
    for (const ch of plotOutlines) {
      const entry = '\n' + summaryBlock(ch, 'OUTLINE')
      if (budget - block.length - entry.length < 0) break
      block += entry
    }
    if (block !== header) {
      middleParts.push(block)
      budget -= block.length
    }
  }

  // ── Layer 2: Past chapter summaries (newest first) ────────────────────────
  if (pastChapters.length > 0 && budget > 0) {
    const header = '\n--- PREVIOUS CHAPTERS ---'
    let block = header
    for (const ch of pastChapters) {
      if (!ch.summary) continue
      const entry = '\n' + summaryBlock(ch, 'CHAPTER')
      if (budget - block.length - entry.length < 0) break
      block += entry
    }
    if (block !== header) {
      middleParts.push(block)
      budget -= block.length
    }
  }

  // ── Layer 3: Future chapter summaries (if enabled, lowest priority) ───────
  if (settings.includeFutureChapters && futureChapters.length > 0 && budget > 0) {
    const header = '\n--- PLANNED EVENTS (DO NOT REPEAT — these happen after the current scene) ---'
    let block = header
    for (const ch of futureChapters) {
      if (!ch.summary) continue
      const entry = '\n' + summaryBlock(ch, 'FUTURE CHAPTER')
      if (budget - block.length - entry.length < 0) break
      block += entry
    }
    if (block !== header) {
      middleParts.push(block)
    }
  }

  // ── Assemble ──────────────────────────────────────────────────────────────
  const parts: string[] = [
    fixedBlock,
    ...middleParts,
    markers,
    currentChapterText || '(beginning of story — nothing written yet)',
    endMarker,
  ]

  return parts.join('\n')
}
