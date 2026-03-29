/**
 * contextMenuResolver
 *
 * Factory that returns a per-event context menu item resolver.
 * Call createContextMenuResolver() inside a component's <script setup> so that
 * useStore() calls happen in the correct Pinia context; the returned resolver
 * can then be called from any event listener.
 */
import { useUIStore }   from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import type { MenuItem } from '@/stores/uiStore'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface ResolverOptions {
  sidebarResetWidth:    () => void
  rightPanelResetWidth: () => void
}

export function createContextMenuResolver(opts: ResolverOptions) {
  const uiStore    = useUIStore()
  const storyStore = useStoryStore()

  return function resolveMenuItems(event: MouseEvent): MenuItem[] {
    const target = event.target as Element

    // ── 1. Pane drag handle ────────────────────────────────────────────
    const handle = target.closest('.divider-handle') as HTMLElement | null
    if (handle) {
      const which = handle.dataset.divider
      const reset = which === 'sidebar' ? opts.sidebarResetWidth : opts.rightPanelResetWidth
      return [
        { type: 'action', label: 'Reset to default width', callback: reset },
      ]
    }

    // ── 2. Chapter item in sidebar ─────────────────────────────────────
    const chapterEl = target.closest('[data-chapter-id]') as HTMLElement | null
    if (chapterEl) {
      const id      = chapterEl.getAttribute('data-chapter-id')!
      const chapter = storyStore.chapters.find(ch => ch.id === id)
      if (chapter) {
        const items: MenuItem[] = [
          { type: 'disabled', label: chapter.name },
          { type: 'separator' },
          {
            type: 'action',
            label: 'Rename',
            callback: () => uiStore.triggerChapterRename(id),
          },
          {
            type: 'action',
            label: 'Edit properties',
            callback: () => uiStore.triggerChapterMeta(id),
          },
          { type: 'separator' },
          {
            type: 'action',
            label: 'Delete',
            danger: true,
            callback: () => uiStore.triggerChapterDelete(id),
          },
        ]
        return items
      }
    }

    // ── 3. Link in preview pane (external http/https only) ─────────────
    const link = target.closest('a[href]') as HTMLAnchorElement | null
    if (link && target.closest('.editor-preview')) {
      const href = link.getAttribute('href') ?? ''
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return [
          {
            type: 'action',
            label: 'Open in browser',
            callback: () => {
              if (isTauri) {
                import('@tauri-apps/plugin-opener').then(m => m.openUrl(href))
              } else {
                window.open(href, '_blank', 'noopener')
              }
            },
          },
          {
            type: 'action',
            label: 'Copy link',
            callback: () => navigator.clipboard.writeText(href).catch(() => {}),
          },
        ]
      }
    }

    // ── 4. Image in preview pane ───────────────────────────────────────
    const img = target.closest('img') as HTMLImageElement | null
    if (img && target.closest('.editor-preview')) {
      const src = img.getAttribute('data-local-src') || img.src
      if (src && !src.startsWith('data:')) {
        return [
          {
            type: 'action',
            label: 'Copy image path',
            callback: () => navigator.clipboard.writeText(src).catch(() => {}),
          },
        ]
      }
    }

    // ── 5. Contenteditable (editor) — Cut / Copy / Paste ──────────────
    if (target.closest('[contenteditable]')) {
      const selection  = window.getSelection()
      const hasText    = !!(selection && selection.toString().length > 0)
      const items: MenuItem[] = []

      if (hasText) {
        items.push(
          {
            type: 'action',
            label: 'Cut',
            shortcut: 'Ctrl+X',
            callback: () => document.execCommand('cut'),
          },
          {
            type: 'action',
            label: 'Copy',
            shortcut: 'Ctrl+C',
            callback: () => document.execCommand('copy'),
          },
        )
      }

      items.push({
        type: 'action',
        label: 'Paste',
        shortcut: 'Ctrl+V',
        callback: () => document.execCommand('paste'),
      })

      return items
    }

    return []
  }
}
