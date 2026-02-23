/**
 * Markdown Renderer with Context-Aware Visibility
 * Shows/hides markdown syntax based on cursor position.
 *
 * For 'preview' mode, delegates to seamlessRenderer so that all block-level
 * features (tables, proper inline formatting, etc.) are rendered consistently.
 */

import { tokenizeMarkdown, renderTokens } from './seamlessRenderer'

export type RenderMode = 'markdown' | 'seamless' | 'preview'

function getCursorLineNum(content: string, cursorPos: number): number {
  return content.substring(0, cursorPos).split('\n').length - 1
}

export function renderMarkdown(
  content: string,
  cursorPos: number,
  mode: RenderMode
): string {
  if (mode === 'preview') {
    const tokens = tokenizeMarkdown(content)
    return renderTokens(tokens, content, -1, 'preview')

  }
  
  if (mode === 'markdown') {
    return escapeHtml(content)
  }
  
  return renderSeamless(content, cursorPos)
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

function renderSeamless(
  content: string,
  cursorPos: number
): string {
  const lines = content.split('\n')
  const cursorLineNum = getCursorLineNum(content, cursorPos)
  
  let result = ''
  let charPos = 0
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    const isCurrentLine = lineNum === cursorLineNum
    
    let lineHtml = ''
    
    if (isCurrentLine) {
      // On cursor line: show everything raw (already escaped by escapeHtml)
      lineHtml = escapeHtml(line)
    } else {
      // On non-cursor lines: apply markdown formatting
      const headerMatch = line.match(/^(#{1,6})\s(.*)$/)
      if (headerMatch) {
        const headerLevel = headerMatch[1].length
        const headerContent = headerMatch[2]
        lineHtml = `<h${headerLevel}>${escapeHtml(headerContent)}</h${headerLevel}>`
      } else {
        // Regular line: apply inline formatting
        lineHtml = escapeHtml(line)
        
        // Apply formatting patterns to escaped text
        // Strikethrough
        lineHtml = lineHtml.replace(/~~(.*?)~~/g, '<del>$1</del>')
        // Bold
        lineHtml = lineHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        lineHtml = lineHtml.replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Inline code
        lineHtml = lineHtml.replace(/`(.*?)`/g, '<code>$1</code>')
        // List items
        if (line.match(/^[-*]\s/)) {
          lineHtml = lineHtml.replace(/^([-*])\s/, '<li>')
          lineHtml += '</li>'
        }
      }
    }
    
    result += lineHtml
    
    if (lineNum < lines.length - 1) {
      result += '<br>'
    }
    
    charPos += line.length + 1
  }
  
  return result
}

