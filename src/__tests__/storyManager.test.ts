import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createStoryProject,
  serializeStory,
  calculateTotalWordCount,
  generateDefaultProjectName,
  validateStoryData,
} from '../utils/storyManager'
import type { StoryMetadata, Chapter, Character } from '@/stores/storyStore'

// Freeze time for deterministic tests
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-03-15T10:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

// --- helpers ---
function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    name: 'Chapter 1',
    status: 'draft',
    content: 'Some words here',
    wordCount: 3,
    lastEdited: '2025-03-15T09:00:00.000Z',
    ...overrides,
  } as Chapter
}

function makeMetadata(overrides: Partial<StoryMetadata> = {}): StoryMetadata {
  return {
    title: 'My Story',
    summary: 'A great story',
    genre: 'Fantasy',
    tone: 'Dark',
    narrativeVoice: 'First person',
    createdDate: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as StoryMetadata
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Alice',
    description: 'Main protagonist',
    ...overrides,
  } as Character
}

// === Tests ===

describe('createStoryProject', () => {
  it('returns valid structure with given name', () => {
    const project = createStoryProject('My Novel')
    expect(project.metadata.title).toBe('My Novel')
    expect(project.chapters).toEqual([])
    expect(project.characters).toEqual([])
  })

  it('sets timestamps to current time', () => {
    const project = createStoryProject('Test')
    expect(project.metadata.createdDate).toBe('2025-03-15T10:00:00.000Z')
    expect(project.metadata.lastModified).toBe('2025-03-15T10:00:00.000Z')
  })

  it('initializes wordCount to 0 and strings to empty', () => {
    const project = createStoryProject('X')
    expect(project.metadata.wordCount).toBe(0)
    expect(project.metadata.summary).toBe('')
    expect(project.metadata.genre).toBe('')
    expect(project.metadata.tone).toBe('')
    expect(project.metadata.narrativeVoice).toBe('')
  })
})

describe('serializeStory', () => {
  it('serializes basic metadata', () => {
    const result = serializeStory(makeMetadata(), [], [])
    expect(result.metadata.title).toBe('My Story')
    expect(result.metadata.summary).toBe('A great story')
    expect(result.metadata.lastModified).toBe('2025-03-15T10:00:00.000Z')
  })

  it('defaults title to Untitled if empty', () => {
    const result = serializeStory(makeMetadata({ title: '' }), [], [])
    expect(result.metadata.title).toBe('Untitled')
  })

  it('calculates total wordCount from chapters', () => {
    const chapters = [
      makeChapter({ wordCount: 100 }),
      makeChapter({ id: 'ch-2', wordCount: 200 }),
    ]
    const result = serializeStory(makeMetadata(), chapters, [])
    expect(result.metadata.wordCount).toBe(300)
  })

  it('includes basic chapter fields', () => {
    const ch = makeChapter()
    const result = serializeStory(makeMetadata(), [ch], [])
    expect(result.chapters[0]).toMatchObject({
      id: 'ch-1',
      name: 'Chapter 1',
      status: 'draft',
      content: 'Some words here',
      wordCount: 3,
    })
  })

  it('omits extended chapter fields when null/undefined', () => {
    const ch = makeChapter()
    const result = serializeStory(makeMetadata(), [ch], [])
    expect(result.chapters[0]).not.toHaveProperty('chapterLabel')
    expect(result.chapters[0]).not.toHaveProperty('isPlotOutline')
    expect(result.chapters[0]).not.toHaveProperty('contextTags')
    expect(result.chapters[0]).not.toHaveProperty('summary')
    expect(result.chapters[0]).not.toHaveProperty('isReadOnly')
    expect(result.chapters[0]).not.toHaveProperty('chapterType')
  })

  it('includes extended chapter fields when set', () => {
    const ch = makeChapter({
      chapterLabel: 'Prologue',
      isPlotOutline: true,
      contextTags: ['intro'],
      summary: 'Summary text',
      summaryGeneratedAt: 12345,
      summaryContentHash: 'abc',
      summaryPaused: false,
      summaryManuallyEdited: true,
      isReadOnly: true,
      chapterType: 'toc',
      illustrationPath: '/img/cover.png',
      illustrationCaption: 'A dragon',
    })
    const result = serializeStory(makeMetadata(), [ch], [])
    const out = result.chapters[0]
    expect(out.chapterLabel).toBe('Prologue')
    expect(out.isPlotOutline).toBe(true)
    expect(out.contextTags).toEqual(['intro'])
    expect(out.summary).toBe('Summary text')
    expect(out.summaryGeneratedAt).toBe(12345)
    expect(out.summaryContentHash).toBe('abc')
    expect(out.summaryPaused).toBe(false)
    expect(out.summaryManuallyEdited).toBe(true)
    expect(out.isReadOnly).toBe(true)
    expect(out.chapterType).toBe('toc')
    expect(out.illustrationPath).toBe('/img/cover.png')
    expect(out.illustrationCaption).toBe('A dragon')
  })

  it('serializes characters with optional fields', () => {
    const char = makeCharacter({
      appearance: 'Tall',
      personality: 'Bold',
      role: 'Protagonist',
      firstAppearance: 'Chapter 1',
    })
    const result = serializeStory(makeMetadata(), [], [char])
    expect(result.characters[0]).toMatchObject({
      id: 'char-1',
      name: 'Alice',
      description: 'Main protagonist',
      appearance: 'Tall',
      personality: 'Bold',
      role: 'Protagonist',
      firstAppearance: 'Chapter 1',
    })
  })

  it('defaults empty strings for missing metadata fields', () => {
    const meta = makeMetadata({ summary: undefined, genre: undefined, tone: undefined, narrativeVoice: undefined })
    const result = serializeStory(meta, [], [])
    expect(result.metadata.summary).toBe('')
    expect(result.metadata.genre).toBe('')
    expect(result.metadata.tone).toBe('')
    expect(result.metadata.narrativeVoice).toBe('')
  })
})

describe('calculateTotalWordCount', () => {
  it('sums word counts across chapters', () => {
    expect(calculateTotalWordCount([{ wordCount: 10 }, { wordCount: 20 }])).toBe(30)
  })

  it('returns 0 for empty array', () => {
    expect(calculateTotalWordCount([])).toBe(0)
  })

  it('treats falsy wordCount as 0', () => {
    expect(calculateTotalWordCount([{ wordCount: 0 }, { wordCount: undefined as unknown as number }])).toBe(0)
  })
})

describe('generateDefaultProjectName', () => {
  it('produces date-based name in YYYYMMDD format', () => {
    const name = generateDefaultProjectName()
    expect(name).toBe('Story_20250315')
  })

  it('pads single-digit months and days', () => {
    // Use noon UTC to avoid timezone offset flipping the local date
    vi.setSystemTime(new Date('2025-01-05T12:00:00.000Z'))
    expect(generateDefaultProjectName()).toBe('Story_20250105')
  })
})

describe('validateStoryData', () => {
  it('returns valid for correct data', () => {
    const result = validateStoryData({
      metadata: { title: 'Test', createdDate: '2025-01-01' },
      chapters: [],
      characters: [],
    })
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('reports missing metadata', () => {
    const result = validateStoryData({ chapters: [], characters: [] })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing metadata')
  })

  it('reports empty title', () => {
    const result = validateStoryData({
      metadata: { title: '', createdDate: '2025-01-01' },
      chapters: [],
      characters: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Story title is required')
  })

  it('reports whitespace-only title', () => {
    const result = validateStoryData({
      metadata: { title: '   ', createdDate: '2025-01-01' },
      chapters: [],
      characters: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Story title is required')
  })

  it('reports missing creation date', () => {
    const result = validateStoryData({
      metadata: { title: 'Valid' },
      chapters: [],
      characters: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing creation date')
  })

  it('reports non-array chapters', () => {
    const result = validateStoryData({
      metadata: { title: 'Test', createdDate: '2025-01-01' },
      chapters: 'not an array',
      characters: [],
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Chapters must be an array')
  })

  it('reports non-array characters', () => {
    const result = validateStoryData({
      metadata: { title: 'Test', createdDate: '2025-01-01' },
      chapters: [],
      characters: null,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Characters must be an array')
  })

  it('collects multiple errors', () => {
    const result = validateStoryData({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})
