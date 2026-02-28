/**
 * Per-chapter session undo/redo manager.
 *
 * Stacks are kept in memory for the lifetime of the app session.
 * Switching away from a chapter and back preserves its history.
 *
 * Push strategy:
 *  - Normal typing: debounced (500 ms after the last keystroke).
 *  - Structural edits (Enter, Delete, Tab, Paste, Cut): call flush() just
 *    before the change so the pre-change state gets a dedicated entry.
 *
 * Only `onContentFromEditor` in Editor.vue calls push(); undo/redo
 * operations set content directly and never call push(), so they never
 * pollute the stack.
 */

const MAX_ENTRIES = 200

interface UndoEntry {
  content: string
  cursorPos: number
}

interface ChapterStack {
  entries: UndoEntry[]
  index: number
}

const stacks = new Map<string, ChapterStack>()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// ─── Internal helpers ──────────────────────────────────────────────

function getOrCreate(chapterId: string): ChapterStack {
  if (!stacks.has(chapterId)) stacks.set(chapterId, { entries: [], index: -1 })
  return stacks.get(chapterId)!
}

function commitEntry(chapterId: string, content: string, cursorPos: number) {
  const stack = getOrCreate(chapterId)
  const current = stack.entries[stack.index]
  // Skip exact duplicates (e.g. redundant flush calls)
  if (current && current.content === content) return
  // Truncate redo tail
  stack.entries = stack.entries.slice(0, stack.index + 1)
  stack.entries.push({ content, cursorPos })
  // Cap history to MAX_ENTRIES
  if (stack.entries.length > MAX_ENTRIES) stack.entries.shift()
  stack.index = stack.entries.length - 1
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Set the baseline entry for a chapter when it is first loaded this session.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function init(chapterId: string, content: string, cursorPos = 0) {
  if (stacks.has(chapterId)) return
  stacks.set(chapterId, {
    entries: [{ content, cursorPos }],
    index: 0,
  })
}

/**
 * Push a new state for the chapter, debounced by 500 ms.
 * Each call resets the timer, so only the last state in a burst is saved.
 *
 * `getCursorPos` is called lazily at commit time, not at call time, so it
 * always captures the cursor position after Vue has processed all pending
 * `update:cursorPos` events (which fire after `update:content`).
 */
export function push(chapterId: string, content: string, getCursorPos: () => number) {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  debounceTimer = setTimeout(() => {
    commitEntry(chapterId, content, getCursorPos())
    debounceTimer = null
  }, 500)
}

/**
 * Immediately commit the current state (used before structural edits so
 * the pre-change state gets its own undo entry).
 * Also cancels any pending debounced push.
 */
export function flush(chapterId: string, content: string, cursorPos: number) {
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  commitEntry(chapterId, content, cursorPos)
}

/**
 * Move one step backward.  Returns the state to restore, or null if at base.
 */
export function undo(chapterId: string): UndoEntry | null {
  const stack = stacks.get(chapterId)
  if (!stack || stack.index <= 0) return null
  stack.index--
  return stack.entries[stack.index]
}

/**
 * Move one step forward.  Returns the state to restore, or null if at tip.
 */
export function redo(chapterId: string): UndoEntry | null {
  const stack = stacks.get(chapterId)
  if (!stack || stack.index >= stack.entries.length - 1) return null
  stack.index++
  return stack.entries[stack.index]
}

/** Remove a chapter's history (e.g. on chapter deletion). */
export function clear(chapterId: string) {
  stacks.delete(chapterId)
}

export function canUndo(chapterId: string): boolean {
  const stack = stacks.get(chapterId)
  return !!stack && stack.index > 0
}

export function canRedo(chapterId: string): boolean {
  const stack = stacks.get(chapterId)
  return !!stack && stack.index < stack.entries.length - 1
}
