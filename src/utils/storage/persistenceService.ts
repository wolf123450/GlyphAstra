/**
 * persistenceService.ts
 *
 * Centralized persistence facade for story data.
 * Coordinates file-system (primary) and localStorage (backup) storage
 * layers with consistent save/load/delete semantics.
 *
 * Extracted from storyStore to decouple persistence concerns from
 * in-memory state management.
 */

import { storageManager } from './storage'
import { serializeStory } from '@/utils/story/storyManager'
import {
  saveStory as fsSaveStory,
  loadStory as fsLoadStory,
  deleteStory as fsDeleteStory,
} from './fileStorage'
import type { SerializedStory } from '@/utils/story/storyManager'
import type { StoryMetadata, Chapter, Character } from '@/stores/storyStore'
import { logger } from '@/utils/logger'

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Save story to both file system (primary) and localStorage (backup).
 * Returns true if at least one storage layer succeeded.
 */
export async function saveStoryData(
  storyId: string,
  metadata: StoryMetadata,
  chapters: Chapter[],
  characters: Character[],
): Promise<boolean> {
  const serialized = serializeStory(metadata, chapters, characters)

  const [fsSuccess, lsSuccess] = await Promise.allSettled([
    fsSaveStory(storyId, serialized),
    storageManager.saveStory(storyId, serialized),
  ]).then((results) =>
    results.map((r) => (r.status === 'fulfilled' ? r.value : false)),
  )

  const success = fsSuccess || lsSuccess
  if (!fsSuccess) logger.warn('Persistence', 'File system save failed; localStorage only.')
  return success as boolean
}

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load story data from storage.
 * Prefers file system; falls back to localStorage.
 * Returns null if the story is not found or is corrupt.
 */
export async function loadStoryData(
  storyId: string,
): Promise<SerializedStory | null> {
  // Prefer file system; fall back to localStorage
  let story = await fsLoadStory(storyId)
  if (!story) {
    logger.info('Persistence', 'Not on disk, trying localStorage...')
    story = await storageManager.loadStory(storyId)
  }
  if (!story) {
    logger.warn('Persistence', 'Story not found:', storyId)
    return null
  }

  // Basic shape validation
  if (
    !story.metadata || typeof story.metadata.title !== 'string' ||
    !Array.isArray(story.chapters) || !Array.isArray(story.characters)
  ) {
    logger.error('Persistence', 'Corrupt story data — missing metadata, chapters, or characters array')
    return null
  }

  return story
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Permanently delete a story from all storage layers.
 * Returns true if at least one layer succeeded.
 */
export async function deleteStoryData(storyId: string): Promise<boolean> {
  const [fsResult, lsResult] = await Promise.allSettled([
    fsDeleteStory(storyId),
    storageManager.deleteStory(storyId),
  ])
  return (
    (fsResult.status === 'fulfilled' && fsResult.value) ||
    (lsResult.status === 'fulfilled' && lsResult.value)
  )
}

// ─── Project List ─────────────────────────────────────────────────────────────

/**
 * Retrieve the list of all known projects from localStorage.
 */
export function getProjectsList(): Array<{ id: string; name: string; lastModified: string }> {
  return storageManager.getProjectsList()
}
