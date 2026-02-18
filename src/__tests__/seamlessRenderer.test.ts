/**
 * Tests for src/utils/seamlessRenderer.ts
 *
 * Validates that tokenizeMarkdown() assigns accurate start/end positions,
 * correct token types, and that rendered HTML is sane.
 */

import { describe, it, expect } from 'vitest'
import { tokenizeMarkdown } from '../utils/seamlessRenderer'
import type { Token } from '../utils/seamlessRenderer'

// ─── Helpers ───────────────────────────────────────────────────────

function tokenByType(tokens: Token[], type: string) {
  return tokens.find(t => t.type === type)
}

function allTokensByType(tokens: Token[], type: string) {
  return tokens.filter(t => t.type === type)
}

function coversFullContent(tokens: Token[], content: string): boolean {
  if (tokens.length === 0) return content.length === 0

  const sorted = [...tokens].sort((a, b) => a.start - b.start)
  if (sorted[0].start !== 0) return false
  if (sorted[sorted.length - 1].end !== content.length) return false

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start !== sorted[i - 1].end) return false
  }
  return true
}

// ─── Coverage: tokens cover entire content with no gaps ────────────

describe('token coverage', () => {
  const cases = [
    'Hello world',
    '**bold**',
    '*italic*',
    '# Header',
    '## Level 2',
    '- list item',
    '`code`',
    '~~strike~~',
    'plain **bold** and *italic*',
    'Hello\nworld',
    '# Title\n\nSome **text** here.\n\n- Item one\n- Item two',
    '',
  ]

  for (const content of cases) {
    it(`covers full content for: "${content.replace(/\n/g, '\\n')}"`, () => {
      const tokens = tokenizeMarkdown(content)
      expect(coversFullContent(tokens, content)).toBe(true)
    })
  }
})

// ─── Headers ────────────────────────────────────────────────────────

describe('header tokenization', () => {
  it('parses h1 correctly', () => {
    const content = '# Hello'
    const tokens = tokenizeMarkdown(content)
    const h = tokenByType(tokens, 'header')!
    expect(h).toBeDefined()
    expect(h.level).toBe(1)
    expect(h.start).toBe(0)
    expect(h.end).toBe(content.length)
    expect(h.content).toBe(content)
    expect(h.text).toBe('Hello')
  })

  it('parses h3 correctly', () => {
    const content = '### Third Level'
    const tokens = tokenizeMarkdown(content)
    const h = tokenByType(tokens, 'header')!
    expect(h.level).toBe(3)
    expect(h.text).toBe('Third Level')
  })

  it('header start matches line start in multi-line content', () => {
    const content = 'First line\n## Header\nThird line'
    const tokens = tokenizeMarkdown(content)
    const h = tokenByType(tokens, 'header')!
    expect(h.start).toBe('First line\n'.length) // 11
    expect(h.end).toBe('First line\n## Header'.length) // 20
  })
})

// ─── Bold ────────────────────────────────────────────────────────────

describe('bold tokenization', () => {
  it('parses standalone bold token', () => {
    const content = '**bold**'
    const tokens = tokenizeMarkdown(content)
    const b = tokenByType(tokens, 'bold')!
    expect(b).toBeDefined()
    expect(b.start).toBe(0)
    expect(b.end).toBe(8)
    expect(b.content).toBe('**bold**')
    expect(b.text).toBe('bold')
  })

  it('parses bold in sentence, start offset is correct', () => {
    const content = 'Hi **bold** end'
    const tokens = tokenizeMarkdown(content)
    const b = tokenByType(tokens, 'bold')!
    expect(b.start).toBe(3)
    expect(b.end).toBe(11)
    expect(b.text).toBe('bold')
  })

  it('content property contains markers', () => {
    const content = '**test**'
    const tokens = tokenizeMarkdown(content)
    const b = tokenByType(tokens, 'bold')!
    expect(b.content).toContain('**')
  })
})

// ─── Italic ──────────────────────────────────────────────────────────

describe('italic tokenization', () => {
  it('parses standalone italic', () => {
    const content = '*italic*'
    const tokens = tokenizeMarkdown(content)
    const i = tokenByType(tokens, 'italic')!
    expect(i).toBeDefined()
    expect(i.start).toBe(0)
    expect(i.end).toBe(8)
    expect(i.text).toBe('italic')
  })
})

// ─── List items ──────────────────────────────────────────────────────

describe('list item tokenization', () => {
  it('parses a single list item', () => {
    const content = '- item one'
    const tokens = tokenizeMarkdown(content)
    const li = tokenByType(tokens, 'listItem')!
    expect(li).toBeDefined()
    expect(li.text).toBe('item one')
    expect(li.start).toBe(0)
    expect(li.end).toBe(content.length)
  })

  it('parses multiple list items with correct start offsets', () => {
    const content = '- first\n- second\n- third'
    const tokens = tokenizeMarkdown(content)
    const listItems = allTokensByType(tokens, 'listItem')
    expect(listItems.length).toBe(3)

    expect(listItems[0].text).toBe('first')
    expect(listItems[0].start).toBe(0)

    expect(listItems[1].text).toBe('second')
    expect(listItems[1].start).toBe('- first\n'.length) // 8

    expect(listItems[2].text).toBe('third')
    expect(listItems[2].start).toBe('- first\n- second\n'.length) // 18
  })
})

// ─── Code spans ──────────────────────────────────────────────────────

describe('inline code tokenization', () => {
  it('parses inline code', () => {
    const content = '`code`'
    const tokens = tokenizeMarkdown(content)
    const c = tokenByType(tokens, 'code')!
    expect(c).toBeDefined()
    expect(c.text).toBe('code')
    expect(c.start).toBe(0)
    expect(c.end).toBe(6)
  })
})

// ─── Strikethrough ───────────────────────────────────────────────────

describe('strikethrough tokenization', () => {
  it('parses strikethrough', () => {
    const content = '~~strike~~'
    const tokens = tokenizeMarkdown(content)
    const s = tokenByType(tokens, 'strikethrough')!
    expect(s).toBeDefined()
    expect(s.text).toBe('strike')
    expect(s.start).toBe(0)
    expect(s.end).toBe(10)
  })
})

// ─── Newlines ────────────────────────────────────────────────────────

describe('newline handling', () => {
  it('newline characters are accounted for in positions', () => {
    const content = 'line1\nline2'
    const tokens = tokenizeMarkdown(content)
    // Plain text lines produce a single text token covering the whole content
    expect(coversFullContent(tokens, content)).toBe(true)
    // The text token must include the newline character in its range
    const textToken = tokens.find(t => t.type === 'text')
    expect(textToken).toBeDefined()
    expect(textToken!.end - textToken!.start).toBe(content.length)
  })

  it('content with only a newline has coverage', () => {
    const content = '\n'
    const tokens = tokenizeMarkdown(content)
    expect(coversFullContent(tokens, content)).toBe(true)
  })
})

// ─── Edge cases ──────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty content returns no tokens', () => {
    const tokens = tokenizeMarkdown('')
    expect(tokens.length).toBe(0)
  })

  it('plain text becomes a text token', () => {
    const content = 'just plain text'
    const tokens = tokenizeMarkdown(content)
    expect(tokens.some(t => t.type === 'text')).toBe(true)
  })

  it('all token start values are >= 0', () => {
    const content = '# Title\n**bold** and *italic* on a line\n- bullet'
    const tokens = tokenizeMarkdown(content)
    tokens.forEach(t => {
      expect(t.start).toBeGreaterThanOrEqual(0)
      expect(t.end).toBeGreaterThan(t.start)
    })
  })

  it('no token end exceeds content.length', () => {
    const content = 'Short **text**'
    const tokens = tokenizeMarkdown(content)
    tokens.forEach(t => {
      expect(t.end).toBeLessThanOrEqual(content.length)
    })
  })
})
