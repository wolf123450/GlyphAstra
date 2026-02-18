/**
 * Tests that reproduce the bugs visible in pasted.html when test.md
 * (which has CRLF line-endings) is pasted into the editor.
 *
 * Root-cause: JavaScript's `$` in a non-multiline regex cannot match when
 * the string ends with `\r`.  Every line from `content.split('\n')` retains
 * a trailing `\r`, so the header and listItem regexes in tokenizeMarkdown()
 * silently fall through to the character-by-character inline parser.
 *
 * Consequences observed in the attached HTML snapshot:
 *   1. Headers (#, ##, ###) become plain text tokens instead of header tokens.
 *   2. List items that precede inline-formatted tokens lose their listItem type.
 *   3. A list item whose line contains inline formatting (e.g. **bold**) has
 *      its list prefix merged into a surrounding text token – the structure of
 *      the line is wrong.
 *   4. The LAST line of a CRLF file is the sole exception (no trailing \r)
 *      which is why "- With markdown features" WAS correctly tokenised.
 */

import { describe, it, expect } from 'vitest'
import { tokenizeMarkdown } from '../utils/seamlessRenderer'
import type { Token } from '../utils/seamlessRenderer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert LF content to CRLF the same way the Windows clipboard does. */
function toCRLF(s: string): string {
  return s.replace(/\r?\n/g, '\r\n')
}

function tokenOfType(tokens: Token[], type: string) {
  return tokens.find(t => t.type === type)
}

function allOfType(tokens: Token[], type: string) {
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

// ─── Bug 1: Headers swallowed by text tokens on CRLF input ────────────────────

describe('Bug 1 – headers not tokenised on CRLF content', () => {
  it('h1 produces a header token on LF content', () => {
    const lf = '# Main Heading'
    const tokens = tokenizeMarkdown(lf)
    expect(allOfType(tokens, 'header')).toHaveLength(1)
    expect(tokenOfType(tokens, 'header')!.text).toBe('Main Heading')
  })

  it('h1 produces a header token on CRLF content', () => {
    // BUG: currently returns a text token instead
    const crlf = toCRLF('# Main Heading')
    const tokens = tokenizeMarkdown(crlf)
    expect(allOfType(tokens, 'header')).toHaveLength(1)
    expect(tokenOfType(tokens, 'header')!.text).toContain('Main Heading')
  })

  it('h2 on CRLF is tokenised as a header, not as text', () => {
    const crlf = toCRLF('## Section Heading')
    const tokens = tokenizeMarkdown(crlf)
    expect(allOfType(tokens, 'header')).toHaveLength(1)
    expect(tokenOfType(tokens, 'header')!.level).toBe(2)
  })

  it('h3 on CRLF is tokenised as a header', () => {
    const crlf = toCRLF('### Subsection')
    const tokens = tokenizeMarkdown(crlf)
    expect(allOfType(tokens, 'header')).toHaveLength(1)
    expect(tokenOfType(tokens, 'header')!.level).toBe(3)
  })

  it('multiple headers in CRLF document are all tokenised', () => {
    const crlf = toCRLF('# H1\n\n## H2\n\n### H3')
    const tokens = tokenizeMarkdown(crlf)
    const headers = allOfType(tokens, 'header')
    expect(headers).toHaveLength(3)
    expect(headers[0].level).toBe(1)
    expect(headers[1].level).toBe(2)
    expect(headers[2].level).toBe(3)
  })
})

// ─── Bug 2: List items not tokenised on CRLF content ─────────────────────────

describe('Bug 2 – list items not tokenised on CRLF content', () => {
  it('plain list item produces a listItem token on LF content', () => {
    const lf = '- First list item'
    expect(allOfType(tokenizeMarkdown(lf), 'listItem')).toHaveLength(1)
  })

  it('plain list item produces a listItem token on CRLF content', () => {
    // BUG: currently becomes a text token
    const crlf = toCRLF('- First list item')
    expect(allOfType(tokenizeMarkdown(crlf), 'listItem')).toHaveLength(1)
  })

  it('all interior list items in a CRLF multi-line list are tokenised', () => {
    // Historically only the LAST item was tokenised because it had no trailing \r
    const crlf = toCRLF('- First\n- Second\n- Third')
    const items = allOfType(tokenizeMarkdown(crlf), 'listItem')
    expect(items).toHaveLength(3)
    expect(items[0].text).toBe('First')
    expect(items[1].text).toBe('Second')
    expect(items[2].text).toBe('Third')
  })

  it('the last item in a CRLF list was already tokenised (regression guard)', () => {
    // This was the ONLY item that worked before the fix
    const crlf = toCRLF('- First\n- Last')
    const items = allOfType(tokenizeMarkdown(crlf), 'listItem')
    expect(items[items.length - 1].text).toBe('Last')
  })
})

// ─── Bug 3: List item containing inline formatting loses list structure ───────

describe('Bug 3 – list item with inline formatting loses its listItem type', () => {
  /**
   * "- Second list item with **bold** and *italic*"
   *
   * Expected: ONE listItem token covering the whole line.
   *           Inline formatting *inside* the list line can optionally also be
   *           captured (that is an enhancement); what must NOT happen is that
   *           the list prefix gets merged into a text token while only the
   *           inline parts are individually tokenised.
   *
   * Observed: text("- Second list item with ") + bold(**bold**) +
   *           text(" and ") + italic(*italic*) — the list structure is lost.
   */

  it('list line with bold content is a listItem token, not split up', () => {
    const lf = '- Item with **bold** text'
    const tokens = tokenizeMarkdown(lf)
    const listItems = allOfType(tokens, 'listItem')
    expect(listItems).toHaveLength(1)
    expect(listItems[0].text).toContain('bold')
    // The list prefix must NOT appear as a separate text token
    const textTokensWithDash = tokens.filter(
      t => t.type === 'text' && t.content.startsWith('- ')
    )
    expect(textTokensWithDash).toHaveLength(0)
  })

  it('list line with bold content is a listItem token on CRLF input', () => {
    const crlf = toCRLF('- Item with **bold** text')
    const tokens = tokenizeMarkdown(crlf)
    const listItems = allOfType(tokens, 'listItem')
    expect(listItems).toHaveLength(1)
    expect(listItems[0].text).toContain('bold')
  })

  it('list line with italic content is a listItem token on CRLF input', () => {
    const crlf = toCRLF('- Item with *italic* text')
    const tokens = tokenizeMarkdown(crlf)
    expect(allOfType(tokens, 'listItem')).toHaveLength(1)
  })

  it('multi-item list where one item has inline markup: all are listItem tokens', () => {
    const crlf = toCRLF('- Plain item\n- Item with **bold** and *italic*\n- Another plain')
    const tokens = tokenizeMarkdown(crlf)
    const listItems = allOfType(tokens, 'listItem')
    expect(listItems).toHaveLength(3)
  })
})

// ─── Full document round-trip (mirrors the exact content from test.md) ────────

describe('Full test.md content tokenisation on CRLF', () => {
  // Exact content from the attached test.md, converted to CRLF
  const LF_CONTENT = `# Main Heading

This is a paragraph with some regular text and **bold text** mixed in. You can also use *italic text* for emphasis. And of course ~~strikethrough text~~ works too.

## Section Heading

- First list item
- Second list item with **bold** and *italic*
- Third item

### Subsection

Here's some \`inline code\` in a sentence. You can write more text here.

Another paragraph with multiple styles: **bold**, *italic*, and ~~strikethrough~~ all together.

- Nested concepts
- With markdown features`

  const CRLF_CONTENT = toCRLF(LF_CONTENT)

  it('LF version produces 3 header tokens', () => {
    const tokens = tokenizeMarkdown(LF_CONTENT)
    expect(allOfType(tokens, 'header')).toHaveLength(3)
  })

  it('CRLF version produces 3 header tokens', () => {
    const tokens = tokenizeMarkdown(CRLF_CONTENT)
    expect(allOfType(tokens, 'header')).toHaveLength(3)
  })

  it('LF version produces 5 list item tokens', () => {
    const tokens = tokenizeMarkdown(LF_CONTENT)
    expect(allOfType(tokens, 'listItem')).toHaveLength(5)
  })

  it('CRLF version produces 5 list item tokens', () => {
    const tokens = tokenizeMarkdown(CRLF_CONTENT)
    expect(allOfType(tokens, 'listItem')).toHaveLength(5)
  })

  it('CRLF version token coverage has no gaps', () => {
    const tokens = tokenizeMarkdown(CRLF_CONTENT)
    expect(coversFullContent(tokens, CRLF_CONTENT)).toBe(true)
  })

  it('header at line 1 is at source position 0', () => {
    // Both LF and CRLF: the h1 starts at position 0
    for (const content of [LF_CONTENT, CRLF_CONTENT]) {
      const tokens = tokenizeMarkdown(content)
      const h1 = tokens.find(t => t.type === 'header' && t.level === 1)
      expect(h1).toBeDefined()
      expect(h1!.start).toBe(0)
    }
  })

  it('no header is swallowed inside a text token', () => {
    const tokens = tokenizeMarkdown(CRLF_CONTENT)
    const textTokenContents = allOfType(tokens, 'text').map(t => t.content)
    const headerLike = textTokenContents.filter(c => /^#{1,6} /m.test(c))
    expect(headerLike).toHaveLength(0)
  })

  it('no list prefix is swallowed inside a text token', () => {
    const tokens = tokenizeMarkdown(CRLF_CONTENT)
    const textTokenContents = allOfType(tokens, 'text').map(t => t.content)
    // A text token that starts a line with "- " is a missing list item
    const listLike = textTokenContents.filter(c => /(^|\n)- /.test(c))
    expect(listLike).toHaveLength(0)
  })

  it('CRLF and LF produce structurally equivalent token types in order', () => {
    const lfTokens  = tokenizeMarkdown(LF_CONTENT).map(t => t.type)
    const crlfTokens = tokenizeMarkdown(CRLF_CONTENT).map(t => t.type)
    expect(crlfTokens).toEqual(lfTokens)
  })
})

// ─── The regex-level root cause ───────────────────────────────────────────────

describe('Root cause: JS $ cannot match at end of string ending with \\r', () => {
  it('header regex returns null when line ends with \\r', () => {
    // This is the raw behaviour that drives the bug
    expect(/^(#{1,6})\s+(.*)$/.exec('# Heading\r')).toBeNull()
  })

  it('header regex succeeds after stripping trailing \\r', () => {
    expect(/^(#{1,6})\s+(.*)$/.exec('# Heading\r'.replace(/\r$/, ''))).not.toBeNull()
  })

  it('list regex returns null when line ends with \\r', () => {
    expect(/^([-*])\s+(.*)$/.exec('- item\r')).toBeNull()
  })

  it('list regex succeeds after stripping trailing \\r', () => {
    expect(/^([-*])\s+(.*)$/.exec('- item\r'.replace(/\r$/, ''))).not.toBeNull()
  })
})
