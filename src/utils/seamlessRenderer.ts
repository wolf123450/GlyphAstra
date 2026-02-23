/**
 * Seamless Markdown Renderer
 * Parses markdown into tokens with position info, then renders based on cursor location
 */

export type RenderMode = 'markdown' | 'seamless' | 'preview'

export interface Token {
  type: 'text' | 'header' | 'bold' | 'italic' | 'code' | 'strikethrough' | 'listItem'
      | 'fencedCode' | 'orderedList' | 'blockquote' | 'hr' | 'link' | 'table'
  start: number
  end: number
  level?: number   // for headers (1-6) and blockquotes (nesting depth)
  indent?: number  // for list items: 0 = top-level, 1+ = nested (2 spaces per level)
  order?: number   // for orderedList: the numeric counter (1, 2, 3 …)
  language?: string // for fencedCode: language tag after the opening ```
  url?: string     // for link: the href in [text](url)
  content: string  // raw content including markers
  rendered: string // HTML rendering
  text: string     // plain text for cursor positioning
  isMarkdownSyntax?: boolean // true for markers like **, #, etc
}

/**
 * Parse markdown content into tokens with source positions
 */
export function tokenizeMarkdown(content: string): Token[] {
  const tokens: Token[] = []

  const lines = content.split('\n')
  let lineStartPos = 0

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    // Strip trailing \r so that regex anchors (especially $) match correctly
    // on CRLF content from the Windows clipboard. Use the original line.length
    // for position tracking so source offsets remain accurate.
    const stripped = line.endsWith('\r') ? line.slice(0, -1) : line

    // Check for headers at start of line
    const headerMatch = stripped.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      const level = headerMatch[1].length
      const text = headerMatch[2]
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'header',
        level,
        start,
        end,
        content: line,
        text: text,
        rendered: `<h${level}>${renderInlineHtml(text)}</h${level}>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for list items (support leading whitespace for indented bullets)
    const listMatch = stripped.match(/^(\s*)([-*])\s+(.*)$/)
    if (listMatch) {
      const text = listMatch[3]
      const indent = Math.floor(listMatch[1].length / 2)
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'listItem',
        indent,
        start,
        end,
        content: line,
        text: text,
        rendered: `<ul><li>${renderInlineHtml(text)}</li></ul>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for horizontal rule (--- / *** / ___)
    const hrMatch = stripped.match(/^(---+|\*\*\*+|___+)\s*$/)
    if (hrMatch) {
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'hr',
        start,
        end,
        content: line,
        text: '',
        rendered: '<hr>',
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for blockquote (> text, supports nested >>)
    const bqMatch = stripped.match(/^(>+)\s?(.*)$/)
    if (bqMatch) {
      const level = bqMatch[1].length
      const text = bqMatch[2]
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'blockquote',
        level,
        start,
        end,
        content: line,
        text: text,
        rendered: `<blockquote>${renderInlineHtml(text)}</blockquote>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for ordered list (1. item, 2. item …)
    const olMatch = stripped.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (olMatch) {
      const text = olMatch[3]
      const order = parseInt(olMatch[2], 10)
      const indent = Math.floor(olMatch[1].length / 2)
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'orderedList',
        order,
        indent,
        start,
        end,
        content: line,
        text: text,
        rendered: `<ol start="${order}"><li>${renderInlineHtml(text)}</li></ol>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for table (line starts with | and next line is a separator |---|)
    if (stripped.startsWith('|') && lineIdx + 1 < lines.length) {
      const sepRaw = lines[lineIdx + 1]
      const sepStripped = sepRaw.endsWith('\r') ? sepRaw.slice(0, -1) : sepRaw
      if (/^\|[-| :]+\|/.test(sepStripped)) {
        const headerCols = parseTableRow(stripped)
        const tableStart = lineStartPos

        // pos advances past each consumed line (length + 1 for \n)
        let pos = lineStartPos + line.length + 1  // past header → start of separator

        lineIdx++  // consume separator line
        pos += lines[lineIdx].length + 1  // past separator → start of first data line

        const dataRows: string[][] = []
        while (lineIdx + 1 < lines.length) {
          const nxtRaw = lines[lineIdx + 1]
          const nxtStripped = nxtRaw.endsWith('\r') ? nxtRaw.slice(0, -1) : nxtRaw
          if (!nxtStripped.startsWith('|')) break
          lineIdx++
          dataRows.push(parseTableRow(nxtStripped))
          pos += lines[lineIdx].length + 1
        }

        // pos is now start of first non-table line; tableEnd uses same convention
        // as single-line tokens (position of the \n of the last consumed line)
        const tableEnd = pos - 1
        lineStartPos = pos

        const headerHtml = `<tr>${headerCols.map(c => `<th>${renderInlineHtml(c.trim())}</th>`).join('')}</tr>`
        const bodyHtml = dataRows.length > 0
          ? `<tbody>${dataRows.map(row =>
              `<tr>${row.map(c => `<td>${renderInlineHtml(c.trim())}</td>`).join('')}</tr>`
            ).join('')}</tbody>`
          : ''

        tokens.push({
          type: 'table',
          start: tableStart,
          end: tableEnd,
          content: content.substring(tableStart, tableEnd),
          text: '',
          rendered: `<table><thead>${headerHtml}</thead>${bodyHtml}</table>`,
        })
        continue
      }
    }

    // Check for fenced code block (```lang …  ```)
    const fenceMatch = stripped.match(/^```(\w*)$/)
    if (fenceMatch) {
      const language = fenceMatch[1] || ''
      const fenceStart = lineStartPos
      // pos tracks char position as we consume body lines
      let pos = lineStartPos + line.length + 1 // after opening line's \n
      const bodyLines: string[] = []
      let closingLineEnd = -1

      lineIdx++
      while (lineIdx < lines.length) {
        const nextLine = lines[lineIdx]
        const nextStripped = nextLine.endsWith('\r') ? nextLine.slice(0, -1) : nextLine
        if (nextStripped === '```') {
          closingLineEnd = pos + nextLine.length
          lineIdx++ // consumed; compensated below before continue
          break
        }
        bodyLines.push(nextStripped)
        pos += nextLine.length + 1
        lineIdx++
      }

      // The for-loop will do lineIdx++ after continue, so pull back by 1
      lineIdx--

      const fenceEnd = closingLineEnd >= 0 ? closingLineEnd : pos - 1
      lineStartPos = fenceEnd + 1 // start of next line after closing ```

      const bodyText = bodyLines.join('\n')
      const rawContent = content.substring(fenceStart, fenceEnd)

      tokens.push({
        type: 'fencedCode',
        language,
        start: fenceStart,
        end: fenceEnd,
        content: rawContent,
        text: bodyText,
        rendered: `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(bodyText)}</code></pre>`,
      })

      continue
    }

    // Parse inline formatting within the line (use stripped to avoid \r mismatches)
    let col = 0
    let currentLineStart = lineStartPos

    while (col < stripped.length) {
      // Try to match patterns at current position
      const remaining = stripped.substring(col)

      // Check for escape character (\* \_ \~ \` \[ \] \\ \# \| etc.)
      const escMatch = remaining.match(/^\\([*_~`[\]\\#|>!])/)
      if (escMatch) {
        const start = currentLineStart + col
        const end = start + 2  // backslash + the escaped character
        tokens.push({
          type: 'text',
          start,
          end,
          content: escMatch[0],
          text: escMatch[1],
          rendered: escapeHtml(escMatch[1]),
        })
        col += 2
        continue
      }

      // Check for inline link ([text](url))
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        const linkText = linkMatch[1]
        const url = linkMatch[2]
        const start = currentLineStart + col
        const end = start + linkMatch[0].length

        tokens.push({
          type: 'link',
          url,
          start,
          end,
          content: linkMatch[0],
          text: linkText,
          rendered: `<a href="${escapeHtml(url)}">${escapeHtml(linkText)}</a>`,
        })

        col += linkMatch[0].length
        continue
      }

      // Check for bold (**text**)
      const boldMatch = remaining.match(/^\*\*(.*?)\*\*/)
      if (boldMatch) {
        const innerText = boldMatch[1]
        const start = currentLineStart + col
        const end = start + boldMatch[0].length

        tokens.push({
          type: 'bold',
          start,
          end,
          content: boldMatch[0],
          text: innerText,
          rendered: `<strong>${escapeHtml(innerText)}</strong>`,
        })

        col += boldMatch[0].length
        continue
      }

      // Check for italic (*text*)
      const italicMatch = remaining.match(/^\*(.*?)\*/)
      if (italicMatch) {
        const innerText = italicMatch[1]
        const start = currentLineStart + col
        const end = start + italicMatch[0].length

        tokens.push({
          type: 'italic',
          start,
          end,
          content: italicMatch[0],
          text: innerText,
          rendered: `<em>${escapeHtml(innerText)}</em>`,
        })

        col += italicMatch[0].length
        continue
      }

      // Check for strikethrough (~~text~~)
      const strikeMatch = remaining.match(/^~~(.*?)~~/)
      if (strikeMatch) {
        const innerText = strikeMatch[1]
        const start = currentLineStart + col
        const end = start + strikeMatch[0].length

        tokens.push({
          type: 'strikethrough',
          start,
          end,
          content: strikeMatch[0],
          text: innerText,
          rendered: `<del>${escapeHtml(innerText)}</del>`,
        })

        col += strikeMatch[0].length
        continue
      }

      // Check for inline code (`text`)
      const codeMatch = remaining.match(/^`(.*?)`/)
      if (codeMatch) {
        const innerText = codeMatch[1]
        const start = currentLineStart + col
        const end = start + codeMatch[0].length

        tokens.push({
          type: 'code',
          start,
          end,
          content: codeMatch[0],
          text: innerText,
          rendered: `<code>${escapeHtml(innerText)}</code>`,
        })

        col += codeMatch[0].length
        continue
      }

      // Regular text character
      col++
    }

    lineStartPos += line.length + 1
  }

  // Merge adjacent text tokens and generate plain text layer
  return mergeAndValidateTokens(tokens, content)
}

/**
 * Merge consecutive text portions and validate token structure
 */
function mergeAndValidateTokens(tokens: Token[], content: string): Token[] {
  const result: Token[] = []
  let lastEnd = 0

  for (const token of tokens) {
    // Add text token for any gap
    if (token.start > lastEnd) {
      const textContent = content.substring(lastEnd, token.start)
      result.push({
        type: 'text',
        start: lastEnd,
        end: token.start,
        content: textContent,
        text: textContent,
        rendered: escapeHtml(textContent),
      })
    }

    result.push(token)
    lastEnd = token.end
  }

  // Add trailing text
  if (lastEnd < content.length) {
    const textContent = content.substring(lastEnd)
    result.push({
      type: 'text',
      start: lastEnd,
      end: content.length,
      content: textContent,
      text: textContent,
      rendered: escapeHtml(textContent),
    })
  }

  return result
}

/**
 * Render tokens as HTML with cursor-aware formatting
 */
export function renderTokens(
  tokens: Token[],
  content: string,
  cursorPos: number,
  mode: 'markdown' | 'seamless' | 'preview'
): string {
  if (mode === 'markdown') {
    // Show all raw content
    return escapeHtml(content)
  }

  if (mode === 'preview') {
    // Full preview - render all tokens as HTML
    return tokens.map((token) => token.rendered).join('')
  }

  // Seamless mode: render tokens, showing source for tokens near cursor
  return tokens
    .map((token) => {
      // Check if cursor is within this token
      const isCursorInToken = cursorPos >= token.start && cursorPos <= token.end

      if (token.type === 'text') {
        // Regular text always shows as text
        return token.rendered
      }

      if (isCursorInToken) {
        // Show source when cursor is in token
        return `<span class="markdown-source">${escapeHtml(token.content)}</span>`
      }

      // Show rendered version
      return token.rendered
    })
    .join('')
}

/**
 * Get word boundaries around cursor position in source text
 */
export function getWordBoundariesInSource(content: string, cursorPos: number): { start: number; end: number } {
  const beforeCursor = content.substring(0, cursorPos)
  const afterCursor = content.substring(cursorPos)

  // Find word start (look back for whitespace)
  let wordStart = cursorPos
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    if (/\s/.test(beforeCursor[i])) {
      wordStart = i + 1
      break
    }
    if (i === 0) {
      wordStart = 0
    }
  }

  // Find word end (look forward for whitespace)
  let wordEnd = cursorPos
  for (let i = 0; i < afterCursor.length; i++) {
    if (/\s/.test(afterCursor[i])) {
      wordEnd = cursorPos + i
      break
    }
    if (i === afterCursor.length - 1) {
      wordEnd = content.length
    }
  }

  return { start: wordStart, end: wordEnd }
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Render inline markdown formatting into clean HTML tags.
 * Used for block-level token.rendered values (headers, list items, blockquotes)
 * so that bold/italic/etc. work correctly in preview mode.
 */
function renderInlineHtml(text: string): string {
  // Order matters: ** before *, ~~ before general text
  const parts = text.split(/(\*\*.*?\*\*|~~.*?~~|\*.*?\*|`.*?`|\[[^\]]+\]\([^)]+\))/)
  return parts.map(part => {
    const bold = part.match(/^\*\*(.*)\*\*$/)
    if (bold) return `<strong>${escapeHtml(bold[1])}</strong>`
    const strike = part.match(/^~~(.*)~~$/)
    if (strike) return `<del>${escapeHtml(strike[1])}</del>`
    const italic = part.match(/^\*(.*)\*$/)
    if (italic) return `<em>${escapeHtml(italic[1])}</em>`
    const code = part.match(/^`(.*)`$/)
    if (code) return `<code>${escapeHtml(code[1])}</code>`
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return `<a href="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`
    return escapeHtml(part)
  }).join('')
}

/**
 * Split a markdown table row by | and return trimmed cell strings.
 * e.g. "| A | B |" → ["A", "B"]
 */
function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  // Remove leading/trailing |
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed
  const cells = inner.split('|')
  // Drop trailing empty cell if row ends with |
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop()
  return cells
}
