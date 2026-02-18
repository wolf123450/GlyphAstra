/**
 * Markdown Renderer with Context-Aware Visibility
 * Shows/hides markdown syntax based on cursor position
 */

export type RenderMode = 'markdown' | 'seamless' | 'preview'

function getCursorLineNum(content: string, cursorPos: number): number {
  return content.substring(0, cursorPos).split('\n').length - 1
}

function getLineStartPos(content: string, lineNum: number): number {
  const lines = content.split('\n')
  let pos = 0
  for (let i = 0; i < lineNum; i++) {
    pos += lines[i].length + 1
  }
  return pos
}

function getWordBoundaries(
  content: string,
  cursorPos: number
): { start: number; end: number } {
  const lines = content.split('\n')
  const lineNum = getCursorLineNum(content, cursorPos)
  const lineStartPos = getLineStartPos(content, lineNum)
  const col = cursorPos - lineStartPos
  const lineContent = lines[lineNum]
  
  let wordStart = col
  let wordEnd = col
  
  while (wordStart > 0 && !/\s/.test(lineContent[wordStart - 1])) {
    wordStart--
  }
  
  while (wordEnd < lineContent.length && !/\s/.test(lineContent[wordEnd])) {
    wordEnd++
  }
  
  return {
    start: lineStartPos + wordStart,
    end: lineStartPos + wordEnd
  }
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
  
  const { start: wordStart, end: wordEnd } = getWordBoundaries(content, cursorPos)
  return renderSeamless(content, cursorPos, wordStart, wordEnd)
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
  cursorPos: number,
  wordStart: number,
  wordEnd: number
): string {
  const lines = content.split('\n')
  const cursorLineNum = getCursorLineNum(content, cursorPos)
  
  let result = ''
  let charPos = 0
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    const isCurrentLine = lineNum === cursorLineNum
    
    const headerMatch = line.match(/^(#{1,6})\s/)
    const headerLevel = headerMatch ? headerMatch[1].length : 0
    const isHeader = headerLevel > 0
    
    let lineHtml = ''
    
    for (let col = 0; col < line.length; col++) {
      const currentPos = charPos + col
      const char = line[col]
      const isInCursorWord = isCurrentLine && currentPos >= wordStart && currentPos < wordEnd
      
      if (isInCursorWord) {
        lineHtml += escapeHtml(char)
      } else if (isHeader && col < headerLevel) {
        // Skip header markers
      } else if (isHeader && col === headerLevel && char === ' ') {
        lineHtml += ' '
      } else {
        lineHtml += escapeHtml(char)
      }
    }
    
    if (!isCurrentLine) {
      lineHtml = applyFormatting(lineHtml, isHeader, headerLevel)
    }
    
    result += lineHtml
    
    if (lineNum < lines.length - 1) {
      result += '<br>'
    }
    
    charPos += line.length + 1
  }
  
  return result
}

function applyFormatting(text: string, isHeader: boolean, headerLevel: number): string {
  if (isHeader) {
    return `<h${headerLevel}>${text}</h${headerLevel}>`
  }
  
  text = text.replace(/~~(.*?)~~/g, '<del>$1</del>')
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>')
  text = text.replace(/`(.*?)`/g, '<code>$1</code>')
  
  return text
}
