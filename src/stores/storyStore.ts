import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { storageManager } from "@/utils/storage";
import { serializeStory } from "@/utils/storyManager";

export interface Chapter {
  id: string;
  name: string;
  path?: string;
  status: "draft" | "in-progress" | "complete";
  wordCount: number;
  lastEdited: string;
  content: string;
  parentId?: string;
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
   * Save story to storage
   */
  const saveStory = async (storyId?: string): Promise<boolean> => {
    const id = storyId || currentStoryId.value;
    if (!id) {
      console.warn("No story ID provided");
      return false;
    }

    isSaving.value = true;
    try {
      const serialized = serializeStory(
        metadata.value,
        chapters.value,
        characters.value
      );
      const success = await storageManager.saveStory(id, serialized);
      if (success) {
        metadata.value.lastModified = new Date().toISOString();
      }
      return success;
    } catch (error) {
      console.error("Failed to save story:", error);
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * Load story from storage
   */
  const loadStory = async (storyId: string): Promise<boolean> => {
    isSaving.value = true;
    try {
      const story = await storageManager.loadStory(storyId);
      if (!story) {
        console.warn("Story not found:", storyId);
        return false;
      }

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

      // Load chapters with default path if not present
      chapters.value = story.chapters.map((ch) => ({
        id: ch.id,
        name: ch.name,
        path: ch.name.toLowerCase().replace(/\s+/g, "-"),
        status: ch.status,
        content: ch.content,
        wordCount: ch.wordCount,
        lastEdited: ch.lastEdited,
      }));
      
      characters.value = story.characters;
      currentStoryId.value = storyId;

      return true;
    } catch (error) {
      console.error("Failed to load story:", error);
      return false;
    } finally {
      isSaving.value = false;
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

  return {
    // State
    metadata,
    chapters,
    characters,
    currentChapterId,
    currentStoryId,
    isSaving,
    // Computed
    currentChapter,
    totalWordCount,
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
  };
});
