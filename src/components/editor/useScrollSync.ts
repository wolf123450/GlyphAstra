import { ref, watch, nextTick, onBeforeUnmount, type Ref, type ComputedRef } from 'vue'
import type { RenderMode } from '@/utils/editor/seamlessRenderer'
import type EditorSeamless from './EditorSeamless.vue'
import type EditorMarkdown from './EditorMarkdown.vue'
import type EditorPreview from './EditorPreview.vue'

/**
 * Encapsulates split-view scroll synchronisation and cross-mode scroll position
 * preservation for the editor panel.
 *
 * Returned refs (`splitEditorRef`, `splitPreviewRef`, `soloSeamlessRef`, etc.)
 * must be bound to the corresponding template elements via `ref="..."`.
 */
export function useScrollSync(
  content: ComputedRef<string>,
  renderMode: Ref<RenderMode>,
  splitViewActive: ComputedRef<boolean>,
) {
  // ─── Template refs ────────────────────────────────────────────────
  const splitEditorRef  = ref<InstanceType<typeof EditorSeamless> | null>(null)
  const splitPreviewRef = ref<InstanceType<typeof EditorPreview>  | null>(null)
  const soloSeamlessRef = ref<InstanceType<typeof EditorSeamless> | null>(null)
  const soloMarkdownRef = ref<InstanceType<typeof EditorMarkdown>  | null>(null)
  const soloPreviewRef  = ref<InstanceType<typeof EditorPreview>   | null>(null)

  let _stopScrollSync: (() => void) | null = null

  // ─── Line-number scroll sync (shared core) ───────────────────────
  /**
   * Reads the fractional source-line at the top of `container`.
   * isPreview=true  → reads [data-source-line] blocks (EditorPreview)
   * isPreview=false → reads [data-start]/[data-end] token spans (editor modes)
   */
  function captureLineFrom(container: HTMLElement, isPreview: boolean): number {
    if (container.scrollTop < 2) return 0
    const cTop = container.getBoundingClientRect().top

    if (isPreview) {
      const all = Array.from(container.querySelectorAll('[data-source-line]')) as HTMLElement[]
      for (let i = 0; i < all.length; i++) {
        const r = all[i].getBoundingClientRect()
        if (r.bottom <= cTop) continue
        const lineStart = parseInt(all[i].getAttribute('data-source-line')!, 10)
        if (r.top >= cTop) return lineStart
        const lineEnd = i + 1 < all.length
          ? parseInt(all[i + 1].getAttribute('data-source-line')!, 10)
          : lineStart + 1
        return r.height > 1
          ? lineStart + ((cTop - r.top) / r.height) * (lineEnd - lineStart)
          : lineStart
      }
    } else {
      const all = Array.from(container.querySelectorAll('[data-start]')) as HTMLElement[]
      for (const el of all) {
        const r = el.getBoundingClientRect()
        if (r.bottom <= cTop) continue
        const charStart = parseInt(el.getAttribute('data-start')!, 10)
        const charEnd   = parseInt(el.getAttribute('data-end') ?? String(charStart), 10)
        const lineStart = content.value.slice(0, charStart).split('\n').length - 1
        if (r.top >= cTop) return lineStart
        const lineEnd = content.value.slice(0, charEnd).split('\n').length - 1
        if (lineEnd === lineStart || r.height < 2) return lineStart
        return lineStart + ((cTop - r.top) / r.height) * (lineEnd - lineStart)
      }
    }
    return 0
  }

  /**
   * Scrolls `container` so that `sourceLine` (fractional) is at the top.
   */
  function applyScrollLine(container: HTMLElement, isPreview: boolean, sourceLine: number): void {
    if (sourceLine < 0.05) { container.scrollTop = 0; return }
    const cRect = container.getBoundingClientRect()

    if (isPreview) {
      const all = Array.from(container.querySelectorAll('[data-source-line]')) as HTMLElement[]
      for (let i = 0; i < all.length; i++) {
        const lineStart = parseInt(all[i].getAttribute('data-source-line')!, 10)
        const lineEnd   = i + 1 < all.length
          ? parseInt(all[i + 1].getAttribute('data-source-line')!, 10)
          : lineStart + 1
        if (sourceLine >= lineStart && sourceLine < lineEnd) {
          const tRect = all[i].getBoundingClientRect()
          const frac  = lineEnd > lineStart ? (sourceLine - lineStart) / (lineEnd - lineStart) : 0
          container.scrollTop = container.scrollTop + (tRect.top - cRect.top) + frac * tRect.height
          return
        }
      }
      for (let i = all.length - 1; i >= 0; i--) {
        if (parseInt(all[i].getAttribute('data-source-line')!, 10) <= sourceLine) {
          const tRect = all[i].getBoundingClientRect()
          container.scrollTop = container.scrollTop + (tRect.top - cRect.top)
          return
        }
      }
    } else {
      const lines      = content.value.split('\n')
      const lineFloor  = Math.floor(sourceLine)
      const lineFrac   = sourceLine - lineFloor
      const charBase   = lines.slice(0, lineFloor).join('\n').length
      const lineLen    = (lines[lineFloor] ?? '').length
      const charOffset = charBase + Math.round(lineFrac * lineLen)
      const all = Array.from(container.querySelectorAll('[data-start]')) as HTMLElement[]
      for (const el of all) {
        const charStart = parseInt(el.getAttribute('data-start')!, 10)
        const charEnd   = parseInt(el.getAttribute('data-end') ?? String(charStart), 10)
        if (charEnd < charOffset) continue
        const tRect      = el.getBoundingClientRect()
        const tokenChars = charEnd - charStart
        const frac       = tokenChars > 0 ? (charOffset - charStart) / tokenChars : 0
        container.scrollTop = container.scrollTop + (tRect.top - cRect.top) + frac * tRect.height
        return
      }
    }
  }

  // ─── Split-view live scroll sync ──────────────────────────────────
  function setupScrollSync() {
    const editorEl  = splitEditorRef.value?.scrollEl
    const previewEl = splitPreviewRef.value?.scrollEl
    if (!editorEl || !previewEl) return

    let isSyncing = false

    const onEditorScroll = () => {
      if (isSyncing) return
      isSyncing = true
      applyScrollLine(previewEl, true, captureLineFrom(editorEl, false))
      requestAnimationFrame(() => { isSyncing = false })
    }
    const onPreviewScroll = () => {
      if (isSyncing) return
      isSyncing = true
      applyScrollLine(editorEl, false, captureLineFrom(previewEl, true))
      requestAnimationFrame(() => { isSyncing = false })
    }

    editorEl.addEventListener('scroll',  onEditorScroll,  { passive: true })
    previewEl.addEventListener('scroll', onPreviewScroll, { passive: true })

    _stopScrollSync = () => {
      editorEl.removeEventListener('scroll',  onEditorScroll)
      previewEl.removeEventListener('scroll', onPreviewScroll)
    }
  }

  watch(splitViewActive, (active) => {
    _stopScrollSync?.()
    _stopScrollSync = null
    if (active) nextTick(setupScrollSync)
  })

  onBeforeUnmount(() => _stopScrollSync?.())

  // ─── Mode-switch scroll sync ──────────────────────────────────────
  function captureScrollLine(): number {
    const seamlessEl = soloSeamlessRef.value?.scrollEl
    const markdownEl = soloMarkdownRef.value?.scrollEl
    const previewEl  = soloPreviewRef.value?.scrollEl
    const container  = seamlessEl ?? markdownEl ?? previewEl
    if (!container) return 0
    return captureLineFrom(container, !!(previewEl && !seamlessEl && !markdownEl))
  }

  function restoreScrollLine(toMode: RenderMode, sourceLine: number) {
    nextTick(() => {
      requestAnimationFrame(() => {
        const container = toMode === 'preview'
          ? soloPreviewRef.value?.scrollEl
          : (soloSeamlessRef.value?.scrollEl ?? soloMarkdownRef.value?.scrollEl)
        if (!container) return
        applyScrollLine(container, toMode === 'preview', sourceLine)
      })
    })
  }

  function setMode(newMode: RenderMode) {
    if (newMode === renderMode.value) return
    const line = captureScrollLine()
    renderMode.value = newMode
    restoreScrollLine(newMode, line)
  }

  return {
    splitEditorRef,
    splitPreviewRef,
    soloSeamlessRef,
    soloMarkdownRef,
    soloPreviewRef,
    setMode,
  }
}
