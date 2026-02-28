/**
 * Seamless Markdown Renderer
 * Parses markdown into tokens with position info, then renders based on cursor location
 */

import { escapeHtml, isDangerousUrl } from '@/utils/sanitize'

export type RenderMode = 'markdown' | 'seamless' | 'preview'

export interface Token {
  type: 'text' | 'header' | 'bold' | 'italic' | 'code' | 'strikethrough' | 'listItem'
      | 'fencedCode' | 'orderedList' | 'blockquote' | 'hr' | 'link' | 'image' | 'table'
  start: number
  end: number
  level?: number   // for headers (1-6) and blockquotes (nesting depth)
  indent?: number  // for list items: 0 = top-level, 1+ = nested (2 spaces per level)
  order?: number   // for orderedList: the numeric counter (1, 2, 3 …)
  language?: string // for fencedCode: language tag after the opening ```
  url?: string     // for link: the href in [text](url)
  dimW?: string    // for image: parsed width from alt suffix (e.g. "300" or "50%")
  dimH?: string    // for image: parsed height from alt suffix
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

    // Check for fenced code block (```lang …  ```) — allow leading whitespace
    const fenceMatch = stripped.match(/^(\s*)```(\w*)$/)
    if (fenceMatch) {
      const fenceIndent = fenceMatch[1]
      const language = fenceMatch[2] || ''
      const fenceStart = lineStartPos
      // pos tracks char position as we consume body lines
      let pos = lineStartPos + line.length + 1 // after opening line's \n
      const bodyLines: string[] = []
      let closingLineEnd = -1

      lineIdx++
      while (lineIdx < lines.length) {
        const nextLine = lines[lineIdx]
        const nextStripped = nextLine.endsWith('\r') ? nextLine.slice(0, -1) : nextLine
        // Closing fence must be at same (or less) indentation
        if (nextStripped.trim() === '```' && (nextStripped.match(/^\s*/)?.[0] ?? '').length <= fenceIndent.length) {
          closingLineEnd = pos + nextLine.length
          lineIdx++ // consumed; compensated below before continue
          break
        }
        // Strip the fence indent from body lines so the code is not over-indented
        const stripped_body = fenceIndent && nextStripped.startsWith(fenceIndent)
          ? nextStripped.slice(fenceIndent.length)
          : nextStripped
        bodyLines.push(stripped_body)
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

      // Check for image (![alt](url)) — must precede link check since '![' starts with '!'
      // Alt may contain optional dimension suffix: "alt|w300", "alt|h200", "alt|w300 h200", "alt|w50%"
      const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
      if (imgMatch) {
        const rawAlt = imgMatch[1]
        // Strip any surrounding quotes the author added around the path
        const src    = imgMatch[2].trim().replace(/^["']|["']$/g, '')
        const { cleanAlt, dimW, dimH } = parseImgDims(rawAlt)
        const start  = currentLineStart + col
        const end    = start + imgMatch[0].length
        tokens.push({
          type: 'image',
          url: src,
          start,
          end,
          content: imgMatch[0],
          text: rawAlt,   // keep raw alt (with dims) as text so source display is unchanged
          rendered: renderImageHtml(src, cleanAlt, dimW, dimH),
          dimW,
          dimH,
        })
        col += imgMatch[0].length
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
 * Render preview HTML with proper list grouping.
 *
 * Without grouping each list item creates its own `<ol>` / `<ul>`, which
 * restarts numbering and prevents proper nesting.  This helper walks the
 * token array and emits opening/closing list tags when the indent level
 * changes, producing valid nested HTML lists.
 */
export function renderPreview(tokens: Token[], content?: string): string {
  const parts: string[] = []
  /** Stack of open list tags: { tag: 'ul'|'ol', indent } */
  const listStack: Array<{ tag: 'ul' | 'ol'; indent: number }> = []

  /** Compute 0-based source line number for a token (for scroll-sync). */
  function sourceLine(token: Token): number {
    if (!content) return -1
    return content.slice(0, token.start).split('\n').length - 1
  }

  /** Inject data-source-line into the first opening HTML tag of a string. */
  function withSL(html: string, token: Token): string {
    if (!content) return html
    const line = sourceLine(token)
    return html.replace(/^(<[a-zA-Z][a-zA-Z0-9]*)([\s>])/, `$1 data-source-line="${line}"$2`)
  }

  function closeListsTo(targetIndent: number): void {
    while (listStack.length > 0 && listStack[listStack.length - 1].indent >= targetIndent) {
      const top = listStack.pop()!
      parts.push(`</${top.tag}>`)
    }
  }

  function closeAllLists(): void {
    while (listStack.length > 0) {
      const top = listStack.pop()!
      parts.push(`</${top.tag}>`)
    }
  }

  /** Inline token types that should flow together inside a single <p>. */
  const INLINE_TYPES = new Set<Token['type']>([
    'text', 'bold', 'italic', 'code', 'strikethrough', 'link', 'image',
  ])

  /** Buffer of consecutive inline token HTML fragments to be flushed into one <p>. */
  let inlineBuf: string[] = []
  /** First inline token in the current buffer (for source-line annotation). */
  let inlineAnchor: Token | null = null

  function flushInline(): void {
    if (inlineBuf.length === 0) return
    parts.push(withSL(`<p>${inlineBuf.join('')}</p>`, inlineAnchor!))
    inlineBuf = []
    inlineAnchor = null
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const isList = token.type === 'listItem' || token.type === 'orderedList'

    if (!isList) {
      if (listStack.length > 0) {
        // Determine whether the list resumes after this (and possibly subsequent)
        // non-list tokens.  Look ahead past whitespace-only text AND block-level
        // tokens (fenced code, blockquotes, etc.) which can be embedded in a
        // list without breaking numbering.
        let probe = i
        while (probe < tokens.length) {
          const t = tokens[probe]
          if (t.type === 'listItem' || t.type === 'orderedList') break
          if (t.type === 'text' && /^\s*$/.test(t.content)) { probe++; continue }
          if (!INLINE_TYPES.has(t.type)) { probe++; continue } // block token
          break // non-whitespace inline content → list is broken
        }
        const listContinues = probe < tokens.length &&
          (tokens[probe].type === 'listItem' || tokens[probe].type === 'orderedList')

        if (listContinues) {
          // Whitespace between list items: skip entirely
          if (token.type === 'text' && /^\s*$/.test(token.content)) continue
          // Block-level token (fenced code, etc.): emit inside the list
          flushInline()
          parts.push(withSL(token.rendered, token))
          continue
        }
      }

      // Close any open lists before a non-list token
      closeAllLists()

      // Inline tokens (text, bold, italic, …) are buffered and flushed into
      // a single <p> so they stay on the same line.
      if (INLINE_TYPES.has(token.type)) {
        // Whitespace-only text tokens act as paragraph separators when they
        // contain a blank line (\n\n), otherwise they're inline spacing.
        if (token.type === 'text' && /^\s*$/.test(token.content)) {
          if (token.content.includes('\n\n')) {
            flushInline() // paragraph break
          } else if (inlineBuf.length > 0) {
            inlineBuf.push(' ') // single-newline → space
          }
          continue
        }
        if (!inlineAnchor) inlineAnchor = token
        inlineBuf.push(token.rendered)
      } else {
        // Block-level token (header, hr, blockquote, fencedCode, table)
        flushInline()
        parts.push(withSL(token.rendered, token))
      }
      continue
    }

    // Flush any buffered inline content before starting list processing
    flushInline()

    const indent = token.indent ?? 0
    const tag: 'ul' | 'ol' = token.type === 'orderedList' ? 'ol' : 'ul'

    if (listStack.length === 0) {
      // Start a new top-level list
      const startAttr = tag === 'ol' && token.order != null ? ` start="${token.order}"` : ''
      parts.push(`<${tag}${startAttr}>`)
      listStack.push({ tag, indent })
    } else {
      const top = listStack[listStack.length - 1]

      if (indent > top.indent) {
        // Nest deeper — open a new sub-list
        const startAttr = tag === 'ol' && token.order != null ? ` start="${token.order}"` : ''
        parts.push(`<${tag}${startAttr}>`)
        listStack.push({ tag, indent })
      } else if (indent < top.indent) {
        // Unindent — close lists down to this level
        closeListsTo(indent + 1)

        // Check if we need to switch list type at this level
        const newTop = listStack.length > 0 ? listStack[listStack.length - 1] : null
        if (!newTop || newTop.indent < indent || newTop.tag !== tag) {
          // Close the mismatched list and open a correct one
          if (newTop && newTop.indent === indent && newTop.tag !== tag) {
            listStack.pop()
            parts.push(`</${newTop.tag}>`)
          }
          const startAttr = tag === 'ol' && token.order != null ? ` start="${token.order}"` : ''
          parts.push(`<${tag}${startAttr}>`)
          listStack.push({ tag, indent })
        }
      } else if (top.tag !== tag) {
        // Same indent but switching list type (ul → ol or vice versa)
        listStack.pop()
        parts.push(`</${top.tag}>`)
        const startAttr = tag === 'ol' && token.order != null ? ` start="${token.order}"` : ''
        parts.push(`<${tag}${startAttr}>`)
        listStack.push({ tag, indent })
      }
    }

    // Emit the <li> — extract inner HTML from the token's pre-wrapped rendered
    // The token.rendered already has inline formatting applied via renderInlineHtml
    const liContent = token.rendered
      .replace(/^<[ou]l[^>]*><li>/, '')
      .replace(/<\/li><\/[ou]l>$/, '')
    const line = sourceLine(token)
    const slAttr = content ? ` data-source-line="${line}"` : ''
    parts.push(`<li${slAttr}>${liContent}</li>`)
  }

  flushInline()
  closeAllLists()
  return parts.join('')
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
    // Full preview — group consecutive list items into proper <ul>/<ol> nesting
    return renderPreview(tokens)
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


/**
 * Parse the optional dimension suffix from an image alt string.
 * Syntax: alt text, optionally followed by |w300, |h200, |w300 h200, |w50%, etc.
 * e.g. "My photo|w480"    → { cleanAlt: 'My photo', dimW: '480' }
 *      "Cover|w300 h200" → { cleanAlt: 'Cover', dimW: '300', dimH: '200' }
 *      "Banner|w50%"     → { cleanAlt: 'Banner', dimW: '50%' }
 */
export function parseImgDims(rawAlt: string): { cleanAlt: string; dimW?: string; dimH?: string } {
  const barIdx = rawAlt.indexOf('|')
  if (barIdx < 0) return { cleanAlt: rawAlt }
  const cleanAlt = rawAlt.slice(0, barIdx).trim()
  const dimStr   = rawAlt.slice(barIdx + 1)
  const wm = dimStr.match(/\bw(\d+%?)/i)
  const hm = dimStr.match(/\bh(\d+%?)/i)
  return { cleanAlt, dimW: wm ? wm[1] : undefined, dimH: hm ? hm[1] : undefined }
}

/**
 * Build the HTML size attribute(s) string for an <img> element.
 * Pixel values → `width`/`height` HTML attributes (matches CSS `[width]` selector).
 * Percentage values → inline `style` attribute.
 * When both W and H are given, use style so exact H overrides CSS `height:auto`.
 */
export function imgSizeAttr(dimW?: string, dimH?: string): string {
  if (!dimW && !dimH) return ''
  if (dimW && dimH) {
    const wVal = dimW.endsWith('%') ? dimW : `${dimW}px`
    const hVal = dimH.endsWith('%') ? dimH : `${dimH}px`
    return ` style="width:${wVal};height:${hVal}"`
  }
  if (dimW) return dimW.endsWith('%') ? ` style="width:${dimW}"` : ` width="${dimW}"`
  // H-only: must use style attribute; CSS `height:auto` rules override HTML height attr
  return dimH!.endsWith('%') ? ` style="height:${dimH}"` : ` style="height:${dimH}px"`
}

/**
 * Render an image src as an <img> tag.
 * - Remote URLs (http/https): rendered directly with src.
 * - Local paths: src is left empty; data-local-src carries the original path so
 *   resolveLocalImages() in the Vue component can swap in a data URL after mount.
 * Optional width/height are emitted via imgSizeAttr.
 */
function renderImageHtml(src: string, alt: string, dimW?: string, dimH?: string): string {
  const sizeAttr = imgSizeAttr(dimW, dimH)
  const titleAttr = alt ? ` title="${escapeHtml(alt)}"` : ''
  if (/^https?:\/\//i.test(src)) {
    return `<img class="md-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy"${sizeAttr}>`
  }
  return `<img class="md-image md-image-local" data-local-src="${escapeHtml(src)}" src="" alt="${escapeHtml(alt)}"${titleAttr}${sizeAttr}>`
}

/**
 * Render inline markdown formatting into clean HTML tags.
 * Used for block-level token.rendered values (headers, list items, blockquotes)
 * so that bold/italic/etc. work correctly in preview mode.
 */
function renderInlineHtml(text: string): string {
  // Order matters: images before links (![), ** before *, ~~ before general text
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\)|\*\*.*?\*\*|~~.*?~~|\*.*?\*|`.*?`|\[[^\]]+\]\([^)]+\))/)
  return parts.map(part => {
    const img = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (img) {
      const src = img[2].trim().replace(/^["']|["']$/g, '')
      const { cleanAlt, dimW, dimH } = parseImgDims(img[1])
      return renderImageHtml(src, cleanAlt, dimW, dimH)
    }
    const bold = part.match(/^\*\*(.*)\*\*$/)
    if (bold) return `<strong>${escapeHtml(bold[1])}</strong>`
    const strike = part.match(/^~~(.*)~~$/)
    if (strike) return `<del>${escapeHtml(strike[1])}</del>`
    const italic = part.match(/^\*(.*)\*$/)
    if (italic) return `<em>${escapeHtml(italic[1])}</em>`
    const code = part.match(/^`(.*)`$/)
    if (code) return `<code>${escapeHtml(code[1])}</code>`
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const href = isDangerousUrl(link[2]) ? '' : escapeHtml(link[2])
      return `<a href="${href}">${escapeHtml(link[1])}</a>`
    }
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
