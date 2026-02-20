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

// ─── Indented list items ─────────────────────────────────────────────

describe('indented list item tokenization', () => {
  it('a top-level list item has indent 0', () => {
    const tokens = tokenizeMarkdown('- item')
    const li = tokenByType(tokens, 'listItem')!
    expect(li.indent).toBe(0)
  })

  it('2-space-indented list item has indent 1', () => {
    const tokens = tokenizeMarkdown('  - item')
    const li = tokenByType(tokens, 'listItem')!
    expect(li.indent).toBe(1)
    expect(li.text).toBe('item')
  })

  it('4-space-indented list item has indent 2', () => {
    const tokens = tokenizeMarkdown('    - item')
    const li = tokenByType(tokens, 'listItem')!
    expect(li.indent).toBe(2)
  })

  it('indented item preserves correct source positions (no gaps)', () => {
    const content = '- top\n  - nested\n- back'
    const tokens = tokenizeMarkdown(content)
    expect(coversFullContent(tokens, content)).toBe(true)
  })

  it('mixed indent list: all items are listItem tokens', () => {
    const content = '- top\n  - nested\n    - deep\n- top again'
    const tokens = tokenizeMarkdown(content)
    const items = allTokensByType(tokens, 'listItem')
    expect(items.length).toBe(4)
  })

  it('indented item text does not include the leading whitespace or marker', () => {
    const tokens = tokenizeMarkdown('  - nested item')
    const li = tokenByType(tokens, 'listItem')!
    expect(li.text).toBe('nested item')
    expect(li.text).not.toContain('-')
    expect(li.text).not.toContain('  ')
  })

  it('indented items with inline formatting become listItem tokens (not plain text)', () => {
    const content = '  - nested with **bold**'
    const tokens = tokenizeMarkdown(content)
    expect(allTokensByType(tokens, 'listItem')).toHaveLength(1)
    expect(tokenByType(tokens, 'listItem')!.indent).toBe(1)
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

// ─── Horizontal rule ─────────────────────────────────────────────────

describe('hr tokenization', () => {
  it('parses --- as hr', () => {
    const content = '---'
    const tokens = tokenizeMarkdown(content)
    const hr = tokenByType(tokens, 'hr')!
    expect(hr).toBeDefined()
    expect(hr.start).toBe(0)
    expect(hr.end).toBe(3)
    expect(hr.text).toBe('')
  })

  it('parses *** as hr', () => {
    const tokens = tokenizeMarkdown('***')
    expect(tokenByType(tokens, 'hr')).toBeDefined()
  })

  it('parses ___ as hr', () => {
    const tokens = tokenizeMarkdown('___')
    expect(tokenByType(tokens, 'hr')).toBeDefined()
  })

  it('hr start matches line position in multi-line content', () => {
    const content = 'before\n---\nafter'
    const tokens = tokenizeMarkdown(content)
    const hr = tokenByType(tokens, 'hr')!
    expect(hr.start).toBe('before\n'.length)
    expect(hr.end).toBe('before\n---'.length)
  })

  it('full coverage with hr', () => {
    const content = 'before\n---\nafter'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })
})

// ─── Blockquote ──────────────────────────────────────────────────────

describe('blockquote tokenization', () => {
  it('parses a simple blockquote', () => {
    const content = '> hello world'
    const tokens = tokenizeMarkdown(content)
    const bq = tokenByType(tokens, 'blockquote')!
    expect(bq).toBeDefined()
    expect(bq.start).toBe(0)
    expect(bq.end).toBe(content.length)
    expect(bq.text).toBe('hello world')
    expect(bq.level).toBe(1)
  })

  it('nested blockquote has correct level', () => {
    const content = '>> nested'
    const tokens = tokenizeMarkdown(content)
    const bq = tokenByType(tokens, 'blockquote')!
    expect(bq.level).toBe(2)
    expect(bq.text).toBe('nested')
  })

  it('blockquote start offset is correct in multi-line content', () => {
    const content = 'intro\n> quote\noutro'
    const tokens = tokenizeMarkdown(content)
    const bq = tokenByType(tokens, 'blockquote')!
    expect(bq.start).toBe('intro\n'.length)
    expect(bq.end).toBe('intro\n> quote'.length)
  })

  it('full coverage with blockquote', () => {
    const content = 'intro\n> quote\noutro'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })
})

// ─── Ordered list ────────────────────────────────────────────────────

describe('orderedList tokenization', () => {
  it('parses a single ordered list item', () => {
    const content = '1. first item'
    const tokens = tokenizeMarkdown(content)
    const ol = tokenByType(tokens, 'orderedList')!
    expect(ol).toBeDefined()
    expect(ol.start).toBe(0)
    expect(ol.end).toBe(content.length)
    expect(ol.text).toBe('first item')
    expect(ol.order).toBe(1)
    expect(ol.indent).toBe(0)
  })

  it('parses multiple ordered list items with correct offsets', () => {
    const content = '1. first\n2. second\n3. third'
    const tokens = tokenizeMarkdown(content)
    const items = allTokensByType(tokens, 'orderedList')
    expect(items).toHaveLength(3)
    expect(items[0].order).toBe(1)
    expect(items[0].start).toBe(0)
    expect(items[1].order).toBe(2)
    expect(items[1].start).toBe('1. first\n'.length)
    expect(items[2].order).toBe(3)
    expect(items[2].start).toBe('1. first\n2. second\n'.length)
  })

  it('parses high-number ordered items', () => {
    const tokens = tokenizeMarkdown('42. item')
    const ol = tokenByType(tokens, 'orderedList')!
    expect(ol.order).toBe(42)
    expect(ol.text).toBe('item')
  })

  it('indented ordered list item has correct indent', () => {
    const tokens = tokenizeMarkdown('  1. nested')
    const ol = tokenByType(tokens, 'orderedList')!
    expect(ol.indent).toBe(1)
    expect(ol.text).toBe('nested')
  })

  it('full coverage with ordered list', () => {
    const content = '1. first\n2. second'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })
})

// ─── Fenced code block ───────────────────────────────────────────────

describe('fencedCode tokenization', () => {
  it('parses a no-language fence', () => {
    const content = '```\nhello\n```'
    const tokens = tokenizeMarkdown(content)
    const fc = tokenByType(tokens, 'fencedCode')!
    expect(fc).toBeDefined()
    expect(fc.start).toBe(0)
    expect(fc.end).toBe(content.length)
    expect(fc.language).toBe('')
    expect(fc.text).toBe('hello')
  })

  it('parses a language-tagged fence', () => {
    const content = '```js\nconsole.log(1)\n```'
    const tokens = tokenizeMarkdown(content)
    const fc = tokenByType(tokens, 'fencedCode')!
    expect(fc).toBeDefined()
    expect(fc.language).toBe('js')
    expect(fc.text).toBe('console.log(1)')
    expect(fc.start).toBe(0)
    expect(fc.end).toBe(content.length)
  })

  it('fenced code start offset is correct in multi-line doc', () => {
    const content = 'intro\n```\ncode\n```\noutro'
    const tokens = tokenizeMarkdown(content)
    const fc = tokenByType(tokens, 'fencedCode')!
    expect(fc.start).toBe('intro\n'.length)
    expect(fc.end).toBe('intro\n```\ncode\n```'.length)
  })

  it('multi-body-line fenced code', () => {
    const content = '```\nline1\nline2\n```'
    const tokens = tokenizeMarkdown(content)
    const fc = tokenByType(tokens, 'fencedCode')!
    expect(fc.text).toBe('line1\nline2')
    expect(fc.end).toBe(content.length)
  })

  it('full coverage: fenced code surrounded by text', () => {
    const content = 'intro\n```\ncode\n```\noutro'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })

  it('empty fence body', () => {
    const content = '```\n```'
    const tokens = tokenizeMarkdown(content)
    const fc = tokenByType(tokens, 'fencedCode')!
    expect(fc).toBeDefined()
    expect(fc.text).toBe('')
    expect(fc.end).toBe(content.length)
    expect(coversFullContent(tokens, content)).toBe(true)
  })
})

// ─── Inline link ─────────────────────────────────────────────────────

describe('link tokenization', () => {
  it('parses a standalone link', () => {
    const content = '[click here](https://example.com)'
    const tokens = tokenizeMarkdown(content)
    const lnk = tokenByType(tokens, 'link')!
    expect(lnk).toBeDefined()
    expect(lnk.start).toBe(0)
    expect(lnk.end).toBe(content.length)
    expect(lnk.text).toBe('click here')
    expect(lnk.url).toBe('https://example.com')
  })

  it('link offset is correct mid-sentence', () => {
    const content = 'See [this](http://x.com) for details'
    const tokens = tokenizeMarkdown(content)
    const lnk = tokenByType(tokens, 'link')!
    expect(lnk.start).toBe('See '.length)
    expect(lnk.end).toBe('See [this](http://x.com)'.length)
    expect(lnk.text).toBe('this')
    expect(lnk.url).toBe('http://x.com')
  })

  it('full coverage with link', () => {
    const content = 'Go to [home](/) now'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })

  it('link followed by bold', () => {
    const content = '[a](b) **bold**'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })
})
