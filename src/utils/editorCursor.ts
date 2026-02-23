/**
 * Editor cursor utilities — pure functions that take DOM + content as parameters
 * so they can be independently tested.
 */

import type { Token } from './seamlessRenderer'

// ─── HTML building ─────────────────────────────────────────────────

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Render inline markdown formatting (bold, italic, code, strikethrough) within
 * a plain-text string into HTML marker/content spans.
 * Used inside list item and header content so nested formatting is visible
 * in rendered mode while cursor math still counts all marker characters.
 * The returned spans intentionally have NO data-start so findTokenSpan() correctly
 * walks up to the enclosing token span.
 */
export function renderInlineContent(rawText: string): string {
  // Split on bold (**), strikethrough (~~), italic (*), inline code (`), link ([text](url))
  // Bold must precede italic so ** is not consumed as two *.
  const parts = rawText.split(/(\*\*.*?\*\*|~~.*?~~|\*.*?\*|`.*?`|\[[^\]]+\]\([^)]+\))/)
  return parts.map(part => {
    const bold = part.match(/^\*\*(.*?)\*\*$/)
    if (bold) return `<span class="token token-bold rendered"><span class="marker">**</span><span class="content">${esc(bold[1])}</span><span class="marker">**</span></span>`
    const strike = part.match(/^~~(.*?)~~$/)
    if (strike) return `<span class="token token-strikethrough rendered"><span class="marker">~~</span><span class="content">${esc(strike[1])}</span><span class="marker">~~</span></span>`
    const italic = part.match(/^\*(.*?)\*$/)
    if (italic) return `<span class="token token-italic rendered"><span class="marker">*</span><span class="content">${esc(italic[1])}</span><span class="marker">*</span></span>`
    const code = part.match(/^`(.*?)`$/)
    if (code) return `<span class="token token-code rendered"><span class="marker">\`</span><span class="content">${esc(code[1])}</span><span class="marker">\`</span></span>`
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) return `<span class="token token-link rendered"><span class="marker">[</span><span class="content">${esc(link[1])}</span><span class="marker">](${esc(link[2])})</span></span>`
    return esc(part)
  }).join('')
}

/**
 * Build innerHTML for the editor from a token list.
 * Every top-level span gets data-start + data-end referencing the source string.
 */
export function buildStructuredHTML(tokens: Token[], content: string): string {
  let html = ''
  let lastEnd = 0

  for (const token of tokens) {
    // Gap between tokens (includes newlines)
    if (token.start > lastEnd) {
      const gap = content.substring(lastEnd, token.start)
      html += `<span class="token token-text" data-start="${lastEnd}" data-end="${token.start}">${esc(gap)}</span>`
    }

    const inner = esc(token.text)

    if (token.type === 'text') {
      html += `<span class="token token-text" data-start="${token.start}" data-end="${token.end}">${inner}</span>`
    } else if (token.type === 'header') {
      const lvl = token.level || 1
      html += `<span class="token token-header rendered" data-level="${lvl}" data-start="${token.start}" data-end="${token.end}"><span class="marker">${'#'.repeat(lvl)} </span><span class="content">${renderInlineContent(token.text)}</span></span>`
    } else if (token.type === 'bold') {
      html += `<span class="token token-bold rendered" data-start="${token.start}" data-end="${token.end}"><span class="marker">**</span><span class="content">${inner}</span><span class="marker">**</span></span>`
    } else if (token.type === 'italic') {
      html += `<span class="token token-italic rendered" data-start="${token.start}" data-end="${token.end}"><span class="marker">*</span><span class="content">${inner}</span><span class="marker">*</span></span>`
    } else if (token.type === 'strikethrough') {
      html += `<span class="token token-strikethrough rendered" data-start="${token.start}" data-end="${token.end}"><span class="marker">~~</span><span class="content">${inner}</span><span class="marker">~~</span></span>`
    } else if (token.type === 'code') {
      html += `<span class="token token-code rendered" data-start="${token.start}" data-end="${token.end}"><span class="marker">\`</span><span class="content">${inner}</span><span class="marker">\`</span></span>`
    } else if (token.type === 'listItem') {
      const indent = token.indent ?? 0
      // Include the leading spaces in the marker so those source chars exist in
      // the DOM and CursorOffset counting stays accurate.
      const spaces = '  '.repeat(indent)
      html += `<span class="token token-list rendered" data-start="${token.start}" data-end="${token.end}" data-indent="${indent}"><span class="marker">${esc(spaces)}- </span><span class="content">${renderInlineContent(token.text)}</span></span>`
    } else if (token.type === 'hr') {
      html += `<span class="token token-hr rendered" data-start="${token.start}" data-end="${token.end}"><span class="marker">${esc(token.content)}</span></span>`
    } else if (token.type === 'blockquote') {
      const level = token.level ?? 1
      const prefix = '>'.repeat(level) + ' '
      html += `<span class="token token-blockquote rendered" data-start="${token.start}" data-end="${token.end}" data-level="${level}"><span class="marker">${esc(prefix)}</span><span class="content">${renderInlineContent(token.text)}</span></span>`
    } else if (token.type === 'orderedList') {
      const order = token.order ?? 1
      const indent = token.indent ?? 0
      const spaces = '  '.repeat(indent)
      html += `<span class="token token-ordered rendered" data-start="${token.start}" data-end="${token.end}" data-order="${order}" data-indent="${indent}"><span class="marker">${esc(spaces)}${order}. </span><span class="content" data-order="${order}">${renderInlineContent(token.text)}</span></span>`
    } else if (token.type === 'fencedCode') {
      const lang = token.language ?? ''
      // Split raw content into opening fence line, body lines, closing fence line.
      const rawLines = token.content.split('\n')
      const openFence = rawLines[0] ?? ('```' + lang)
      const closeFence = rawLines[rawLines.length - 1] ?? '```'
      const bodyLines = rawLines.slice(1, rawLines.length - 1)
      // ALL source characters must appear as text nodes so countTextUpTo stays
      // accurate. Include the '\n' after the opening fence in its marker span,
      // and append '\n' to the body when it is non-empty (the newline before the
      // closing fence). The lang-label is purely decorative — mark it data-ghost
      // so countTextUpTo skips it.
      const bodyText = bodyLines.length > 0 ? bodyLines.join('\n') + '\n' : ''
      const langLabel = lang ? `<span class="lang-label" data-ghost="true">${esc(lang)}</span>` : ''
      html += `<span class="token token-fenced rendered" data-start="${token.start}" data-end="${token.end}">`
        + `<span class="marker fence-open">${esc(openFence + '\n')}</span>`
        + langLabel
        + `<span class="content"><pre>${esc(bodyText)}</pre></span>`
        + `<span class="marker fence-close">${esc(closeFence)}</span>`
        + `</span>`
    } else if (token.type === 'link') {
      const url = token.url ?? ''
      html += `<span class="token token-link rendered" data-start="${token.start}" data-end="${token.end}" data-url="${esc(url)}"><span class="marker">[</span><span class="content">${esc(token.text)}</span><span class="marker">](${esc(url)})</span></span>`
    } else if (token.type === 'table') {
      // All source characters live in .table-source as text nodes so countTextUpTo
      // can walk through them for accurate cursor positioning.
      // The visual HTML table lives in a data-ghost span so countTextUpTo skips it.
      // CSS in EditorSeamless swaps which one is visible based on rendered/source class.
      const lines = token.content.split('\n')
      const sourceHtml = lines.map(line =>
        line.split('|').map((cell, i, arr) =>
          esc(cell) + (i < arr.length - 1 ? `<span class="marker">|</span>` : '')
        ).join('')
      ).join('\n')
      html += `<span class="token token-table rendered" data-start="${token.start}" data-end="${token.end}"><span class="table-source">${sourceHtml}</span><span class="table-render" data-ghost="true">${token.rendered}</span></span>`
    }

    lastEnd = token.end
  }

  // Trailing content after last token
  if (lastEnd < content.length) {
    const trail = content.substring(lastEnd)
    html += `<span class="token token-text" data-start="${lastEnd}" data-end="${content.length}">${esc(trail)}</span>`
  }

  return html
}

// ─── Cursor helpers ────────────────────────────────────────────────

/**
 * Walk up from a DOM node to find the nearest ancestor span with data-start.
 */
export function findTokenSpan(node: Node | null, container: HTMLElement): HTMLElement | null {
  while (node && node !== container) {
    if (node instanceof HTMLElement && node.hasAttribute('data-start')) return node
    node = node.parentNode
  }
  return null
}

/**
 * Count ALL text characters (including hidden marker text) from the start of
 * `root` to (targetNode, targetOffset). Returns the offset within the span's
 * raw source content.
 * NOTE: elements with data-ghost="true" are skipped — they are inline ghost
 * suggestion overlays and do not represent source document characters.
 */
export function countTextUpTo(root: Node, targetNode: Node, targetOffset: number): number {
  let count = 0
  let found = false

  const walk = (n: Node): boolean => {
    if (found) return true
    // Skip ghost suggestion spans entirely
    if (n instanceof HTMLElement && n.hasAttribute('data-ghost')) return false
    if (n === targetNode) {
      count += targetOffset
      found = true
      return true
    }
    if (n.nodeType === Node.TEXT_NODE) {
      count += n.textContent?.length ?? 0
    } else {
      for (let i = 0; i < n.childNodes.length; i++) {
        if (walk(n.childNodes[i])) return true
      }
    }
    return false
  }

  walk(root)
  return count
}

/**
 * DOM cursor → source position.
 * Returns -1 if the cursor is not inside the container.
 */
export function getCursorOffset(container: HTMLElement, sel: Selection | null): number {
  if (!sel || !sel.anchorNode) return 0

  const span = findTokenSpan(sel.anchorNode, container)
  if (!span) return 0

  const base = parseInt(span.getAttribute('data-start')!)
  return base + countTextUpTo(span, sel.anchorNode, sel.anchorOffset)
}

/**
 * Source position → DOM cursor.
 * Finds the token span whose [data-start..data-end] bracket contains `pos`,
 * then walks ALL text nodes (including markers) to place the Range.
 */
export function setCursorPosition(
  container: HTMLElement,
  contentLength: number,
  pos: number,
  sel: Selection | null
): void {
  if (!sel) return

  pos = Math.max(0, Math.min(pos, contentLength))

  // Find the direct child span that owns this position
  const children = container.children
  let span: HTMLElement | null = null
  for (let i = 0; i < children.length; i++) {
    const c = children[i] as HTMLElement
    const s = parseInt(c.getAttribute('data-start') ?? '0')
    const e = parseInt(c.getAttribute('data-end') ?? '0')
    if (pos >= s && pos <= e) {
      span = c
      break
    }
  }

  const range = document.createRange()

  if (!span) {
    // Fallback: end of container
    range.selectNodeContents(container)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    return
  }

  const offset = pos - parseInt(span.getAttribute('data-start')!)
  let charCount = 0
  let found = false

  const walk = (n: Node): boolean => {
    if (found) return true
    // Mirror the countTextUpTo logic: skip ghost overlays so the position
    // arithmetic stays consistent between setCursorPosition and getCursorOffset.
    if (n instanceof HTMLElement && n.hasAttribute('data-ghost')) return false
    if (n.nodeType === Node.TEXT_NODE) {
      const len = n.textContent?.length ?? 0
      if (charCount + len >= offset) {
        range.setStart(n, offset - charCount)
        found = true
        return true
      }
      charCount += len
    } else {
      for (let i = 0; i < n.childNodes.length; i++) {
        if (walk(n.childNodes[i])) return true
      }
    }
    return false
  }

  walk(span)

  if (!found) {
    range.selectNodeContents(span)
    range.collapse(false)
  } else {
    range.collapse(true)
  }

  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Get selection range as [start, end] source positions.
 * Returns [pos, pos] when the selection is collapsed.
 */
export function getSelectionRange(
  container: HTMLElement,
  sel: Selection | null
): [number, number] {
  if (!sel || !sel.anchorNode || !sel.focusNode) return [0, 0]

  const anchorSpan = findTokenSpan(sel.anchorNode, container)
  const focusSpan = findTokenSpan(sel.focusNode, container)

  if (!anchorSpan || !focusSpan) return [0, 0]

  const anchorBase = parseInt(anchorSpan.getAttribute('data-start')!)
  const anchorPos = anchorBase + countTextUpTo(anchorSpan, sel.anchorNode, sel.anchorOffset)

  const focusBase = parseInt(focusSpan.getAttribute('data-start')!)
  const focusPos = focusBase + countTextUpTo(focusSpan, sel.focusNode, sel.focusOffset)

  const start = Math.min(anchorPos, focusPos)
  const end = Math.max(anchorPos, focusPos)
  return [start, end]
}

/**
 * Update token visibility classes based on mode and cursor position.
 */
export function updateTokenVisibility(
  container: HTMLElement,
  cursorPos: number,
  mode?: 'seamless' | 'markdown' | 'preview'
): void {
  const allTokens = container.querySelectorAll('[data-start]')

  if (mode === 'markdown') {
    allTokens.forEach(el => { el.classList.remove('rendered'); el.classList.add('source') })
    return
  }
  if (mode === 'preview') {
    allTokens.forEach(el => { el.classList.add('rendered'); el.classList.remove('source') })
    return
  }

  // Seamless default: show source only for token under cursor
  allTokens.forEach(el => {
    const s = parseInt(el.getAttribute('data-start') ?? '0')
    const e = parseInt(el.getAttribute('data-end') ?? '0')
    if (cursorPos >= s && cursorPos <= e) {
      el.classList.remove('rendered')
      el.classList.add('source')
    } else {
      el.classList.add('rendered')
      el.classList.remove('source')
    }
  })
}
