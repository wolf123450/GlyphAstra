/**
 * Tests for src/utils/seamlessRenderer.ts
 *
 * Validates that tokenizeMarkdown() assigns accurate start/end positions,
 * correct token types, and that rendered HTML is sane.
 */

import { describe, it, expect } from 'vitest'
import { tokenizeMarkdown, renderTokens, renderPreview } from '../utils/editor/seamlessRenderer'
import type { Token } from '../utils/editor/seamlessRenderer'

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

// ─── Table tokenization ──────────────────────────────────────────────────

describe('table tokenization', () => {
  const SIMPLE = '| A | B |\n|---|---|\n| 1 | 2 |'

  it('produces a single table token', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tables = tokens.filter(t => t.type === 'table')
    expect(tables).toHaveLength(1)
  })

  it('table spans from 0 to content.length for a standalone table', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.start).toBe(0)
    expect(tbl.end).toBe(SIMPLE.length)
  })

  it('full coverage: standalone table', () => {
    expect(coversFullContent(tokenizeMarkdown(SIMPLE), SIMPLE)).toBe(true)
  })

  it('full coverage: table surrounded by text', () => {
    const content = 'intro\n' + SIMPLE + '\noutro'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })

  it('table start offset is correct when preceded by text', () => {
    const prefix = 'intro\n'
    const content = prefix + SIMPLE
    const tokens = tokenizeMarkdown(content)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.start).toBe(prefix.length)
    expect(tbl.end).toBe(content.length)
  })

  it('table token content contains the raw markdown rows', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.content).toContain('| A | B |')
    expect(tbl.content).toContain('| 1 | 2 |')
  })

  it('rendered HTML contains <table>, <thead>, <tbody>', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<table>')
    expect(tbl.rendered).toContain('<thead>')
    expect(tbl.rendered).toContain('<tbody>')
    expect(tbl.rendered).toContain('</table>')
  })

  it('rendered HTML has <th> for header cells', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<th>A</th>')
    expect(tbl.rendered).toContain('<th>B</th>')
  })

  it('rendered HTML has <td> for data cells', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<td>1</td>')
    expect(tbl.rendered).toContain('<td>2</td>')
  })

  it('table with only header + separator (no data rows) renders correctly', () => {
    const content = '| X | Y |\n|---|---|'
    const tokens = tokenizeMarkdown(content)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl).toBeDefined()
    expect(tbl.rendered).toContain('<th>X</th>')
    expect(tbl.rendered).toContain('<th>Y</th>')
    expect(tbl.rendered).not.toContain('<tbody>')
    expect(coversFullContent(tokens, content)).toBe(true)
  })

  it('table with three columns renders all columns', () => {
    const content = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |'
    const tokens = tokenizeMarkdown(content)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<th>A</th>')
    expect(tbl.rendered).toContain('<th>B</th>')
    expect(tbl.rendered).toContain('<th>C</th>')
    expect(tbl.rendered).toContain('<td>1</td>')
    expect(tbl.rendered).toContain('<td>3</td>')
  })

  it('inline formatting inside table cells is rendered', () => {
    const content = '| **Bold** | *Italic* |\n|---|---|\n| `code` | text |'
    const tokens = tokenizeMarkdown(content)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<strong>Bold</strong>')
    expect(tbl.rendered).toContain('<em>Italic</em>')
    expect(tbl.rendered).toContain('<code>code</code>')
  })

  it('multiple data rows are all rendered', () => {
    const content = '| H |\n|---|\n| R1 |\n| R2 |\n| R3 |'
    const tokens = tokenizeMarkdown(content)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<td>R1</td>')
    expect(tbl.rendered).toContain('<td>R2</td>')
    expect(tbl.rendered).toContain('<td>R3</td>')
  })

  it('line starting with | but no separator is NOT a table', () => {
    // No separator row -> falls through to inline char tokenizer  
    const content = '| just a pipe line'
    const tokens = tokenizeMarkdown(content)
    expect(tokens.some(t => t.type === 'table')).toBe(false)
  })

  it('table in preview render mode produces table HTML', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const html = renderTokens(tokens, SIMPLE, -1, 'preview')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>1</td>')
  })

  it('table separator with column alignment markers is recognised', () => {
    const content = '| Left | Right | Center |\n|:---|---:|:---:|\n| a | b | c |'
    const tokens = tokenizeMarkdown(content)
    expect(tokens.some(t => t.type === 'table')).toBe(true)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.rendered).toContain('<th>Left</th>')
  })

  it('table text field is empty (table is a block token)', () => {
    const tokens = tokenizeMarkdown(SIMPLE)
    const tbl = tokens.find(t => t.type === 'table')!
    expect(tbl.text).toBe('')
  })
})

// ─── Inline HTML in rendered output ─────────────────────────────────────

describe('inline formatting in block token rendered output', () => {
  it('header with bold renders <strong> in rendered field', () => {
    const tokens = tokenizeMarkdown('## Hello **world**')
    const h = tokens.find(t => t.type === 'header')!
    expect(h.rendered).toContain('<strong>world</strong>')
    expect(h.rendered).toMatch(/^<h2>.*<\/h2>$/)
  })

  it('header with italic renders <em>', () => {
    const tokens = tokenizeMarkdown('# *italic* title')
    const h = tokens.find(t => t.type === 'header')!
    expect(h.rendered).toContain('<em>italic</em>')
  })

  it('header with inline code renders <code>', () => {
    const tokens = tokenizeMarkdown('## Use `npm install`')
    const h = tokens.find(t => t.type === 'header')!
    expect(h.rendered).toContain('<code>npm install</code>')
  })

  it('list item with bold renders <strong>', () => {
    const tokens = tokenizeMarkdown('- item with **bold**')
    const li = tokens.find(t => t.type === 'listItem')!
    expect(li.rendered).toContain('<strong>bold</strong>')
  })

  it('list item with italic renders <em>', () => {
    const tokens = tokenizeMarkdown('- *italic* item')
    const li = tokens.find(t => t.type === 'listItem')!
    expect(li.rendered).toContain('<em>italic</em>')
  })

  it('list item with inline code renders <code>', () => {
    const tokens = tokenizeMarkdown('- run `npm start`')
    const li = tokens.find(t => t.type === 'listItem')!
    expect(li.rendered).toContain('<code>npm start</code>')
  })

  it('ordered list item with strikethrough renders <del>', () => {
    const tokens = tokenizeMarkdown('1. ~~done~~')
    const ol = tokens.find(t => t.type === 'orderedList')!
    expect(ol.rendered).toContain('<del>done</del>')
  })

  it('blockquote with bold renders <strong>', () => {
    const tokens = tokenizeMarkdown('> quote with **bold**')
    const bq = tokens.find(t => t.type === 'blockquote')!
    expect(bq.rendered).toContain('<strong>bold</strong>')
  })

  it('blockquote with link renders <a>', () => {
    const tokens = tokenizeMarkdown('> see [here](https://x.com)')
    const bq = tokens.find(t => t.type === 'blockquote')!
    expect(bq.rendered).toContain('<a href="https://x.com">here</a>')
  })

  it('plain list item text is HTML-escaped', () => {
    const tokens = tokenizeMarkdown('- AT&T <corp>')
    const li = tokens.find(t => t.type === 'listItem')!
    expect(li.rendered).toContain('&amp;')
    expect(li.rendered).toContain('&lt;corp&gt;')
    expect(li.rendered).not.toContain('AT&T')
  })

  it('header rendered wraps with correct hN tag', () => {
    for (let lvl = 1; lvl <= 6; lvl++) {
      const tokens = tokenizeMarkdown('#'.repeat(lvl) + ' text')
      const h = tokens.find(t => t.type === 'header')!
      expect(h.rendered).toMatch(new RegExp(`^<h${lvl}>.*</h${lvl}>$`))
    }
  })
})

// ─── Escape characters ─────────────────────────────────────────────────────

describe('escape characters', () => {
  it('\\* produces a text token with text="*"', () => {
    const tokens = tokenizeMarkdown('\\*')
    const t = tokens.find(t => t.type === 'text')!
    expect(t).toBeDefined()
    expect(t.text).toBe('*')
  })

  it('\\* does not produce a bold/italic token', () => {
    const tokens = tokenizeMarkdown('\\*not italic\\*')
    expect(tokens.some(t => t.type === 'italic')).toBe(false)
    expect(tokens.some(t => t.type === 'bold')).toBe(false)
  })

  it('\\\\ produces a text token with text="\\\\"', () => {
    const tokens = tokenizeMarkdown('\\\\\\\\')
    const t = tokens.find(t => t.type === 'text')!
    expect(t.text).toBe('\\')
  })

  it('\\` does not trigger inline code', () => {
    const tokens = tokenizeMarkdown('\\`not code\\`')
    expect(tokens.some(t => t.type === 'code')).toBe(false)
  })

  it('\\[ does not trigger a link', () => {
    const tokens = tokenizeMarkdown('\\[text](url)')
    expect(tokens.some(t => t.type === 'link')).toBe(false)
  })

  it('\\~ does not produce strikethrough', () => {
    const tokens = tokenizeMarkdown('\\~~not strike\\~~')
    expect(tokens.some(t => t.type === 'strikethrough')).toBe(false)
  })

  it('escaped char rendered is the literal char (HTML-safe)', () => {
    // '>' is in the escape class and is HTML-encoded as '&gt;'
    const tokens = tokenizeMarkdown('\\>')
    const t = tokens.find(t => t.text === '>')!
    expect(t).toBeDefined()
    expect(t.rendered).toBe('&gt;')
  })

  it('full coverage with escape sequences', () => {
    const content = 'before \\* after'
    expect(coversFullContent(tokenizeMarkdown(content), content)).toBe(true)
  })

  it('escape sequence token end = start + 2', () => {
    const content = 'x\\*y'
    const tokens = tokenizeMarkdown(content)
    const esc = tokens.find(t => t.text === '*')!
    expect(esc).toBeDefined()
    expect(esc.end - esc.start).toBe(2)
  })

  it('\\# at start of line does not create a header', () => {
    const tokens = tokenizeMarkdown('\\# not a header')
    expect(tokens.some(t => t.type === 'header')).toBe(false)
  })
})

// ─── Preview list grouping ──────────────────────────────────────────────

describe('preview mode list grouping', () => {
  it('groups consecutive ordered list items into a single <ol>', () => {
    const content = '1. First\n2. Second\n3. Third'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    // Should be ONE <ol> with three <li>
    expect(html.match(/<ol/g)?.length).toBe(1)
    expect(html.match(/<li>/g)?.length).toBe(3)
    expect(html).toContain('<li>First</li>')
    expect(html).toContain('<li>Second</li>')
    expect(html).toContain('<li>Third</li>')
  })

  it('groups consecutive unordered list items into a single <ul>', () => {
    const content = '- A\n- B\n- C'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    expect(html.match(/<ul/g)?.length).toBe(1)
    expect(html.match(/<li>/g)?.length).toBe(3)
  })

  it('nests indented ordered list items', () => {
    const content = '1. Top\n   1. Nested A\n   2. Nested B\n2. Back'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    // Should produce nested structure: <ol><li>Top<ol><li>Nested A</li><li>Nested B</li></ol></li><li>Back</li></ol>
    // Two <ol> tags: one top-level, one nested
    expect(html.match(/<ol/g)?.length).toBe(2)
    expect(html.match(/<li>/g)?.length).toBe(4)
  })

  it('nests indented unordered list items', () => {
    const content = '- Top\n  - Nested\n- Back'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    expect(html.match(/<ul/g)?.length).toBe(2)
    expect(html.match(/<li>/g)?.length).toBe(3)
  })

  it('non-list tokens break list grouping', () => {
    const content = '1. First\n\nParagraph\n\n1. Second'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    // Two separate <ol>s
    expect(html.match(/<ol/g)?.length).toBe(2)
  })

  it('preserves start attribute from first item', () => {
    const content = '3. Three\n4. Four'
    const tokens = tokenizeMarkdown(content)
    const html = renderTokens(tokens, content, -1, 'preview')
    expect(html).toContain('<ol start="3">')
  })
})

// ─── Indented fenced code blocks ────────────────────────────────────────

describe('indented fenced code block tokenization', () => {
  it('recognises code block indented with spaces', () => {
    const content = '   ```\n   ollama pull llama3.2\n   ```'
    const tokens = tokenizeMarkdown(content)
    const code = tokens.find(t => t.type === 'fencedCode')
    expect(code).toBeDefined()
    expect(code!.text).toBe('ollama pull llama3.2')
  })

  it('strips indent from body lines', () => {
    const content = '  ```js\n  const x = 1\n  console.log(x)\n  ```'
    const tokens = tokenizeMarkdown(content)
    const code = tokens.find(t => t.type === 'fencedCode')!
    expect(code.text).toBe('const x = 1\nconsole.log(x)')
    expect(code.language).toBe('js')
  })

  it('preserves language tag on indented fence', () => {
    const content = '   ```python\n   print("hi")\n   ```'
    const tokens = tokenizeMarkdown(content)
    const code = tokens.find(t => t.type === 'fencedCode')!
    expect(code.language).toBe('python')
  })

  it('code block within a list item context', () => {
    const content = '2. Pull a model:\n   ```\n   ollama pull llama3.2\n   ```'
    const tokens = tokenizeMarkdown(content)
    const ol = tokens.find(t => t.type === 'orderedList')
    const code = tokens.find(t => t.type === 'fencedCode')
    expect(ol).toBeDefined()
    expect(code).toBeDefined()
    expect(code!.text).toBe('ollama pull llama3.2')
  })
})

describe('renderPreview', () => {
  it('preserves ordered list numbering across an embedded fenced code block', () => {
    const content =
      '1. First item\n' +
      '2. Second item:\n' +
      '   ```\n' +
      '   some code\n' +
      '   ```\n' +
      '3. Third item'
    const tokens = tokenizeMarkdown(content)
    const html = renderPreview(tokens, content)
    // Should produce a single <ol> that is never closed and reopened
    const olOpens = (html.match(/<ol/g) || []).length
    expect(olOpens).toBe(1)
    // All three <li> items should be present
    const liMatches = html.match(/<li/g) || []
    expect(liMatches.length).toBe(3)
    // The code block should appear between items (withSL adds data-source-line)
    expect(html).toContain('<code>some code</code>')
  })

  it('groups inline formatting into a single paragraph', () => {
    const content = 'Hello **bold** world'
    const tokens = tokenizeMarkdown(content)
    const html = renderPreview(tokens)
    // Should be a single <p>, not multiple
    const pCount = (html.match(/<p>/g) || []).length
    expect(pCount).toBe(1)
    expect(html).toContain('Hello ')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain(' world')
  })
})
