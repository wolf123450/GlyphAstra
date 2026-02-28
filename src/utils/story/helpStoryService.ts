/**
 * helpStoryService.ts
 *
 * Manages the lifecycle of the built-in help story:
 *   - Create from embedded definition on first run
 *   - Load & re-apply isReadOnly flags from embedded definition
 *   - Reset read-only chapters to bundled content
 *   - Ensure help story exists without switching active project
 *
 * Extracted from storyStore to keep the store focused on core state.
 */

import { HELP_STORY_ID, HELP_CHAPTERS } from './helpStory'
import { useStoryStore } from '@/stores/storyStore'
import { getProjectsList } from '@/utils/storage/persistenceService'

/**
 * Word count helper (copy avoids coupling to the store's internal helper).
 */
function wc(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Load the built-in help story, creating it from the embedded definition
 * if it doesn't exist yet.  After loading, re-applies isReadOnly flags from
 * the embedded definition (so they survive even if storage stripped them).
 * Returns true if the help story is now active.
 */
export async function loadOrCreateHelpStory(): Promise<boolean> {
  const store = useStoryStore()

  let loaded = await store.loadStory(HELP_STORY_ID)
  if (!loaded) {
    // First time: build the story in memory from the embedded definition
    const now = new Date().toISOString()
    store.updateMetadata({
      title: 'Help & Reference',
      summary: 'Built-in reference guide and sandbox for BlockBreaker.',
      genre: '',
      tone: '',
      narrativeVoice: '',
      createdDate: now,
      lastModified: now,
      wordCount: 0,
    })

    const chapters = HELP_CHAPTERS.map((ch) => ({
      id: ch.id,
      name: ch.name,
      path: ch.name.toLowerCase().replace(/\s+/g, '-'),
      status: 'draft' as const,
      content: ch.content,
      wordCount: wc(ch.content),
      lastEdited: now,
      isReadOnly: ch.isReadOnly,
    }))
    // Replace chapters and characters wholesale
    store.replaceChapters(chapters)
    store.replaceCharacters([])
    store.setCurrentStory(HELP_STORY_ID)
    store.setCurrentChapter(null)
    loaded = true
    // Persist it so it survives restarts
    await store.saveStory(HELP_STORY_ID)
  } else {
    // Re-apply isReadOnly from embedded definition (storage may have
    // an older schema that didn't persist this field).
    store.replaceChapters(
      store.chapters.map((ch) => {
        const def = HELP_CHAPTERS.find((d) => d.id === ch.id)
        return def ? { ...ch, isReadOnly: def.isReadOnly } : ch
      }),
    )
  }
  return loaded
}

/**
 * Reset the read-only reference chapters of the help story to their
 * bundled content.  Sandbox chapters are left untouched.
 */
export async function resetHelpStory(): Promise<void> {
  const store = useStoryStore()

  // If the help story isn't currently loaded, load it first.
  if (store.currentStoryId !== HELP_STORY_ID) {
    await loadOrCreateHelpStory()
  }
  const now = new Date().toISOString()
  store.replaceChapters(
    store.chapters.map((ch) => {
      const def = HELP_CHAPTERS.find((d) => d.id === ch.id)
      if (!def || !def.isReadOnly) return ch // leave sandbox chapters alone
      return {
        ...ch,
        name: def.name,
        content: def.content,
        wordCount: wc(def.content),
        lastEdited: now,
        isReadOnly: true,
      }
    }),
  )
  await store.saveStory(HELP_STORY_ID)
}

/**
 * Silently ensure the help story exists in storage without switching
 * the currently-active story.  Call this on every app startup so the
 * help story is always present in the project list.
 */
export async function ensureHelpStoryExists(): Promise<void> {
  const projects = getProjectsList()
  if (projects.some((p) => p.id === HELP_STORY_ID)) return

  const store = useStoryStore()

  // Snapshot current in-memory state so we can restore it afterwards
  const savedStoryId = store.currentStoryId
  const savedChapterId = store.currentChapterId
  const savedMetadata = { ...store.metadata }
  const savedChapters = store.chapters.slice()
  const savedCharacters = store.characters.slice()

  // Create and save the help story
  await loadOrCreateHelpStory()

  // Restore original state
  store.updateMetadata(savedMetadata)
  store.replaceChapters(savedChapters)
  store.replaceCharacters(savedCharacters)
  store.setCurrentStory(savedStoryId)
  store.setCurrentChapter(savedChapterId)
}
