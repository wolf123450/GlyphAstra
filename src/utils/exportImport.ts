/**
 * Export & Import utilities
 *
 * Supports:
 *   exportStoryToMarkdown  — single .md file, chapters separated by ## headings
 *   exportChapterToMarkdown — current chapter as standalone .md
 *   exportStoryToHTML       — self-contained styled .html (print → PDF)
 *   exportStoryToDocx       — Word .docx via the `docx` npm package
 *   importMarkdownAsChapter — open a .md/.txt file, return {name, content}
 *
 * All file dialogs use Tauri plugin-dialog; all writes use Tauri plugin-fs.
 * Capabilities required: dialog:allow-open, dialog:allow-save,
 *   fs:allow-home-read-recursive, fs:allow-home-write-recursive.
 */

import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile, writeFile, readFile } from '@tauri-apps/plugin-fs'
import epub from 'epub-gen-memory/bundle'
import {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType,
  BookmarkStart, BookmarkEnd, InternalHyperlink,
} from 'docx'
import { renderMarkdown } from './markdownRenderer'
import { getPackedDataUrl } from './imagePackManager'

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post-process exported HTML: replace every `data-local-src="X" src=""` with
 * the packed data URL so the exported file is fully self-contained.
 * If no pack entry exists for a src, that image is left as a broken placeholder.
 */
async function inlinePackedImages(html: string, storyId: string): Promise<string> {
  const srcRe = /data-local-src="([^"]*)"/g
  const srcs = new Set<string>()
  let m: RegExpExecArray | null
  srcRe.lastIndex = 0
  while ((m = srcRe.exec(html)) !== null) {
    if (m[1]) srcs.add(m[1])
  }
  if (srcs.size === 0) return html

  // Resolve all unique srcs in parallel
  const resolved = new Map<string, string>()
  await Promise.all([...srcs].map(async (src) => {
    const dataUrl = await getPackedDataUrl(storyId, src)
    if (dataUrl) resolved.set(src, dataUrl)
  }))
  if (resolved.size === 0) return html

  // Substitute: for each <img> with data-local-src, swap in the data URL
  return html.replace(/<img\b([^>]*)>/g, (match, attrs: string) => {
    const srcMatch = attrs.match(/data-local-src="([^"]*)"/) 
    if (!srcMatch) return match
    const dataUrl = resolved.get(srcMatch[1])
    if (!dataUrl) return match
    const newAttrs = attrs.replace(/\bsrc="[^"]*"/, `src="${dataUrl}"`)
    return `<img${newAttrs}>`
  })
}

export interface ExportChapter {
  name: string
  content: string
  order: number
  label?: string   // chapterLabel override (e.g. 'Prologue', 'Chapter 4'); absent = use name only
  chapterType?: 'toc' | 'cover' | 'license' | 'illustration'
  illustrationPath?: string
  illustrationCaption?: string
}

export interface ExportMeta {
  title: string
  genre?: string
  tone?: string
  summary?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim() || 'export'
}

// escHtml imported from shared sanitize utility
import { escapeHtml as escHtml } from '@/utils/sanitize'

/** DOM/DOCX safe anchor slug from a heading string. */
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'ch'
}

export interface TocEntry { text: string; slug: string }

/**
 * Builds numbered TOC entries for all non-TOC chapters, in sidebar order.
 * Also returns a Map<chapter, slug> so callers can annotate headings.
 */
function buildTocData(chapters: ExportChapter[]): {
  entries: TocEntry[]
  slugMap: Map<ExportChapter, string>
} {
  const nonToc = [...chapters]
    .filter(c => c.chapterType !== 'toc')
    .sort((a, b) => a.order - b.order)

  const entries: TocEntry[] = []
  const slugMap = new Map<ExportChapter, string>()
  nonToc.forEach((c, i) => {
    const slug = `ch${i}-${slugify(chapterHeading(c))}`
    entries.push({ text: `${i + 1}. ${chapterHeading(c)}`, slug })
    slugMap.set(c, slug)
  })
  return { entries, slugMap }
}

/** Plain text list for Markdown export. */
function generateTocItems(chapters: ExportChapter[]): string[] {
  return buildTocData(chapters).entries.map(e => e.text)
}

// ── Markdown Export ───────────────────────────────────────────────────────────

function chapterHeading(ch: ExportChapter): string {
  if (!ch.label) return ch.name
  if (ch.label === ch.name) return ch.label
  return `${ch.label}: ${ch.name}`
}

function buildMarkdownDoc(meta: ExportMeta, chapters: ExportChapter[]): string {
  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const tocItems = generateTocItems(chapters)
  const lines: string[] = [`# ${meta.title}`, '']
  if (meta.genre) lines.push(`**Genre:** ${meta.genre}  `)
  if (meta.tone)  lines.push(`**Tone:** ${meta.tone}  `)
  if (meta.summary) lines.push('', meta.summary)
  lines.push('', '---', '')
  for (const ch of sorted) {
    lines.push(`## ${chapterHeading(ch)}`)
    lines.push('')
    if (ch.chapterType === 'toc') {
      lines.push(tocItems.join('\n'))
    } else if (ch.chapterType === 'illustration') {
      if (ch.illustrationPath) lines.push(`![${ch.illustrationCaption ?? ''}](${ch.illustrationPath})`)
      if (ch.illustrationCaption) lines.push(`*${ch.illustrationCaption}*`)
      if (ch.content.trim()) lines.push('', ch.content.trim())
    } else {
      lines.push(ch.content.trim())
    }
    lines.push('', '---', '')
  }
  return lines.join('\n')
}

export async function exportStoryToMarkdown(
  meta: ExportMeta,
  chapters: ExportChapter[]
): Promise<boolean> {
  const path = await save({
    title: 'Export story as Markdown',
    defaultPath: `${safeFilename(meta.title)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (!path) return false
  await writeTextFile(path, buildMarkdownDoc(meta, chapters))
  return true
}

export async function exportChapterToMarkdown(
  chapterName: string,
  content: string
): Promise<boolean> {
  const path = await save({
    title: 'Export chapter as Markdown',
    defaultPath: `${safeFilename(chapterName)}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (!path) return false
  await writeTextFile(path, `# ${chapterName}\n\n${content.trim()}\n`)
  return true
}

// ── HTML Export ───────────────────────────────────────────────────────────────

const HTML_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    max-width: 720px; margin: 0 auto; padding: 60px 40px;
    color: #1a1a1a; line-height: 1.85; font-size: 17px;
  }
  h1 { font-size: 2.4em; text-align: center; margin-bottom: 0.15em; }
  .story-meta { text-align: center; color: #666; font-style: italic; margin-bottom: 3.5em; font-size: 0.95em; }
  h2 { font-size: 1.4em; margin-top: 4em; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; color: #333; }
  p, li { margin: 0.9em 0; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1.2em; color: #555; margin: 1.5em 0; }
  ul { padding-left: 1.6em; }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 3em 0; }
  nav.toc { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1.5em 2em; margin: 2em 0; }
  nav.toc h2 { margin-top: 0; border-bottom: none; font-size: 1.1em; }
  nav.toc ol { margin: 0; padding-left: 1.4em; }
  nav.toc a { color: #333; text-decoration: none; }
  nav.toc a:hover { text-decoration: underline; }
  .cover-block { text-align: center; padding: 6em 2em; border-bottom: 2px solid #ccc; margin-bottom: 4em; }
  .cover-block h2 { font-size: 2em; border-bottom: none; margin-top: 0; }
  .license-block { font-size: 0.88em; color: #555; border: 1px solid #ddd; border-radius: 4px; padding: 1.2em 1.6em; margin: 2em 0; }
  .illustration-block figure { margin: 2em 0; text-align: center; }
  .illustration-block figure img { max-width: 100%; height: auto; }
  .illustration-block figcaption { font-size: 0.9em; color: #666; font-style: italic; margin-top: 0.5em; }
  @media print {
    h2 { page-break-before: always; }
    h1 { page-break-before: avoid; }
    .story-meta { page-break-after: always; }
  }
`

export async function exportStoryToHTML(
  meta: ExportMeta,
  chapters: ExportChapter[],
  storyId?: string
): Promise<boolean> {
  const path = await save({
    title: 'Export story as HTML',
    defaultPath: `${safeFilename(meta.title)}.html`,
    filters: [{ name: 'HTML File', extensions: ['html'] }],
  })
  if (!path) return false

  const metaParts = [meta.genre, meta.tone].filter(Boolean)
  const wc = chapters.reduce(
    (n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0
  )
  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const { entries: tocEntries, slugMap } = buildTocData(chapters)

  const body = (await Promise.all(sorted
    .map(async ch => {
      const heading = escHtml(chapterHeading(ch))
      if (ch.chapterType === 'toc') {
        const items = tocEntries
          .map(e => `<li><a href="#${e.slug}">${escHtml(e.text.replace(/^\d+\.\s*/, ''))}</a></li>`)
          .join('\n          ')
        return `<nav class="toc"><h2>${heading}</h2><ol>\n          ${items}\n        </ol></nav>`
      }
      const slug = slugMap.get(ch)
      const idAttr = slug ? ` id="${slug}"` : ''
      let html: string
      if (ch.chapterType === 'cover') {
        html = `<div class="cover-block"><h2${idAttr}>${heading}</h2>${renderMarkdown(ch.content, 0, 'preview')}</div>`
      } else if (ch.chapterType === 'license') {
        html = `<div class="license-block"><h2${idAttr}>${heading}</h2>${renderMarkdown(ch.content, 0, 'preview')}</div>`
      } else if (ch.chapterType === 'illustration') {
        const imgPath = ch.illustrationPath ? `file:///${ch.illustrationPath.replace(/\\/g, '/')}` : ''
        const caption = ch.illustrationCaption ? `<figcaption>${escHtml(ch.illustrationCaption)}</figcaption>` : ''
        const img = imgPath ? `<figure><img src="${escHtml(imgPath)}" alt="${escHtml(ch.illustrationCaption ?? '')}">${caption}</figure>` : ''
        const extra = ch.content.trim() ? renderMarkdown(ch.content, 0, 'preview') : ''
        html = `<div class="illustration-block"><h2${idAttr}>${heading}</h2>${img}${extra}</div>`
      } else {
        html = `<h2${idAttr}>${heading}</h2>\n${renderMarkdown(ch.content, 0, 'preview')}`
      }
      if (storyId) html = await inlinePackedImages(html, storyId)
      return html
    })
  )).join('\n<hr>\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(meta.title)}</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <h1>${escHtml(meta.title)}</h1>
  <div class="story-meta">${
    metaParts.length ? escHtml(metaParts.join(' · ')) + ' · ' : ''
  }${wc.toLocaleString()} words</div>
  ${body}
</body>
</html>`

  await writeTextFile(path, html)
  return true
}

// ── DOCX Export ───────────────────────────────────────────────────────────────

/** Strip markdown markers to plain text for DOCX body paragraphs. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '  • ')
}

export async function exportStoryToDocx(
  meta: ExportMeta,
  chapters: ExportChapter[]
): Promise<boolean> {
  const path = await save({
    title: 'Export story as Word Document',
    defaultPath: `${safeFilename(meta.title)}.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })
  if (!path) return false

  const children: Paragraph[] = []

  // Title
  children.push(
    new Paragraph({
      text: meta.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  )

  // Subtitle / meta line
  const metaLine = [meta.genre, meta.tone].filter(Boolean).join(' · ')
  if (metaLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: metaLine, italics: true, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      })
    )
  }

  // Chapters
  const sorted = [...chapters].sort((a, b) => a.order - b.order)
  const { entries: tocEntries, slugMap } = buildTocData(chapters)
  let bmId = 0
  for (const ch of sorted) {
    const isPageBreak = children.length > 2
    const headingText = chapterHeading(ch)
    const slug = slugMap.get(ch)
    if (slug) {
      // Non-TOC heading: wrap in a named bookmark for internal linking
      children.push(new Paragraph({
        children: [
          new BookmarkStart(slug, bmId),
          new TextRun({ text: headingText }),
          new BookmarkEnd(bmId),
        ],
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: isPageBreak,
      }))
      bmId++
    } else {
      // TOC heading: no bookmark needed
      children.push(new Paragraph({
        children: [new TextRun({ text: headingText })],
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: isPageBreak,
      }))
    }
    if (ch.chapterType === 'toc') {
      for (const entry of tocEntries) {
        children.push(new Paragraph({
          children: [
            new InternalHyperlink({
              anchor: entry.slug,
              children: [new TextRun({ text: entry.text })],
            }),
          ],
        }))
      }
    } else if (ch.chapterType === 'illustration') {
      if (ch.illustrationPath) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[Illustration: ${ch.illustrationPath}]`, italics: true, color: '666666' })] }))
      }
      if (ch.illustrationCaption) {
        children.push(new Paragraph({ children: [new TextRun({ text: ch.illustrationCaption, italics: true, color: '666666' })] }))
      }
      if (ch.content.trim()) {
        const cleaned = stripMarkdown(ch.content)
        for (const block of cleaned.split(/\n\n+/)) {
          const line = block.replace(/\n/g, ' ').trim()
          if (line) children.push(new Paragraph({ children: [new TextRun({ text: line })] }))
        }
      }
    } else {
      const cleaned = stripMarkdown(ch.content)
      for (const block of cleaned.split(/\n\n+/)) {
        const line = block.replace(/\n/g, ' ').trim()
        if (line) {
          children.push(new Paragraph({ children: [new TextRun({ text: line })] }))
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const arrayBuffer = await blob.arrayBuffer()
  await writeFile(path, new Uint8Array(arrayBuffer))
  return true
}

// ── EPUB Export ──────────────────────────────────────────────────────────────

const EPUB_CSS = `
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; margin: 1.5em; }
  h1 { font-family: sans-serif; font-size: 1.8em; margin-bottom: 0.4em; }
  h2, h3, h4 { font-family: sans-serif; }
  p { margin: 0.8em 0; text-indent: 1.2em; }
  p:first-child, h1 + p, h2 + p, h3 + p { text-indent: 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  code { font-family: monospace; font-size: 0.9em; background: #f4f4f4; padding: 0 3px; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1em; margin: 1em 0; color: #555; }
  ul, ol { padding-left: 1.6em; }
  li { margin: 0.3em 0; }
  .cover-block { text-align: center; padding: 4em 1em; }
  .cover-block h1 { font-size: 2.2em; border-bottom: none; }
  .license-block { font-size: 0.88em; color: #555; }
  figure { text-align: center; margin: 2em 0; }
  figcaption { font-size: 0.9em; font-style: italic; color: #666; margin-top: 0.5em; }
  img { max-width: 100%; height: auto; }
  ol.epub-toc-list { list-style: decimal; padding-left: 1.4em; }
  ol.epub-toc-list li { margin: 0.4em 0; }
`

/**
 * Post-processes HTML from renderMarkdown('preview') for EPUB output.
 * The renderer emits raw escaped text with \n separators that collapse in HTML;
 * this wraps blank-line-separated prose blocks in <p> tags while leaving
 * block-level elements (headings, lists, pre, blockquote, etc.) unchanged.
 */
function paragraphifyHtml(html: string): string {
  const BLOCK = /^<(h[1-6]|ul|ol|pre|blockquote|hr|table|figure|div|p)[\s>\/]/i
  return html
    .split(/\n{2,}/)
    .map(segment => {
      const trimmed = segment.replace(/\n/g, ' ').trim()
      if (!trimmed) return ''
      if (BLOCK.test(trimmed)) return trimmed
      return `<p>${trimmed}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

/** Read a local file and return a base64 data-URL, for embedding illustrations. */
async function readImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const bytes = await readFile(path)
    // Chunked btoa to avoid stack overflow on large images
    let binary = ''
    const chunk = 8192
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const base64 = btoa(binary)
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const mime = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : ext === 'svg' ? 'image/svg+xml'
      : 'image/jpeg'
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

export async function exportStoryToEpub(
  meta: ExportMeta,
  chapters: ExportChapter[],
  storyId?: string
): Promise<boolean> {
  const path = await save({
    title: 'Export story as EPUB',
    defaultPath: `${safeFilename(meta.title)}.epub`,
    filters: [{ name: 'EPUB eBook', extensions: ['epub'] }],
  })
  if (!path) return false

  const sorted = [...chapters].sort((a, b) => a.order - b.order)

  type EpubChapter = {
    title: string
    content: string
    excludeFromToc?: boolean
    beforeToc?: boolean
    filename?: string
  }

  let chIdx = 0
  const epubChapters: EpubChapter[] = []

  for (const ch of sorted) {
    const heading = chapterHeading(ch)

    // TOC chapters are skipped — epub-gen-memory auto-generates a linked
    // navigation TOC from chapter titles, which is preferable to our static list.
    if (ch.chapterType === 'toc') continue

    if (ch.chapterType === 'cover') {
      let body = paragraphifyHtml(renderMarkdown(ch.content, 0, 'preview'))
      if (storyId) body = await inlinePackedImages(body, storyId)
      epubChapters.push({
        title: heading,
        content: `<div class="cover-block"><h1>${escHtml(heading)}</h1>${body}</div>`,
        excludeFromToc: true,
        beforeToc: true,
        filename: 'epub-cover',
      })

    } else if (ch.chapterType === 'license') {
      let body = paragraphifyHtml(renderMarkdown(ch.content, 0, 'preview'))
      if (storyId) body = await inlinePackedImages(body, storyId)
      epubChapters.push({
        title: heading,
        content: `<div class="license-block"><h1>${escHtml(heading)}</h1>${body}</div>`,
        filename: 'epub-license',
      })

    } else if (ch.chapterType === 'illustration') {
      let imgHtml = ''
      if (ch.illustrationPath) {
        const dataUrl = await readImageAsDataUrl(ch.illustrationPath)
        if (dataUrl) {
          const cap = ch.illustrationCaption
            ? `<figcaption>${escHtml(ch.illustrationCaption)}</figcaption>`
            : ''
          imgHtml = `<figure><img src="${dataUrl}" alt="${escHtml(ch.illustrationCaption ?? '')}">${cap}</figure>`
        } else {
          imgHtml = `<p><em>[Illustration: ${escHtml(ch.illustrationPath)} — file not found]</em></p>`
        }
      }
      let extra = ch.content.trim() ? paragraphifyHtml(renderMarkdown(ch.content, 0, 'preview')) : ''
      if (storyId && extra) extra = await inlinePackedImages(extra, storyId)
      epubChapters.push({
        title: heading,
        content: `<h1>${escHtml(heading)}</h1>${imgHtml}${extra}`,
        filename: `epub-illus-${chIdx++}`,
      })

    } else {
      // Normal / plot-outline chapters
      let body = paragraphifyHtml(renderMarkdown(ch.content, 0, 'preview'))
      if (storyId) body = await inlinePackedImages(body, storyId)
      epubChapters.push({
        title: heading,
        content: `<h1>${escHtml(heading)}</h1>${body}`,
        filename: `epub-ch-${chIdx++}`,
      })
    }
  }

  const blob = await epub({
    title: meta.title,
    description: meta.summary ?? '',
    lang: 'en',
    css: EPUB_CSS,
    version: 3,
    prependChapterTitles: false,
    numberChaptersInTOC: false,
  }, epubChapters) as Blob

  const arrayBuffer = await blob.arrayBuffer()
  await writeFile(path, new Uint8Array(arrayBuffer))
  return true
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importMarkdownAsChapter(): Promise<{
  name: string
  content: string
} | null> {
  const selected = await open({
    title: 'Import Markdown File',
    multiple: false,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  })
  if (!selected || typeof selected !== 'string') return null

  const raw = await readTextFile(selected)

  // Guard against absurdly large files (10 MB text limit)
  const MAX_IMPORT_BYTES = 10 * 1024 * 1024
  if (raw.length > MAX_IMPORT_BYTES) {
    throw new Error(`File too large (${(raw.length / 1024 / 1024).toFixed(1)} MB). Maximum import size is 10 MB.`)
  }

  // Use first # heading as chapter name, fall back to filename
  const headingMatch = raw.match(/^#\s+(.+)$/m)
  const fileName =
    selected.split(/[/\\]/).pop()?.replace(/\.(md|txt)$/i, '') ??
    'Imported Chapter'
  const name = headingMatch ? headingMatch[1].trim() : fileName

  // Strip the heading line itself if used as name
  const content = headingMatch
    ? raw.replace(/^#\s+.+\n?/, '').trimStart()
    : raw

  return { name, content }
}
