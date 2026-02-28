/**
 * Tests for src/utils/editorCursor.ts
 *
 * These run in jsdom (see vitest config), so window.getSelection() is available.
 * We use real DOM manipulation to exercise the exact same code paths
 * that run inside the browser.
 */

import { describe, it, expect } from 'vitest'
import { tokenizeMarkdown } from '../utils/editor/seamlessRenderer'
import {
  buildStructuredHTML,
  getCursorOffset,
  setCursorPosition,
  getSelectionRange,
  updateTokenVisibility,
  countTextUpTo,
  findTokenSpan,
} from '../utils/editor/editorCursor'

// ─── Helpers ───────────────────────────────────────────────────────

function makeContainer(content: string): HTMLDivElement {
  const div = document.createElement('div')
  const tokens = tokenizeMarkdown(content)
  div.innerHTML = buildStructuredHTML(tokens, content)
  document.body.appendChild(div)
  return div
}

function cleanup(div: HTMLDivElement) {
  document.body.removeChild(div)
}

// Place a real DOM Selection at the requested source position and return
// the browser Selection object. Uses setCursorPosition under the hood.
function placeAt(container: HTMLDivElement, pos: number): Selection {
  setCursorPosition(container, container.textContent?.length ?? 0, pos, window.getSelection())
  return window.getSelection()!
}

// ─── buildStructuredHTML ────────────────────────────────────────────

describe('buildStructuredHTML', () => {
  it('produces a span for every character range with no gaps', () => {
    const content = 'Hello **world** end'
    const tokens = tokenizeMarkdown(content)
    const div = document.createElement('div')
    div.innerHTML = buildStructuredHTML(tokens, content)

    const spans = Array.from(div.querySelectorAll('[data-start]'))
    expect(spans.length).toBeGreaterThan(0)

    // Sort by start position
    const sorted = spans
      .map(el => ({
        start: parseInt(el.getAttribute('data-start')!),
        end: parseInt(el.getAttribute('data-end')!),
      }))
      .sort((a, b) => a.start - b.start)

    // First span starts at 0
    expect(sorted[0].start).toBe(0)
    // Last span ends at content.length
    expect(sorted[sorted.length - 1].end).toBe(content.length)

    // No gaps between consecutive spans
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].start).toBe(sorted[i - 1].end)
    }
  })

  it('gives bold spans data-start == position of first *', () => {
    const content = '**bold**'
    const tokens = tokenizeMarkdown(content)
    const div = document.createElement('div')
    div.innerHTML = buildStructuredHTML(tokens, content)

    const boldSpan = div.querySelector('.token-bold')
    expect(boldSpan).not.toBeNull()
    expect(boldSpan!.getAttribute('data-start')).toBe('0')
    expect(boldSpan!.getAttribute('data-end')).toBe(String(content.length))
  })

  it('gives header spans the correct level attribute', () => {
    const content = '## Heading'
    const tokens = tokenizeMarkdown(content)
    const div = document.createElement('div')
    div.innerHTML = buildStructuredHTML(tokens, content)

    const header = div.querySelector('.token-header')
    expect(header).not.toBeNull()
    expect(header!.getAttribute('data-level')).toBe('2')
  })

  it('adds `rendered` class to formatted tokens by default', () => {
    const content = '**bold** and *italic*'
    const tokens = tokenizeMarkdown(content)
    const div = document.createElement('div')
    div.innerHTML = buildStructuredHTML(tokens, content)

    const bold = div.querySelector('.token-bold')
    const italic = div.querySelector('.token-italic')
    expect(bold?.classList.contains('rendered')).toBe(true)
    expect(italic?.classList.contains('rendered')).toBe(true)
  })
})

// ─── countTextUpTo ──────────────────────────────────────────────────

describe('countTextUpTo', () => {
  it('counts plain text correctly', () => {
    const span = document.createElement('span')
    span.textContent = 'Hello'
    const textNode = span.firstChild!
    expect(countTextUpTo(span, textNode, 3)).toBe(3)
  })

  it('counts text across nested children', () => {
    // <span> <span class="marker">**</span> <span>text</span> </span>
    const outer = document.createElement('span')
    const marker = document.createElement('span')
    marker.textContent = '**'
    const content = document.createElement('span')
    content.textContent = 'text'
    outer.appendChild(marker)
    outer.appendChild(content)

    // Cursor at offset 2 into content span's text → should be 4 (2 marker + 2)
    const contentTextNode = content.firstChild!
    expect(countTextUpTo(outer, contentTextNode, 2)).toBe(4)
  })
})

// ─── Round-trip: setCursorPosition → getCursorOffset ───────────────

describe('cursor round-trip', () => {
  const cases: Array<[string, number]> = [
    ['Hello world', 0],
    ['Hello world', 5],
    ['Hello world', 11],
    ['**bold**', 0],        // before first marker
    ['**bold**', 2],        // inside bold content (after **)
    ['**bold**', 6],        // just before final markers
    ['**bold**', 8],        // at end
    ['Hello\nworld', 5],    // before newline
    ['Hello\nworld', 6],    // after newline
    ['# Header', 2],        // inside header content
    ['a **b** c', 5],       // inside bold content
  ]

  for (const [content, pos] of cases) {
    it(`round-trips pos=${pos} in "${content.replace(/\n/g, '\\n')}"`, () => {
      const div = makeContainer(content)
      const result = getCursorOffset(div, placeAt(div, pos))
      expect(result).toBe(pos)
      cleanup(div)
    })
  }
})

// ─── Consecutive round-trips (simulate typing) ─────────────────────

describe('consecutive cursor positions', () => {
  it('correctly returns every position 0..n for plain text', () => {
    const content = 'abc'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      const result = getCursorOffset(div, placeAt(div, p))
      expect(result).toBe(p)
    }
    cleanup(div)
  })

  it('correctly returns every position 0..n for bold text', () => {
    const content = '**ab**'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      const result = getCursorOffset(div, placeAt(div, p))
      expect(result).toBe(p)
    }
    cleanup(div)
  })

  it('correctly returns every position 0..n for mixed content', () => {
    const content = 'Hi **bold** end'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      const result = getCursorOffset(div, placeAt(div, p))
      expect(result).toBe(p)
    }
    cleanup(div)
  })
})

// ─── updateTokenVisibility ──────────────────────────────────────────

describe('updateTokenVisibility', () => {
  it('marks the token under cursor as source, others as rendered (seamless)', () => {
    const content = 'plain **bold** end'
    const div = makeContainer(content)

    // Cursor inside bold token: source positions 6–13 ("**bold**")
    updateTokenVisibility(div, 8)

    const bold = div.querySelector('.token-bold')!
    expect(bold.classList.contains('source')).toBe(true)
    expect(bold.classList.contains('rendered')).toBe(false)

    // Plain text tokens should be rendered
    const plainTokens = div.querySelectorAll('.token-text')
    plainTokens.forEach(t => {
      expect(t.classList.contains('rendered')).toBe(true)
    })

    cleanup(div)
  })

  it('forces all tokens to source in markdown mode', () => {
    const content = '**bold** *italic*'
    const div = makeContainer(content)

    updateTokenVisibility(div, 0, 'markdown')

    div.querySelectorAll('[data-start]').forEach(el => {
      expect(el.classList.contains('source')).toBe(true)
    })

    cleanup(div)
  })

  it('forces all tokens to rendered in preview mode', () => {
    const content = '**bold** *italic*'
    const div = makeContainer(content)

    updateTokenVisibility(div, 0, 'preview')

    div.querySelectorAll('[data-start]').forEach(el => {
      expect(el.classList.contains('rendered')).toBe(true)
    })

    cleanup(div)
  })

  it('moves source marker when cursor moves between tokens', () => {
    const content = '**bold** plain'
    const div = makeContainer(content)

    updateTokenVisibility(div, 3) // inside bold (pos 3 is between the markers)
    expect(div.querySelector('.token-bold')!.classList.contains('source')).toBe(true)

    updateTokenVisibility(div, 12) // inside plain text
    expect(div.querySelector('.token-bold')!.classList.contains('source')).toBe(false)
    expect(div.querySelector('.token-bold')!.classList.contains('rendered')).toBe(true)

    cleanup(div)
  })
})

// ─── getSelectionRange ──────────────────────────────────────────────

describe('getSelectionRange', () => {
  it('returns [pos, pos] for collapsed selection', () => {
    const content = 'Hello world'
    const div = makeContainer(content)

    placeAt(div, 5)
    const [start, end] = getSelectionRange(div, window.getSelection())
    expect(start).toBe(5)
    expect(end).toBe(5)

    cleanup(div)
  })

  it('returns correct [start, end] for a programmatic range selection', () => {
    const content = 'Hello world'
    const div = makeContainer(content)

    // Manually create a selection from pos 2 to pos 7
    const range = document.createRange()
    const textSpan = div.querySelector('[data-start="0"]')!
    const textNode = textSpan.firstChild!
    range.setStart(textNode, 2)
    range.setEnd(textNode, 7)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    const [start, end] = getSelectionRange(div, sel)
    expect(start).toBe(2)
    expect(end).toBe(7)

    cleanup(div)
  })
})

// ─── Inline formatting inside list items and headers ─────────────────

describe('buildStructuredHTML – inline content inside list items', () => {
  it('renders a .token-bold span inside list item .content for **bold**', () => {
    const content = '- Item with **bold** text'
    const div = makeContainer(content)
    const listSpan = div.querySelector('.token-list')!
    expect(listSpan).not.toBeNull()
    const boldSpan = listSpan.querySelector('.token-bold')
    expect(boldSpan).not.toBeNull()
    cleanup(div)
  })

  it('renders a .token-italic span inside list item .content for *italic*', () => {
    const content = '- Item with *italic* text'
    const div = makeContainer(content)
    const italicSpan = div.querySelector('.token-list .token-italic')
    expect(italicSpan).not.toBeNull()
    cleanup(div)
  })

  it('renders a .token-code span inside list item .content for `code`', () => {
    const content = '- Item with `code` here'
    const div = makeContainer(content)
    expect(div.querySelector('.token-list .token-code')).not.toBeNull()
    cleanup(div)
  })

  it('renders a .token-strikethrough span inside list item .content for ~~strike~~', () => {
    const content = '- Item with ~~strike~~ here'
    const div = makeContainer(content)
    expect(div.querySelector('.token-list .token-strikethrough')).not.toBeNull()
    cleanup(div)
  })

  it('renders both bold and italic inside the same list item', () => {
    // The exact case from the bug report
    const content = '- Second list item with **bold** and *italic*'
    const div = makeContainer(content)
    const list = div.querySelector('.token-list')!
    expect(list.querySelector('.token-bold')).not.toBeNull()
    expect(list.querySelector('.token-italic')).not.toBeNull()
    cleanup(div)
  })

  it('nested inline spans do NOT have data-start (so findTokenSpan walks up to the list item)', () => {
    const content = '- Item with **bold** text'
    const div = makeContainer(content)
    const boldSpan = div.querySelector('.token-list .token-bold')!
    expect(boldSpan.hasAttribute('data-start')).toBe(false)
    cleanup(div)
  })

  it('the outer list item preserves correct data-start / data-end covering the full line', () => {
    const content = '- Item with **bold** text'
    const div = makeContainer(content)
    const list = div.querySelector('.token-list')! as HTMLElement
    expect(parseInt(list.getAttribute('data-start')!)).toBe(0)
    expect(parseInt(list.getAttribute('data-end')!)).toBe(content.length)
    cleanup(div)
  })

  it('bold text inside list item shows marker spans', () => {
    const content = '- **bold**'
    const div = makeContainer(content)
    const markers = div.querySelectorAll('.token-list .token-bold .marker')
    expect(markers.length).toBe(2) // opening ** and closing **
    cleanup(div)
  })

  it('inline text between bold and italic is still plain escaped text', () => {
    const content = '- **bold** and *italic*'
    const div = makeContainer(content)
    const list = div.querySelector('.token-list .content')!
    // Should contain " and " as a text node between the two inline spans
    const textNodes = Array.from(list.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
    const allText = textNodes.map(n => n.textContent).join('')
    expect(allText).toContain(' and ')
    cleanup(div)
  })
})

describe('buildStructuredHTML – inline content inside headers', () => {
  it('renders bold inside a header .content span', () => {
    const content = '# Heading with **bold**'
    const div = makeContainer(content)
    expect(div.querySelector('.token-header .token-bold')).not.toBeNull()
    cleanup(div)
  })

  it('renders italic inside a header .content span', () => {
    const content = '## Section *emphasis*'
    const div = makeContainer(content)
    expect(div.querySelector('.token-header .token-italic')).not.toBeNull()
    cleanup(div)
  })

  it('nested inline spans inside header do NOT have data-start', () => {
    const content = '# **bold** header'
    const div = makeContainer(content)
    const boldSpan = div.querySelector('.token-header .token-bold')!
    expect(boldSpan?.hasAttribute('data-start')).toBe(false)
    cleanup(div)
  })
})

describe('buildStructuredHTML – data-indent attribute on list items', () => {
  it('top-level list item has data-indent="0"', () => {
    const div = makeContainer('- top level')
    expect((div.querySelector('.token-list') as HTMLElement).getAttribute('data-indent')).toBe('0')
    cleanup(div)
  })

  it('2-space-indented item has data-indent="1"', () => {
    const div = makeContainer('  - nested item')
    expect((div.querySelector('.token-list') as HTMLElement).getAttribute('data-indent')).toBe('1')
    cleanup(div)
  })

  it('4-space-indented item has data-indent="2"', () => {
    const div = makeContainer('    - deep nested')
    expect((div.querySelector('.token-list') as HTMLElement).getAttribute('data-indent')).toBe('2')
    cleanup(div)
  })

  it('mixed nesting: each item carries its own indent level', () => {
    const content = '- top\n  - nested\n    - deep'
    const div = makeContainer(content)
    const items = Array.from(div.querySelectorAll('.token-list')) as HTMLElement[]
    expect(items[0].getAttribute('data-indent')).toBe('0')
    expect(items[1].getAttribute('data-indent')).toBe('1')
    expect(items[2].getAttribute('data-indent')).toBe('2')
    cleanup(div)
  })

  it('cursor round-trips every position through an indented list item', () => {
    const content = '  - nested **bold** item'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

describe('cursor round-trip through list item with inline content', () => {
  it('round-trips every position in a list item with bold', () => {
    // "- Item **bold** end" – length 19
    const content = '- Item **bold** end'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      const result = getCursorOffset(div, placeAt(div, p))
      expect(result).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in a list item with bold + italic', () => {
    const content = '- **bold** and *italic*'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

// ─── findTokenSpan ──────────────────────────────────────────────────

describe('findTokenSpan', () => {
  it('returns the direct child span when node is the text node inside it', () => {
    const content = 'Hello'
    const div = makeContainer(content)
    const textNode = div.querySelector('[data-start]')!.firstChild!

    const span = findTokenSpan(textNode, div)
    expect(span).not.toBeNull()
    expect(span!.hasAttribute('data-start')).toBe(true)

    cleanup(div)
  })

  it('returns null if node is outside the container', () => {
    const content = 'Hello'
    const div = makeContainer(content)
    const outside = document.createElement('span')
    document.body.appendChild(outside)

    const span = findTokenSpan(outside, div)
    expect(span).toBeNull()

    document.body.removeChild(outside)
    cleanup(div)
  })
})

// ─── Phase 4 token cursor round-trips ──────────────────────────────

describe('cursor round-trip — hr', () => {
  it('round-trips every position in a standalone hr', () => {
    const content = '---'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position when hr is surrounded by text', () => {
    const content = 'before\n---\nafter'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

describe('cursor round-trip — blockquote', () => {
  it('round-trips every position in a simple blockquote', () => {
    const content = '> hello world'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in a multi-line doc with blockquote', () => {
    const content = 'intro\n> quote text\noutro'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('blockquote with inline bold: every position round-trips', () => {
    const content = '> **important** note'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

describe('cursor round-trip — orderedList', () => {
  it('round-trips every position in a single ordered list item', () => {
    const content = '1. first item'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in multiple ordered list items', () => {
    const content = '1. alpha\n2. beta\n3. gamma'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('ordered list with inline formatting: every position round-trips', () => {
    const content = '1. **bold** start\n2. plain end'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

describe('cursor round-trip — fencedCode', () => {
  it('round-trips every position in a no-language fence', () => {
    const content = '```\nhello\n```'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in a language-tagged fence', () => {
    const content = '```js\nconsole.log(1)\n```'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in a multi-line body fence', () => {
    const content = '```\nline one\nline two\n```'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position when fence is surrounded by text', () => {
    const content = 'before\n```py\nprint(x)\n```\nafter'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('empty fence body round-trips', () => {
    const content = '```\n```'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})

describe('cursor round-trip — link', () => {
  it('round-trips every position in a standalone link', () => {
    const content = '[click here](https://example.com)'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in text with an embedded link', () => {
    const content = 'Go to [home](/) now'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })

  it('round-trips every position in link followed by bold', () => {
    const content = '[a](b) **bold**'
    const div = makeContainer(content)
    for (let p = 0; p <= content.length; p++) {
      expect(getCursorOffset(div, placeAt(div, p))).toBe(p)
    }
    cleanup(div)
  })
})
