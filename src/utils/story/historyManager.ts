/**
 * Chapter Version History Manager
 *
 * Captures content snapshots on every successful save when a meaningful change
 * has occurred since the last snapshot.  Snapshots are persisted per-chapter:
 *
 *   stories/{storyId}/history/{chapterId}.json
 *
 * The file is a JSON array of HistoryEntry objects, oldest first.
 * An in-memory cache prevents redundant disk reads within a session.
 *
 * Tuning constants:
 *   MAX_SNAPSHOTS    – maximum snapshots kept per chapter (oldest pruned first)
 *   MIN_CHARS_DELTA  – minimum absolute character-count change to trigger capture
 *   MIN_SECS_BETWEEN – minimum real seconds that must pass between captures
 *                      (even if character delta is large)
 */

import { readFile, writeFileContent } from '@/utils/storage/filesystem'
import type { Chapter } from '@/stores/storyStore'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  savedAt:   number  // unix ms
  content:   string
  wordCount: number
  label?:    string  // optional user-supplied label (future)
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SNAPSHOTS    = 20
const MIN_CHARS_DELTA  = 50   // chars
const MIN_SECS_BETWEEN = 60   // seconds

// ─── Internal cache ──────────────────────────────────────────────────────────

const cache = new Map<string, HistoryEntry[]>()

/** Maximum chapter keys kept in the memory cache. */
const MAX_HISTORY_CACHE_KEYS = 50

function key(storyId: string, chapterId: string) {
  return `${storyId}/${chapterId}`
}

function historyPath(storyId: string, chapterId: string) {
  return `stories/${storyId}/history/${chapterId}.json`
}

// ─── I/O helpers ─────────────────────────────────────────────────────────────

async function loadFromDisk(storyId: string, chapterId: string): Promise<HistoryEntry[]> {
  try {
    const raw = await readFile(historyPath(storyId, chapterId))
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

async function persistToDisk(storyId: string, chapterId: string, entries: HistoryEntry[]): Promise<void> {
  await writeFileContent(historyPath(storyId, chapterId), JSON.stringify(entries))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Return the snapshot list for a chapter (loads from disk on first call,
 * then uses the in-memory cache).  Returned array is newest-first.
 */
export async function getHistory(storyId: string, chapterId: string): Promise<HistoryEntry[]> {
  const k = key(storyId, chapterId)
  if (!cache.has(k)) {
    const entries = await loadFromDisk(storyId, chapterId)
    if (cache.size >= MAX_HISTORY_CACHE_KEYS) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(k, entries)
  }
  return [...(cache.get(k)!)].reverse()  // return newest-first copy
}

/**
 * Capture a new snapshot if the content has changed meaningfully since the
 * last one.  Should be called after every successful save.
 */
export async function captureSnapshot(
  storyId: string | null,
  chapter: Chapter,
  content: string,
): Promise<void> {
  if (!storyId || !content.trim()) return

  const k    = key(storyId, chapter.id)
  const list = cache.has(k) ? [...cache.get(k)!] : await loadFromDisk(storyId, chapter.id)

  const last = list[list.length - 1]
  const now  = Date.now()

  if (last) {
    if (content === last.content) return                         // no change at all
    const charDelta  = Math.abs(content.length - last.content.length)
    const secsSince  = (now - last.savedAt) / 1000
    if (charDelta < MIN_CHARS_DELTA && secsSince < MIN_SECS_BETWEEN) return
  }

  const wc = content.trim().split(/\s+/).filter(Boolean).length
  list.push({ savedAt: now, content, wordCount: wc })
  if (list.length > MAX_SNAPSHOTS) list.splice(0, list.length - MAX_SNAPSHOTS)

  // Evict oldest cache key if over limit
  if (!cache.has(k) && cache.size >= MAX_HISTORY_CACHE_KEYS) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(k, list)
  await persistToDisk(storyId, chapter.id, list)
}

/**
 * Drop the cached entries for a chapter (call on story switch to free memory).
 */
export function evictCache(storyId: string, chapterId: string): void {
  cache.delete(key(storyId, chapterId))
}
