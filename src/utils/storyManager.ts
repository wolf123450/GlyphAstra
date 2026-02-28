/**
 * Story Project Management
 * Handles creation, loading, and management of story projects
 */

import type { StoryMetadata, Chapter, Character } from '@/stores/storyStore'

export interface StoryProject {
  name: string
  path: string
  createdDate: string
  lastModified: string
}

export interface SerializedStory {
  metadata: {
    title: string
    summary: string
    genre: string
    tone: string
    narrativeVoice: string
    createdDate: string
    lastModified: string
    wordCount: number
  }
  chapters: Array<{
    id: string
    name: string
    status: 'draft' | 'in-progress' | 'complete'
    content: string
    wordCount: number
    lastEdited: string
    // Extended / AI metadata fields
    chapterLabel?: string
    isPlotOutline?: boolean
    contextTags?: string[]
    summary?: string
    summaryGeneratedAt?: number
    summaryContentHash?: string
    summaryPaused?: boolean
    summaryManuallyEdited?: boolean
    isReadOnly?: boolean
    chapterType?: 'toc' | 'cover' | 'license' | 'illustration'
    illustrationPath?: string
    illustrationCaption?: string
  }>
  characters: Array<{
    id: string
    name: string
    description: string
    appearance?: string
    personality?: string
    role?: string
    firstAppearance?: string
  }>
}

/**
 * Create a new story project structure
 */
export function createStoryProject(name: string): SerializedStory {
  const now = new Date().toISOString()
  return {
    metadata: {
      title: name,
      summary: '',
      genre: '',
      tone: '',
      narrativeVoice: '',
      createdDate: now,
      lastModified: now,
      wordCount: 0,
    },
    chapters: [],
    characters: [],
  }
}

/**
 * Serialize story state for persistence
 */
export function serializeStory(
  metadata: StoryMetadata,
  chapters: Chapter[],
  characters: Character[]
): SerializedStory {
  return {
    metadata: {
      title: metadata.title || 'Untitled',
      summary: metadata.summary || '',
      genre: metadata.genre || '',
      tone: metadata.tone || '',
      narrativeVoice: metadata.narrativeVoice || '',
      createdDate: metadata.createdDate,
      lastModified: new Date().toISOString(),
      wordCount: chapters.reduce((sum: number, ch) => sum + ch.wordCount, 0),
    },
    chapters: chapters.map((ch) => ({
      id: ch.id,
      name: ch.name,
      status: ch.status,
      content: ch.content || '',
      wordCount: ch.wordCount || 0,
      lastEdited: ch.lastEdited,
      // Extended fields — only include when set to avoid bloating storage
      ...(ch.chapterLabel          != null  && { chapterLabel:          ch.chapterLabel }),
      ...(ch.isPlotOutline         != null  && { isPlotOutline:         ch.isPlotOutline }),
      ...(ch.contextTags           != null  && { contextTags:           ch.contextTags }),
      ...(ch.summary               != null  && { summary:               ch.summary }),
      ...(ch.summaryGeneratedAt    != null  && { summaryGeneratedAt:    ch.summaryGeneratedAt }),
      ...(ch.summaryContentHash    != null  && { summaryContentHash:    ch.summaryContentHash }),
      ...(ch.summaryPaused         != null  && { summaryPaused:         ch.summaryPaused }),
      ...(ch.summaryManuallyEdited != null  && { summaryManuallyEdited: ch.summaryManuallyEdited }),
      ...(ch.isReadOnly            != null  && { isReadOnly:            ch.isReadOnly }),
      ...(ch.chapterType         != null  && { chapterType:         ch.chapterType }),
      ...(ch.illustrationPath    != null  && { illustrationPath:    ch.illustrationPath }),
      ...(ch.illustrationCaption != null  && { illustrationCaption: ch.illustrationCaption }),
    })),
    characters: characters.map((char) => ({
      id: char.id,
      name: char.name,
      description: char.description || '',
      appearance: char.appearance,
      personality: char.personality,
      role: char.role,
      firstAppearance: char.firstAppearance,
    })),
  }
}

/**
 * Calculate total word count
 */
export function calculateTotalWordCount(chapters: Pick<Chapter, 'wordCount'>[]): number {
  return chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
}

/**
 * Get default project name
 */
export function generateDefaultProjectName(): string {
  const date = new Date()
  return `Story_${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Validate story data
 */
export function validateStoryData(story: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const s = story as Record<string, unknown>

  if (!s.metadata) {
    errors.push('Missing metadata')
  } else {
    const m = s.metadata as Record<string, unknown>
    if (!(typeof m.title === 'string' && m.title.trim())) {
      errors.push('Story title is required')
    }
    if (!m.createdDate) {
      errors.push('Missing creation date')
    }
  }

  if (!Array.isArray(s.chapters)) {
    errors.push('Chapters must be an array')
  }

  if (!Array.isArray(s.characters)) {
    errors.push('Characters must be an array')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
