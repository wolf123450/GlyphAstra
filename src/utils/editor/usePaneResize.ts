/**
 * usePaneResize
 *
 * Drag-to-resize helper for sidebar / right-panel panes.
 * Updates a CSS variable on :root and persists the width to localStorage.
 *
 * Usage:
 *   const sidebar = usePaneResize('--sidebar-width', 160, 400, 'glyphastra_sidebar_width')
 *   // in template: @mousedown="sidebar.onDividerMousedown"
 */
export interface PaneResizeOptions {
  /** CSS custom property name, e.g. '--sidebar-width' */
  cssVar: string
  /** Minimum allowed width in px */
  min: number
  /** Maximum allowed width in px */
  max: number
  /** localStorage key for persisting the user's choice */
  storageKey: string
  /**
   * Given the current mouse X position, return the desired new pane width.
   * e.g. left pane:  (x) => x
   *      right pane: (x) => window.innerWidth - x
   */
  getWidth: (clientX: number) => number
}

export function usePaneResize(opts: PaneResizeOptions) {
  /** Restore persisted width on first call (before any drag) */
  function restoreWidth() {
    const saved = localStorage.getItem(opts.storageKey)
    if (saved) {
      const w = parseInt(saved, 10)
      if (w >= opts.min && w <= opts.max) {
        document.documentElement.style.setProperty(opts.cssVar, `${w}px`)
      }
    }
  }

  function onDividerMousedown(e: MouseEvent) {
    // Only handle primary button drags
    if (e.button !== 0) return
    e.preventDefault()

    // Disable text selection and CSS width transitions while dragging
    document.body.style.userSelect = 'none'
    document.body.classList.add('pane-resizing')

    function onMousemove(me: MouseEvent) {
      const w = Math.min(opts.max, Math.max(opts.min, opts.getWidth(me.clientX)))
      document.documentElement.style.setProperty(opts.cssVar, `${w}px`)
    }

    function onMouseup() {
      document.body.style.userSelect = ''
      document.body.classList.remove('pane-resizing')
      const current = getComputedStyle(document.documentElement)
        .getPropertyValue(opts.cssVar)
        .trim()
        .replace('px', '')
      localStorage.setItem(opts.storageKey, current)
      window.removeEventListener('mousemove', onMousemove)
      window.removeEventListener('mouseup', onMouseup)
    }

    window.addEventListener('mousemove', onMousemove)
    window.addEventListener('mouseup', onMouseup)
  }

  return { onDividerMousedown, restoreWidth }
}
