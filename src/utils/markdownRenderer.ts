/**
 * Markdown Renderer with Context-Aware Visibility
 * Shows/hides markdown syntax based on cursor position
 */

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
    return renderPreview(content)
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

function renderPreview(content: string): string {
  let html = escapeHtml(content)
  
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')
  
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/`(.*?)`/g, '<code>$1</code>')
  
  html = html.replace(/^- (.*?)$/gm, '<li>$1</li>')
  html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*?<\/li>(?:\n<li>.*?<\/li>)*)/gm, function(match) {
    const listContent = match.replace(/\n/g, '')
    return '<ul>' + listContent + '</ul>'
  })
  
  html = html.replace(/\n/g, '<br>')
  
  return html
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

