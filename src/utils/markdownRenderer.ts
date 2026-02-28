/**
 * Markdown Renderer
 *
 * Delegates to seamlessRenderer for consistent block-level rendering.
 * Only 'preview' mode is used in practice; the type is kept for API clarity.
 */

import { tokenizeMarkdown, renderTokens } from './seamlessRenderer'

export type RenderMode = 'preview'

export function renderMarkdown(
  content: string,
  _cursorPos: number,
  _mode: RenderMode
): string {
  const tokens = tokenizeMarkdown(content)
  return renderTokens(tokens, content, -1, 'preview')
}

