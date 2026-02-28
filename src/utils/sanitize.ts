/**
 * Shared HTML sanitization and escaping utilities.
 *
 * Consolidates the four separate escapeHtml implementations that previously
 * existed across markdownRenderer.ts, seamlessRenderer.ts, editorCursor.ts,
 * and exportImport.ts into a single canonical function.
 *
 * Also provides DOMPurify-based sanitization for any user-generated HTML
 * that will be injected via v-html or innerHTML.
 */

import DOMPurify from 'dompurify'

// ─── HTML Escaping ────────────────────────────────────────────────────────────

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}

/**
 * Escape all HTML-significant characters for safe embedding in both
 * element content and attribute values.
 *
 * Escapes: & < > " '
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (m) => ESCAPE_MAP[m])
}

// ─── URL Safety ───────────────────────────────────────────────────────────────

/**
 * Returns true if the URL uses a dangerous scheme that could execute code.
 * Blocks `javascript:`, `vbscript:`, and `data:` (except `data:image/`).
 */
export function isDangerousUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase()
  if (trimmed.startsWith('javascript:')) return true
  if (trimmed.startsWith('vbscript:')) return true
  if (trimmed.startsWith('data:') && !trimmed.startsWith('data:image/')) return true
  return false
}

/**
 * Sanitize a URL for use in href/src attributes.
 * Returns the original URL if safe, or an empty string if dangerous.
 */
export function sanitizeUrl(url: string): string {
  return isDangerousUrl(url) ? '' : url
}

// ─── DOMPurify HTML Sanitization ──────────────────────────────────────────────

/**
 * DOMPurify configuration for rendered markdown content.
 * Allows standard formatting tags plus images and links.
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'code', 'pre', 'blockquote',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span', 'figure', 'figcaption',
    'sup', 'sub', 'small',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id',
    'width', 'height', 'style', 'loading',
    'data-local-src', 'data-start', 'data-end', 'data-ghost',
    'data-story-link', 'data-chapter-id',
    'target', 'rel',
    'colspan', 'rowspan', 'align',
  ],
  ALLOW_DATA_ATTR: true,
  // Block dangerous URI schemes in href/src
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|#):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
}

/**
 * Sanitize HTML string using DOMPurify before injection into the DOM.
 * Use this for any user-generated or markdown-rendered HTML that will be
 * set via v-html or innerHTML.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG)
}
