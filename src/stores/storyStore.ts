import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  saveStoryData,
  loadStoryData,
  deleteStoryData,
} from "@/utils/storage/persistenceService";
import type { BackupFile } from "@/utils/storage/backupRestore";
import { HELP_STORY_ID, HELP_CHAPTERS } from "@/utils/story/helpStory";
import { evictPackCache } from "@/utils/media/imagePackManager";
import { clearImageCache } from "@/utils/media/imageUtils";
import { logger } from "@/utils/logger";

export interface Chapter {
  id: string;
  name: string;
  path?: string;
  status: "draft" | "in-progress" | "complete";
  wordCount: number;
  lastEdited: string;
  content: string;
  parentId?: string;
  // AI context
  summary?: string;
  summaryGeneratedAt?: number;   // unix ms
  summaryContentHash?: string;   // cheap hash for delta detection
  summaryPaused?: boolean;       // disable auto-summary for this chapter
  summaryManuallyEdited?: boolean; // manual edit active — won't auto-update
  chapterLabel?: string;         // display prefix override e.g. 'Prologue', 'Chapter 4', 'Part II'
  isPlotOutline?: boolean;       // inject as outline layer in AI context
  contextTags?: string[];        // e.g. ['POV: Alice', 'Timeline A']; empty = always included
  isReadOnly?: boolean;          // editor disabled (used by help story chapters)
  chapterType?: 'toc' | 'cover' | 'license' | 'illustration'  // absent/normal = regular chapter
  illustrationPath?: string       // illustration chapters: local file path
  illustrationCaption?: string    // illustration chapters: caption text
}

export interface Character {
  id: string;
  name: string;
  description: string;
  appearance?: string;
  personality?: string;
  role?: string;
  firstAppearance?: string;
}

export interface StoryMetadata {
  title: string;
  summary: string;
  genre: string;
  tone: string;
  narrativeVoice: string;
  createdDate: string;
  lastModified: string;
  wordCount: number;
}

export const useStoryStore = defineStore("story", () => {
  const metadata = ref<StoryMetadata>({
    title: "Untitled Story",
    summary: "",
    genre: "",
    tone: "",
    narrativeVoice: "",
    createdDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    wordCount: 0,
  });

  const chapters = ref<Chapter[]>([]);
  const characters = ref<Character[]>([]);
  const currentChapterId = ref<string | null>(null);
  const currentStoryId = ref<string | null>(null);
  const isSaving = ref<boolean>(false);
  const isLoading = ref<boolean>(false);  /** Active context tag filter for AI (session-only). Empty = include all chapters. */
  const activeContextTags = ref<string[]>([])

  /** All unique contextTags across all chapters in the current story. */
  const allContextTags = computed(() => {
    const tags = new Set<string>()
    for (const ch of chapters.value) {
      for (const t of ch.contextTags ?? []) tags.add(t)
    }
    return [...tags].sort()
  })
  const currentChapter = computed(() => {
    if (!currentChapterId.value) return null;
    return chapters.value.find((ch) => ch.id === currentChapterId.value);
  });

  const totalWordCount = computed(() => {
    return chapters.value.reduce((sum, ch) => sum + ch.wordCount, 0);
  });

  const getChapterById = (id: string) => {
    return chapters.value.find((ch) => ch.id === id);
  };

  const getChaptersByParent = (parentId?: string) => {
    return chapters.value.filter((ch) => ch.parentId === parentId);
  };

  const addChapter = (chapter: Chapter) => {
    chapters.value.push(chapter);
    metadata.value.lastModified = new Date().toISOString();
  };

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    const chapter = chapters.value.find((ch) => ch.id === id)
    if (chapter) {
      Object.assign(chapter, updates)
      metadata.value.lastModified = new Date().toISOString()
    }
  }

  const deleteChapter = (id: string) => {
    const index = chapters.value.findIndex((ch) => ch.id === id);
    if (index > -1) {
      chapters.value.splice(index, 1);
      metadata.value.lastModified = new Date().toISOString();
    }
  };

  const addCharacter = (character: Character) => {
    characters.value.push(character);
    metadata.value.lastModified = new Date().toISOString();
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    const character = characters.value.find((c) => c.id === id);
    if (character) {
      Object.assign(character, updates);
      metadata.value.lastModified = new Date().toISOString();
    }
  };

  const deleteCharacter = (id: string) => {
    const index = characters.value.findIndex((c) => c.id === id);
    if (index > -1) {
      characters.value.splice(index, 1);
      metadata.value.lastModified = new Date().toISOString();
    }
  };

  const updateMetadata = (updates: Partial<StoryMetadata>) => {
    Object.assign(metadata.value, updates);
    metadata.value.lastModified = new Date().toISOString();
  };

  const setCurrentChapter = (id: string | null) => {
    currentChapterId.value = id
  }

  const setCurrentStory = (id: string | null) => {
    currentStoryId.value = id;
  };

  /**
   * Save story to storage (file system + localStorage via persistenceService)
   */
  const saveStory = async (storyId?: string): Promise<boolean> => {
    const id = storyId || currentStoryId.value;
    if (!id) {
      logger.warn('StoryStore', 'No story ID provided');
      return false;
    }

    isSaving.value = true;
    try {
      const success = await saveStoryData(
        id,
        metadata.value,
        chapters.value,
        characters.value,
      );
      if (success) {
        metadata.value.lastModified = new Date().toISOString();
      }
      return success;
    } catch (error) {
      logger.error('StoryStore', 'Failed to save story:', error);
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * Load story from storage (via persistenceService)
   */
  const loadStory = async (storyId: string): Promise<boolean> => {
    isLoading.value = true;
    // Evict image caches for the outgoing story before loading a new one
    const prevId = currentStoryId.value
    if (prevId && prevId !== storyId) {
      clearImageCache()
      evictPackCache(prevId)
    }
    try {
      const story = await loadStoryData(storyId)
      if (!story) return false

      // Load story data
      metadata.value = {
        title: story.metadata.title,
        summary: story.metadata.summary,
        genre: story.metadata.genre,
        tone: story.metadata.tone,
        narrativeVoice: story.metadata.narrativeVoice,
        createdDate: story.metadata.createdDate,
        lastModified: story.metadata.lastModified,
        wordCount: story.metadata.wordCount,
      };

      // Spread all stored chapter fields so extended properties
      // (isReadOnly, isPlotOutline, contextTags, summary, etc.) survive reload.
      let mappedChapters = story.chapters.map((ch) => ({
        ...ch,
        path: (ch as any).path ?? ch.name.toLowerCase().replace(/\s+/g, "-"),
      }));

      // For the help story, always re-apply isReadOnly from the embedded definition
      // in case the story was stored before the read-only flag was introduced.
      if (storyId === HELP_STORY_ID) {
        mappedChapters = mappedChapters.map((ch) => {
          const def = HELP_CHAPTERS.find((d) => d.id === ch.id);
          return def ? { ...ch, isReadOnly: def.isReadOnly } : ch;
        });
      }

      chapters.value = mappedChapters;
      
      characters.value = story.characters;
      currentStoryId.value = storyId;
      currentChapterId.value = null; // caller can select a chapter after load

      return true;
    } catch (error) {
      logger.error('StoryStore', 'Failed to load story:', error);
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Create new story
   */
  const createNewStory = (title: string = "Untitled Story"): string => {
    const now = new Date().toISOString();
    const newStoryId = `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    metadata.value = {
      title,
      summary: "",
      genre: "",
      tone: "",
      narrativeVoice: "",
      createdDate: now,
      lastModified: now,
      wordCount: 0,
    };
    chapters.value = [];
    characters.value = [];
    currentChapterId.value = null;
    currentStoryId.value = newStoryId;
    
    return newStoryId;
  };

  /**
   * Clear all data
   */
  const clearStory = () => {
    createNewStory();
    currentStoryId.value = null;
  };

  /**
   * Permanently delete a story from all storage layers (via persistenceService).
   * If the deleted story is currently open, clears in-memory state.
   * Returns true if at least one storage layer succeeded.
   */
  const deleteStory = async (storyId: string): Promise<boolean> => {
    const success = await deleteStoryData(storyId)
    // If this was the active story, reset in-memory state
    if (currentStoryId.value === storyId) {
      clearStory();
    }
    return success;
  };

  /**
   * Replace the entire chapters array (used by helpStoryService).
   */
  const replaceChapters = (newChapters: Chapter[]) => {
    chapters.value = newChapters
    metadata.value.lastModified = new Date().toISOString()
  }

  /**
   * Replace the entire characters array (used by helpStoryService).
   */
  const replaceCharacters = (newCharacters: Character[]) => {
    characters.value = newCharacters
    metadata.value.lastModified = new Date().toISOString()
  }

  /**
   * Reorder chapters by providing a new array of chapter IDs.
   * Chapters not in newOrder are appended at the end (safety net).
   */
  const reorderChapters = (newOrder: string[]) => {
    const idToChapter = new Map(chapters.value.map(ch => [ch.id, ch]))
    const reordered = newOrder
      .map(id => idToChapter.get(id))
      .filter((ch): ch is Chapter => Boolean(ch))
    // Append any chapters missing from newOrder
    const reorderedIds = new Set(newOrder)
    for (const ch of chapters.value) {
      if (!reorderedIds.has(ch.id)) reordered.push(ch)
    }
    chapters.value = reordered
    metadata.value.lastModified = new Date().toISOString()
  };

  /**
   * Restore full story state from a backup file.
   * Assigns a fresh story ID so the restored copy never overwrites an
   * existing project.  Caller should follow up with saveStory(newId) to
   * persist the restored data.
   * Returns the new story ID.
   */
  const restoreFromBackup = (backup: BackupFile): string => {
    const newId = `story-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    metadata.value = {
      ...backup.metadata,
      lastModified: new Date().toISOString(),
    }
    // Preserve all chapter fields (including AI metadata)
    chapters.value = backup.chapters.map((ch) => ({ ...ch }))
    characters.value = backup.characters.map((c) => ({ ...c }))
    currentChapterId.value = backup.chapters[0]?.id ?? null
    currentStoryId.value = newId
    return newId
  };

  return {
    // State
    metadata,
    chapters,
    characters,
    currentChapterId,
    currentStoryId,
    isSaving,
    isLoading,
    activeContextTags,
    // Computed
    currentChapter,
    totalWordCount,
    allContextTags,
    // Methods
    getChapterById,
    getChaptersByParent,
    addChapter,
    updateChapter,
    deleteChapter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    updateMetadata,
    setCurrentChapter,
    setCurrentStory,
    saveStory,
    loadStory,
    createNewStory,
    clearStory,
    reorderChapters,
    restoreFromBackup,
    deleteStory,
    replaceChapters,
    replaceCharacters,
    HELP_STORY_ID,
  };
});
