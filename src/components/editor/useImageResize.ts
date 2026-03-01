import { ref, computed, watch, onUnmounted } from 'vue'
import { parseImgDims } from '@/utils/editor/seamlessRenderer'

/**
 * State and behaviour for the WYSIWYG image resize overlay in
 * EditorSeamless.  The overlay floats above rendered images and lets users
 * drag a corner handle to resize.
 *
 * Returns reactive state (imgOv, ovRect, ovStyle, ovLabel) and event
 * handlers that should be wired to the template.
 */
export function useImageResize(
  getContent: () => string,
  emitSnapshot: () => void,
  emitUpdateContent: (value: string) => void,
) {
  // ─── Overlay state ────────────────────────────────────────────────
  interface ImgOv {
    imgEl:    HTMLImageElement
    start:    number
    end:      number
    src:      string
    cleanAlt: string
    naturalW: number
    naturalH: number
    locked:   boolean
  }

  const imgOv    = ref<ImgOv | null>(null)
  const ovRect   = ref<{ left: number; top: number; width: number; height: number } | null>(null)

  // Non-reactive drag bookkeeping
  let _drag = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
  let _ovHovered = false
  const setOvHovered = (v: boolean) => { _ovHovered = v }

  const ovStyle = computed(() => {
    if (!ovRect.value) return {}
    const { left, top, width, height } = ovRect.value
    return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
  })

  const ovLabel = computed(() => {
    if (!ovRect.value) return ''
    return `${Math.round(ovRect.value.width)} × ${Math.round(ovRect.value.height)}`
  })

  // ─── Helpers ──────────────────────────────────────────────────────

  const refreshOvRect = () => {
    if (!imgOv.value) return
    const r = imgOv.value.imgEl.getBoundingClientRect()
    ovRect.value = { left: r.left, top: r.top, width: r.width, height: r.height }
  }

  const showImgOverlay = (tokenEl: HTMLElement) => {
    const imgEl = tokenEl.querySelector('img.md-image') as HTMLImageElement | null
    if (!imgEl) return
    const start = parseInt(tokenEl.getAttribute('data-start') ?? '0')
    const end   = parseInt(tokenEl.getAttribute('data-end')   ?? '0')
    const raw   = getContent().slice(start, end)
    const m     = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (!m) return
    const src = m[2].trim().replace(/^["']|["']$/g, '')
    const { cleanAlt, dimW, dimH } = parseImgDims(m[1])
    const prevLocked = (imgOv.value?.imgEl === imgEl) ? imgOv.value!.locked : undefined
    const defaultLocked = prevLocked ?? !(dimW && dimH)
    imgOv.value = {
      imgEl, start, end, src, cleanAlt,
      naturalW: imgEl.naturalWidth,
      naturalH: imgEl.naturalHeight,
      locked: defaultLocked,
    }
    refreshOvRect()
  }

  const dismissImgOv = () => {
    if (_drag.active && imgOv.value) {
      const { imgEl } = imgOv.value
      imgEl.style.maxWidth  = ''
      imgEl.style.maxHeight = ''
      imgEl.style.width     = ''
      imgEl.style.height    = ''
      _drag.active = false
    }
    imgOv.value  = null
    ovRect.value = null
  }

  // ─── Mouse enter/leave handlers ───────────────────────────────────

  const handleEditorMouseover = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const imageToken = target.closest<HTMLElement>('.token-image')
    if (imageToken) {
      _ovHovered = false
      const imgEl = imageToken.querySelector('img.md-image') as HTMLImageElement | null
      if (imgEl && (!imgOv.value || imgOv.value.imgEl !== imgEl)) {
        showImgOverlay(imageToken)
      }
    }
  }

  const handleEditorMouseleave = () => {
    setTimeout(() => {
      if (!_drag.active && !_ovHovered) dismissImgOv()
    }, 80)
  }

  // ─── Pointer drag handlers (SE resize handle) ────────────────────

  const onHandleDown = (e: PointerEvent) => {
    if (!imgOv.value) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const { imgEl } = imgOv.value
    _drag.active  = true
    _drag.startX  = e.clientX
    _drag.startY  = e.clientY
    _drag.startW  = imgEl.offsetWidth
    _drag.startH  = imgEl.offsetHeight
    imgEl.style.maxWidth  = 'none'
    imgEl.style.maxHeight = 'none'
    e.preventDefault()
  }

  const onHandleMove = (e: PointerEvent) => {
    if (!_drag.active || !imgOv.value) return
    const { imgEl, locked, naturalW, naturalH } = imgOv.value
    const newW = Math.max(20, _drag.startW + (e.clientX - _drag.startX))
    const newH = Math.max(20, _drag.startH + (e.clientY - _drag.startY))
    if (locked && naturalW > 0 && naturalH > 0) {
      imgEl.style.width  = `${newW}px`
      imgEl.style.height = 'auto'
    } else if (!locked) {
      imgEl.style.width  = `${newW}px`
      imgEl.style.height = `${newH}px`
    } else {
      imgEl.style.width  = `${newW}px`
      imgEl.style.height = 'auto'
    }
    refreshOvRect()
  }

  const onHandleUp = () => {
    if (!_drag.active || !imgOv.value) return
    _drag.active = false
    const { imgEl, start, end, cleanAlt, src, locked } = imgOv.value
    imgEl.style.maxWidth  = ''
    imgEl.style.maxHeight = ''
    const newW = Math.round(imgEl.offsetWidth)
    const newH = Math.round(imgEl.offsetHeight)
    const dimStr = locked ? `w${newW}` : `w${newW} h${newH}`
    imgEl.style.width  = ''
    imgEl.style.height = ''
    emitSnapshot()
    const content    = getContent()
    const newToken   = `![${cleanAlt}|${dimStr}](${src})`
    const newContent = content.slice(0, start) + newToken + content.slice(end)
    emitUpdateContent(newContent)
    imgOv.value = null
    ovRect.value = null
  }

  // ─── Track overlay position on scroll/resize ─────────────────────

  const _ovScrollListener = () => refreshOvRect()
  watch(imgOv, (val) => {
    if (val) {
      window.addEventListener('scroll', _ovScrollListener, { passive: true, capture: true })
      window.addEventListener('resize', _ovScrollListener, { passive: true })
    } else {
      window.removeEventListener('scroll', _ovScrollListener, { capture: true })
      window.removeEventListener('resize', _ovScrollListener)
    }
  })
  onUnmounted(() => {
    window.removeEventListener('scroll', _ovScrollListener, { capture: true })
    window.removeEventListener('resize', _ovScrollListener)
  })

  return {
    imgOv,
    ovStyle,
    ovLabel,
    setOvHovered,
    dismissImgOv,
    handleEditorMouseover,
    handleEditorMouseleave,
    onHandleDown,
    onHandleMove,
    onHandleUp,
  }
}
