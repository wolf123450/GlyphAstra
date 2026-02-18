/**
 * Seamless Markdown Renderer
 * Parses markdown into tokens with position info, then renders based on cursor location
 */

export type RenderMode = 'markdown' | 'seamless' | 'preview'

export interface Token {
  type: 'text' | 'header' | 'bold' | 'italic' | 'code' | 'strikethrough' | 'listItem'
  start: number
  end: number
  level?: number // for headers
  content: string // raw content including markers
  rendered: string // HTML rendering
  text: string // plain text for cursor positioning
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
        rendered: `<h${level}>${escapeHtml(text)}</h${level}>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Check for list items
    const listMatch = stripped.match(/^([-*])\s+(.*)$/)
    if (listMatch) {
      const text = listMatch[2]
      const start = lineStartPos
      const end = start + line.length

      tokens.push({
        type: 'listItem',
        start,
        end,
        content: line,
        text: text,
        rendered: `<ul><li>${escapeHtml(text)}</li></ul>`,
      })

      lineStartPos += line.length + 1
      continue
    }

    // Parse inline formatting within the line (use stripped to avoid \r mismatches)
    let col = 0
    let currentLineStart = lineStartPos

    while (col < stripped.length) {
      // Try to match patterns at current position
      const remaining = stripped.substring(col)

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
