<template>
  <div class="editor-wrapper">
    <div v-if="props.isReadOnly" class="readonly-banner">
      🔒 This is a reference chapter — editing is disabled to preserve the help content.
    </div>
    <div
      ref="editorInput"
      class="editor-input"
      :class="{ 'editor-input--readonly': props.isReadOnly }"
      :contenteditable="props.isReadOnly ? 'false' : 'plaintext-only'"
      :spellcheck="settingsStore.settings.spellCheck"
      @input="onInput"
      @click="handleEditorClick"
      @keydown="handleKeydown"
      @keyup="onKeyup"
      @mouseup="onCursorActivity"
      @mouseover="handleEditorMouseover"
      @mouseleave="handleEditorMouseleave"
      @paste="handlePaste"
      @cut="handleCut"
    ></div>
  </div>

  <!-- ── WYSIWYG image resize overlay ──────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="imgOv"
      class="img-ov"
      :style="ovStyle"
    >
      <!-- Dimensions label + ratio lock toggle -->
      <div class="img-ov-topbar"
           @mouseenter="_ovHovered = true"
           @mouseleave="_ovHovered = false">
        <span class="img-ov-dims">{{ ovLabel }}</span>
        <button
          class="img-ov-lock"
          :class="{ unlocked: !imgOv.locked }"
          :title="imgOv.locked ? 'Aspect ratio locked — click to free' : 'Aspect ratio free — click to lock'"
          @click.stop="imgOv.locked = !imgOv.locked"
          tabindex="-1"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path :d="imgOv.locked ? mdiLockOutline : mdiLockOpenVariant"/>
          </svg>
        </button>
      </div>
      <!-- SE corner drag handle -->
      <div
        class="img-ov-handle"
        @mouseenter="_ovHovered = true"
        @mouseleave="_ovHovered = false"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="onHandleUp"
      ></div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useSettingsStore } from '@/stores/settingsStore'
import { useStoryStore } from '@/stores/storyStore'
import { storageManager } from '@/utils/storage'
import { resolveLocalImages } from '@/utils/imageUtils'
import { tokenizeMarkdown, parseImgDims } from '@/utils/seamlessRenderer'
import { mdiLockOutline, mdiLockOpenVariant } from '@mdi/js'
import {
  buildStructuredHTML,
  getCursorOffset,
  setCursorPosition,
  getSelectionRange,
  updateTokenVisibility,
} from '@/utils/editorCursor'

interface Props {
  content: string
  cursorPos: number
  forceMode?: 'seamless' | 'markdown' | 'preview'
  isReadOnly?: boolean
  // Inline suggestion props (managed by parent)
  suggestionText?: string
  suggestionCount?: number
  suggestionIndex?: number
  suggestionGenerating?: boolean
}

interface Emits {
  'update:content': [value: string]
  'update:cursorPos': [value: number]
  // AI suggestion events
  'trigger-ai':        []
  'accept-suggestion': []
  'dismiss-suggestion':[]
  'next-suggestion':   []
  'prev-suggestion':   []
  'type-char':         [char: string]
  // Link navigation
  'navigate-chapter':  [id: string]
  'navigate-story':    [id: string]
  // Session undo/redo
  'undo':     []
  'redo':     []
  'snapshot': []   // flush current state before a structural edit
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const settingsStore = useSettingsStore()
const storyStore = useStoryStore()

// ─── Image resize overlay state ─────────────────────────────────────
interface ImgOv {
  imgEl:    HTMLImageElement   // the <img> inside the token
  start:    number             // token char start in content
  end:      number             // token char end in content
  src:      string             // clean image src (no surrounding quotes)
  cleanAlt: string             // alt text without |dims suffix
  naturalW: number             // img.naturalWidth  (0 = not loaded yet)
  naturalH: number             // img.naturalHeight
  locked:   boolean            // true = maintain aspect ratio when dragging
}
const imgOv    = ref<ImgOv | null>(null)
const ovRect   = ref<{ left: number; top: number; width: number; height: number } | null>(null)

// Non-reactive drag bookkeeping (avoids unnecessary reactivity overhead)
let _drag = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
let _ovHovered = false

const ovStyle = computed(() => {
  if (!ovRect.value) return {}
  const { left, top, width, height } = ovRect.value
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
})
const ovLabel = computed(() => {
  if (!ovRect.value) return ''
  return `${Math.round(ovRect.value.width)} × ${Math.round(ovRect.value.height)}`
})

const editorInput = ref<HTMLDivElement | null>(null)
let selectionStart = 0
let selectionEnd = 0
let isUpdatingDOM = false
let pendingCursorPos: number | null = null

// ─── Story link annotation ────────────────────────────────────────

/**
 * Walk all [data-url^="story://"] spans and add/remove the 'link-broken' class
 * based on whether the target story ID exists in the local library.
 */
const annotateStoryLinks = (el: HTMLElement): void => {
  const projects = storageManager.getProjectsList()
  const knownIds   = new Set(projects.map((p) => p.id))
  const knownNames = new Set(projects.map((p) => p.name.toLowerCase()))
  el.querySelectorAll<HTMLElement>('[data-url^="story://"]').forEach((span) => {
    const url = span.getAttribute('data-url') ?? ''
    const storyPart = url.slice('story://'.length).split('/')[0]
    const broken = !!storyPart && !knownIds.has(storyPart) && !knownNames.has(storyPart.toLowerCase())
    span.classList.toggle('link-broken', broken)
  })
}

// ─── Ghost DOM injection ──────────────────────────────────────────

/**
 * Remove any previously injected ghost span(s) and normalize text nodes.
 */
const removeGhostSpan = () => {
  if (!editorInput.value) return
  editorInput.value.querySelectorAll('[data-ghost]').forEach(el => {
    const parent = el.parentNode
    el.remove()
    // Merge split text nodes so data-start/end arithmetic stays correct
    if (parent instanceof HTMLElement) parent.normalize()
  })
}

/**
 * Inject the ghost suggestion span inline at the current cursor position so
 * the text flows naturally with the document (wraps like real text).
 */
const injectGhostSpan = () => {
  if (!editorInput.value) return
  removeGhostSpan()

  const displayText = props.suggestionText ||
    (props.suggestionGenerating ? 'generating…' : '')
  if (!displayText) return

  const s = window.getSelection()
  if (!s || s.rangeCount === 0) return

  const insertRange = s.getRangeAt(0).cloneRange()
  insertRange.collapse(true)

  const ghost = document.createElement('span')
  ghost.setAttribute('data-ghost', 'true')
  ghost.setAttribute('contenteditable', 'false')
  ghost.className = props.suggestionGenerating ? 'ghost-loading' : 'ghost-inline'

  if (props.suggestionCount && props.suggestionCount > 1) {
    ghost.appendChild(document.createTextNode(displayText))
    const badge = document.createElement('span')
    badge.className = 'ghost-badge'
    badge.textContent = `${(props.suggestionIndex ?? 0) + 1}/${props.suggestionCount}`
    ghost.appendChild(badge)
  } else {
    ghost.textContent = displayText
  }

  insertRange.insertNode(ghost)

  // Restore cursor to immediately before the ghost span
  const prev = ghost.previousSibling
  if (prev?.nodeType === Node.TEXT_NODE) {
    s.collapse(prev, (prev as Text).length)
  } else {
    const parent = ghost.parentNode!
    const idx = Array.from(parent.childNodes).indexOf(ghost)
    s.collapse(parent, idx)
  }
}

const hasSuggestion = computed(() =>
  !!(props.suggestionText && props.suggestionText.length > 0) || !!props.suggestionGenerating
)

const tokens = computed(() => tokenizeMarkdown(props.content))

// ─── Helpers ───────────────────────────────────────────────────────

const container = () => editorInput.value!
const sel = () => window.getSelection()
const mode = () => props.forceMode ?? 'seamless'
const livePos = () => getCursorOffset(container(), sel())

// ─── Watchers ──────────────────────────────────────────────────────

watch(() => props.cursorPos, () => {
  if (!editorInput.value) return
  // Dismiss overlay when cursor moves inside the image token (it will go source mode)
  if (imgOv.value) {
    const { start, end } = imgOv.value
    const pos = props.cursorPos
    if (pos >= start && pos <= end) dismissImgOv()
  }
  updateTokenVisibility(container(), props.cursorPos, mode())
})

watch(
  () => props.content,
  () => {
    nextTick(() => {
      if (!editorInput.value) return
      isUpdatingDOM = true
      removeGhostSpan()   // strip ghost before rebuilding innerHTML
      editorInput.value.innerHTML = buildStructuredHTML(tokens.value, props.content)

      const target = pendingCursorPos ?? props.cursorPos
      pendingCursorPos = null

      updateTokenVisibility(container(), target, mode())
      annotateStoryLinks(container())
      resolveLocalImages(container(), storyStore.currentStoryId).catch(console.error)
      setCursorPosition(container(), props.content.length, target, sel())

      selectionStart = target
      selectionEnd = target

      isUpdatingDOM = false

      // Re-inject ghost if a suggestion is still active
      if (props.suggestionText || props.suggestionGenerating) injectGhostSpan()
    })
  },
  { immediate: true }
)

// Re-inject (or remove) ghost whenever suggestion text / state changes
watch(
  [() => props.suggestionText, () => props.suggestionGenerating,
   () => props.suggestionIndex, () => props.suggestionCount],
  () => {
    if (props.suggestionText || props.suggestionGenerating) {
      nextTick(() => injectGhostSpan())
    } else {
      removeGhostSpan()
    }
  }
)

// ─── Cursor tracking events ────────────────────────────────────────

/**
 * Show the resize overlay when the mouse enters a rendered image.
 * Does NOT move the cursor or affect editor state.
 */
const handleEditorMouseover = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const imageToken = target.closest<HTMLElement>('.token-image')
  if (imageToken) {
    _ovHovered = false
    const imgEl = imageToken.querySelector('img.md-image') as HTMLImageElement | null
    // Only refresh if it's a different image (or first show)
    if (imgEl && (!imgOv.value || imgOv.value.imgEl !== imgEl)) {
      showImgOverlay(imageToken)
    }
  }
}

/** Dismiss overlay when mouse leaves the editor area (not while dragging or overlay hovered) */
const handleEditorMouseleave = () => {
  // Brief delay allows mouse to move to the topbar (positioned above the editor bounds)
  setTimeout(() => {
    if (!_drag.active && !_ovHovered) dismissImgOv()
  }, 80)
}

const refreshOvRect = () => {
  if (!imgOv.value) return
  const r = imgOv.value.imgEl.getBoundingClientRect()
  ovRect.value = { left: r.left, top: r.top, width: r.width, height: r.height }
}

/**
 * Open the grab-handle overlay for the given .token-image span.
 * Cursor is moved to just before the token so it never sits "inside" the image.
 */
const showImgOverlay = (tokenEl: HTMLElement) => {
  const imgEl = tokenEl.querySelector('img.md-image') as HTMLImageElement | null
  if (!imgEl) return
  const start = parseInt(tokenEl.getAttribute('data-start') ?? '0')
  const end   = parseInt(tokenEl.getAttribute('data-end')   ?? '0')
  const raw   = props.content.slice(start, end)
  const m     = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
  if (!m) return
  const src = m[2].trim().replace(/^["']|["']$/g, '')
  const { cleanAlt, dimW, dimH } = parseImgDims(m[1])
  // Infer initial lock state from the stored dims:
  // if BOTH W and H are explicitly saved the user previously unlocked → start unlocked.
  // Preserve the previous lock state when re-hovering the exact same img element.
  const prevLocked = (imgOv.value?.imgEl === imgEl) ? imgOv.value!.locked : undefined
  const defaultLocked = prevLocked ?? !(dimW && dimH)
  imgOv.value = {
    imgEl, start, end, src, cleanAlt,
    naturalW: imgEl.naturalWidth,
    naturalH: imgEl.naturalHeight,
    locked: defaultLocked,
  }
  refreshOvRect()
  // Do NOT move cursor — hover should never disrupt typing position
}

// Dismiss overlay. Only clean up drag-induced inline styles if one was in progress
// (pre-existing styles like style="width:300px;height:200px" must NOT be cleared).
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

// ─── Pointer drag handlers (bound to the SE resize handle) ───────────────────

const onHandleDown = (e: PointerEvent) => {
  if (!imgOv.value) return
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  const { imgEl } = imgOv.value
  _drag.active  = true
  _drag.startX  = e.clientX
  _drag.startY  = e.clientY
  _drag.startW  = imgEl.offsetWidth
  _drag.startH  = imgEl.offsetHeight
  // Remove CSS size caps during interactive drag
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
  // Restore CSS caps
  imgEl.style.maxWidth  = ''
  imgEl.style.maxHeight = ''
  const newW = Math.round(imgEl.offsetWidth)
  const newH = Math.round(imgEl.offsetHeight)
  // locked → only store W (CSS height:auto handles aspect ratio)
  // unlocked → always store both W and H explicitly
  const dimStr = locked ? `w${newW}` : `w${newW} h${newH}`
  // Clear inline styles — re-render will use the attribute-based size instead
  imgEl.style.width  = ''
  imgEl.style.height = ''
  emit('snapshot')
  const newToken   = `![${cleanAlt}|${dimStr}](${src})`
  const newContent = props.content.slice(0, start) + newToken + props.content.slice(end)
  emit('update:content', newContent)
  imgOv.value = null
  ovRect.value = null
}

// Track overlay position on scroll / resize while it is open
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

/**
 * Handle clicks inside the editor.
 * Clicking the editor places the cursor normally and switches any image under it to source view.
 * Ctrl+click on links navigates. The image overlay is dismissed on click.
 */
const handleEditorClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  // Dismiss overlay when clicking — clicking moves cursor, image will go source mode
  if (imgOv.value) dismissImgOv()

  if (event.ctrlKey || event.metaKey) {
    const linkSpan = target.closest<HTMLElement>('.token-link[data-url]')
    if (linkSpan) {
      const url = linkSpan.getAttribute('data-url') ?? ''
      if (url.startsWith('chapter://')) { emit('navigate-chapter', url.slice('chapter://'.length)); return }
      if (url.startsWith('story://'))   { emit('navigate-story',   url.slice('story://'.length)); return }
      if (url.startsWith('http://') || url.startsWith('https://')) { openUrl(url).catch(console.error); return }
    }
  }
  onCursorActivity()
}


const onCursorActivity = () => {
  if (isUpdatingDOM) return
  const pos = livePos()
  // Dismiss suggestion on arbitrary cursor repositioning (click / mouseup)
  if (hasSuggestion.value) {
    removeGhostSpan()          // immediate visual removal
    emit('dismiss-suggestion')
  }
  emit('update:cursorPos', pos)
  updateTokenVisibility(container(), pos, mode())
}

const onKeyup = (e: KeyboardEvent) => {
  // ↑/↓ are handled in keydown when a suggestion is active — don't let
  // keyup trigger onCursorActivity (which would dismiss the suggestion).
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && hasSuggestion.value) return
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) {
    onCursorActivity()
  }
}

// ─── Input handling ────────────────────────────────────────────────

const handleKeydown = (event: KeyboardEvent) => {
  const pos = livePos()

  // Read-only chapters: block all editing interactions
  if (props.isReadOnly) return

  // Close image overlay on Escape
  if (event.key === 'Escape' && imgOv.value) {
    dismissImgOv()
    event.preventDefault()
    return
  }

  // ── Session undo/redo ──────────────────────────────────────────────
  // Note: event.key is uppercase ('Z') when Shift is held, so compare lowercase.
  const k = event.key.toLowerCase()
  if (k === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
    event.preventDefault()
    emit('undo')
    return
  }
  if (
    (k === 'y' && (event.ctrlKey || event.metaKey)) ||
    (k === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey)
  ) {
    event.preventDefault()
    emit('redo')
    return
  }

  // ── Snapshot before structural edits ─────────────────────────────────
  // Save the current state immediately so undo can restore it after the edit.
  if (
    (event.key === 'Enter' || event.key === 'Delete' || event.key === 'Tab') &&
    !event.ctrlKey && !event.metaKey
  ) {
    emit('snapshot')
  }

  // ── Ctrl+Space → trigger AI generation ─────────────────────────────────────
  if (event.key === ' ' && event.ctrlKey && !event.shiftKey) {
    event.preventDefault()
    emit('trigger-ai')
    return
  }

  // ── When a suggestion is active, intercept special keys ─────────
  if (hasSuggestion.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      emit('dismiss-suggestion')
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      emit('prev-suggestion')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      emit('next-suggestion')
      return
    }
    // Left/Right arrows move the cursor — dismiss the suggestion
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      emit('dismiss-suggestion')
      // fall through — let the arrow key move the cursor normally
    }
    if (event.key === 'Backspace') {
      emit('dismiss-suggestion')
      // let normal backspace proceed
    }
    // Printable character — signal parent before input fires
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      emit('type-char', event.key)
      // Don't return — let the character be typed normally
    }
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    if (selectionStart !== selectionEnd) {
      pendingCursorPos = selectionStart + 1
      emit('update:content', props.content.slice(0, selectionStart) + '\n' + props.content.slice(selectionEnd))
      emit('update:cursorPos', pendingCursorPos)
    } else {
      pendingCursorPos = pos + 1
      emit('update:content', props.content.slice(0, pos) + '\n' + props.content.slice(pos))
      emit('update:cursorPos', pendingCursorPos)
    }
    return
  }

  if (event.key === 'Delete') {
    event.preventDefault()
    if (selectionStart !== selectionEnd) {
      pendingCursorPos = selectionStart
      emit('update:content', props.content.slice(0, selectionStart) + props.content.slice(selectionEnd))
      emit('update:cursorPos', pendingCursorPos)
    } else if (pos < props.content.length) {
      pendingCursorPos = pos
      emit('update:content', props.content.slice(0, pos) + props.content.slice(pos + 1))
      emit('update:cursorPos', pendingCursorPos)
    }
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    if (hasSuggestion.value) {
      emit('accept-suggestion')
    } else if (selectionStart !== selectionEnd) {
      pendingCursorPos = selectionStart + 2
      emit('update:content', props.content.slice(0, selectionStart) + '  ' + props.content.slice(selectionEnd))
      emit('update:cursorPos', pendingCursorPos)
    } else {
      pendingCursorPos = pos + 2
      emit('update:content', props.content.slice(0, pos) + '  ' + props.content.slice(pos))
      emit('update:cursorPos', pendingCursorPos)
    }
    return
  }

  // For all other keys: record live selection range for use in onInput
  const s = sel()
  if (s && !s.isCollapsed) {
    const [start, end] = getSelectionRange(container(), s)
    selectionStart = start
    selectionEnd = end
  } else {
    selectionStart = pos
    selectionEnd = pos
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  if (props.isReadOnly) return
  emit('snapshot')    // save pre-paste state
  const pos = livePos()
  const text = event.clipboardData?.getData('text/plain') || ''

  if (selectionStart !== selectionEnd) {
    const pasteStart = selectionStart
    const pasteEnd = selectionEnd
    pendingCursorPos = pasteStart + text.length
    selectionStart = pendingCursorPos
    selectionEnd = pendingCursorPos
    emit('update:content', props.content.slice(0, pasteStart) + text + props.content.slice(pasteEnd))
    emit('update:cursorPos', pendingCursorPos)
  } else {
    pendingCursorPos = pos + text.length
    selectionStart = pendingCursorPos
    selectionEnd = pendingCursorPos
    emit('update:content', props.content.slice(0, pos) + text + props.content.slice(pos))
    emit('update:cursorPos', pendingCursorPos)
  }
}

const handleCut = (event: ClipboardEvent) => {
  event.preventDefault()
  if (props.isReadOnly) return
  emit('snapshot')    // save pre-cut state
  if (selectionStart !== selectionEnd) {
    const cutEnd = selectionEnd
    event.clipboardData?.setData('text/plain', props.content.slice(selectionStart, cutEnd))
    pendingCursorPos = selectionStart
    selectionEnd = selectionStart
    emit('update:content', props.content.slice(0, selectionStart) + props.content.slice(cutEnd))
    emit('update:cursorPos', pendingCursorPos)
  }
}

const onInput = (event: InputEvent) => {
  if (isUpdatingDOM) return

  if (event.data) {
    if (selectionStart !== selectionEnd) {
      pendingCursorPos = selectionStart + event.data.length
      emit('update:content', props.content.slice(0, selectionStart) + event.data + props.content.slice(selectionEnd))
      emit('update:cursorPos', pendingCursorPos)
    } else {
      const pos = selectionStart
      pendingCursorPos = pos + event.data.length
      emit('update:content', props.content.slice(0, pos) + event.data + props.content.slice(pos))
      emit('update:cursorPos', pendingCursorPos)
    }
  } else {
    // Deletion (backspace)
    if (selectionStart !== selectionEnd) {
      pendingCursorPos = selectionStart
      emit('update:content', props.content.slice(0, selectionStart) + props.content.slice(selectionEnd))
      emit('update:cursorPos', pendingCursorPos)
    } else if (selectionStart > 0) {
      pendingCursorPos = selectionStart - 1
      emit('update:content', props.content.slice(0, selectionStart - 1) + props.content.slice(selectionStart))
      emit('update:cursorPos', pendingCursorPos)
    }
  }
}

// Expose the scroll container so a parent can attach scroll-sync listeners
defineExpose({ scrollEl: editorInput })
</script>

<style scoped>
.readonly-banner {
  padding: 6px 16px;
  background: transparent;
  border-bottom: 1px dashed var(--border-color);
  font-size: 11px;
  color: var(--text-muted);
  user-select: none;
  opacity: 0.75;
  flex-shrink: 0;
}

.editor-input--readonly {
  cursor: default;
  opacity: 0.9;
}

.editor-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-input {
  flex: 1;
  padding: var(--spacing-md);
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  caret-color: var(--accent-color);
  font-family: var(--editor-font-family, 'Fira Code', 'Courier New', monospace);
  font-size: var(--editor-font-size, 14px);
  line-height: var(--editor-line-height, 1.6);
  resize: none;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  outline: none;
}
.editor-input:focus { outline: none; }

/* ── Base token reset ───────────────────────────────────── */
.editor-input :deep(.token) { position: relative; }
.editor-input :deep(.token .marker) { display: none; }

/* ── Rendered: headers ──────────────────────────────────── */
.editor-input :deep(.token-header.rendered) { font-weight: 700; }
.editor-input :deep(.token-header.rendered .marker) { display: none; }
/* Bold inside a heading is already weight-700 from the heading itself;
   bump to 900 (bolder) so it stays visually distinct. */
.editor-input :deep(.token-header.rendered .token-bold.rendered .content) { font-weight: 900; }
.editor-input :deep(.token-header.rendered[data-level="1"]) { font-size: 2em; }
.editor-input :deep(.token-header.rendered[data-level="2"]) { font-size: 1.6em; }
.editor-input :deep(.token-header.rendered[data-level="3"]) { font-size: 1.35em; }
.editor-input :deep(.token-header.rendered[data-level="4"]) { font-size: 1.15em; }
.editor-input :deep(.token-header.rendered[data-level="5"]) { font-size: 1.05em; }
.editor-input :deep(.token-header.rendered[data-level="6"]) { font-size: 1em; font-weight: 600; }

/* ── Rendered: bold ─────────────────────────────────────── */
.editor-input :deep(.token-bold.rendered .marker) { display: none; }
.editor-input :deep(.token-bold.rendered .content) { font-weight: 700; }

/* ── Rendered: italic ───────────────────────────────────── */
.editor-input :deep(.token-italic.rendered .marker) { display: none; }
.editor-input :deep(.token-italic.rendered .content) { font-style: italic; }

/* ── Rendered: strikethrough ────────────────────────────── */
.editor-input :deep(.token-strikethrough.rendered .marker) { display: none; }
.editor-input :deep(.token-strikethrough.rendered .content) { text-decoration: line-through; opacity: 0.6; }

/* ── Rendered: inline code ──────────────────────────────── */
.editor-input :deep(.token-code.rendered .marker) { display: none; }
.editor-input :deep(.token-code.rendered .content) {
  background-color: var(--bg-tertiary);
  color: var(--accent-color);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

/* ── Rendered: list items ───────────────────────────────── */
.editor-input :deep(.token-list.rendered .marker) { display: none; }
/* Use child combinator (>) so padding-left and ::before only apply to the
   direct .content of the list token, not to nested inline .content spans. */
.editor-input :deep(.token-list.rendered > .content) { position: relative; padding-left: 1.2em; }
.editor-input :deep(.token-list.rendered > .content::before) {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent-color);
  font-weight: 700;
}/* Indented bullets: 1.5em extra per nesting level, applied as margin-left
   so the whole bullet+text block shifts right (not just the text). */
.editor-input :deep(.token-list.rendered[data-indent="1"] > .content) { margin-left: 1.5em; }
.editor-input :deep(.token-list.rendered[data-indent="2"] > .content) { margin-left: 3em; }
.editor-input :deep(.token-list.rendered[data-indent="3"] > .content) { margin-left: 4.5em; }
.editor-input :deep(.token-list.rendered[data-indent="4"] > .content) { margin-left: 6em; }

/* ── Rendered: horizontal rule ──────────────────────────── */
.editor-input :deep(.token-hr.rendered .marker) { display: none; }
.editor-input :deep(.token-hr.rendered) {
  display: block;
  border-top: 2px solid var(--border-color);
  margin: 0.8em 0;
}

/* ── Rendered: blockquote ───────────────────────────────── */
.editor-input :deep(.token-blockquote.rendered .marker) { display: none; }
.editor-input :deep(.token-blockquote.rendered) {
  display: block;
  border-left: 3px solid var(--accent-color);
  padding-left: 0.9em;
  color: var(--text-secondary);
  font-style: italic;
}
.editor-input :deep(.token-blockquote.rendered[data-level="2"]) { margin-left: 1.2em; }
.editor-input :deep(.token-blockquote.rendered[data-level="3"]) { margin-left: 2.4em; }

/* ── Rendered: ordered list ─────────────────────────────── */
.editor-input :deep(.token-ordered.rendered .marker) { display: none; }
.editor-input :deep(.token-ordered.rendered > .content) { position: relative; padding-left: 1.8em; }
.editor-input :deep(.token-ordered.rendered > .content::before) {
  content: attr(data-order) '.';
  position: absolute;
  left: 0;
  color: var(--accent-color);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.editor-input :deep(.token-ordered.rendered[data-indent="1"] > .content) { margin-left: 1.5em; }
.editor-input :deep(.token-ordered.rendered[data-indent="2"] > .content) { margin-left: 3em; }
.editor-input :deep(.token-ordered.rendered[data-indent="3"] > .content) { margin-left: 4.5em; }

/* ── Rendered: fenced code block ────────────────────────── */
.editor-input :deep(.token-fenced.rendered) {
  display: block;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 0.6em 0.8em;
  margin: 0.4em 0;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.88em;
  overflow-x: auto;
}
.editor-input :deep(.token-fenced.rendered .marker) { display: none; }
.editor-input :deep(.token-fenced.rendered .lang-label) {
  display: block;
  font-size: 0.75em;
  color: var(--text-tertiary);
  margin-bottom: 0.3em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.editor-input :deep(.token-fenced.rendered .content pre) {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

/* ── Rendered: table — ghost HTML table visible, source hidden ──── */
/* Block wrapper for the token itself */
.editor-input :deep(.token-table) {
  display: block;
  margin: 0.3em 0;
}
/* Source text: hidden by default (rendered state), visible in source state */
.editor-input :deep(.token-table .table-source) {
  display: none;
}
.editor-input :deep(.token-table.source .table-source) {
  display: inline;
  white-space: pre;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
}
.editor-input :deep(.token-table.source .marker) {
  color: var(--accent-color);
  font-weight: 700;
}
/* Ghost table: hidden by default, shown in rendered state */
.editor-input :deep(.token-table .table-render) {
  display: none;
}
.editor-input :deep(.token-table.rendered .table-render) {
  display: block;
}
.editor-input :deep(.token-table .table-render table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.92em;
}
.editor-input :deep(.token-table .table-render th),
.editor-input :deep(.token-table .table-render td) {
  border: 1px solid var(--border-color);
  padding: 3px 10px;
  text-align: left;
  font-weight: normal;
  color: var(--text-primary);
}
.editor-input :deep(.token-table .table-render thead th) {
  background: color-mix(in srgb, var(--accent-color) 10%, var(--bg-secondary));
  font-weight: 600;
}
.editor-input :deep(.token-table .table-render tbody tr:nth-child(even) td) {
  background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
}
/* Ghost table must not be collapsed by the source-reset block */
.editor-input :deep(.token-table.source .table-render) {
  display: none !important;
}

/* ── Rendered: inline image ────────────────────────────────── */
.editor-input :deep(.token-image.rendered .marker) { display: none; }
.editor-input :deep(.token-image.rendered .content) { display: none; }
/* Image render spans are data-ghost for cursor math but must receive mouse events
   so the mouseover overlay trigger works on the visible image area. */
.editor-input :deep(.token-image .image-render) {
  display: none;
  pointer-events: none;   /* not rendered — suppress events */
}
.editor-input :deep(.token-image.rendered .image-render) {
  display: inline-block;
  vertical-align: middle;
  pointer-events: auto;   /* rendered — enable mouse events so hover detection works */
}
/* Default cap for images without any explicit size */
.editor-input :deep(.token-image.rendered .image-render img.md-image:not([width]):not([style])) {
  max-height: 160px;
  max-width: min(100%, 480px);
}
/* Images with any explicit dimension — remove caps to honour author-set size */
.editor-input :deep(.token-image.rendered .image-render img.md-image[width]),
.editor-input :deep(.token-image.rendered .image-render img.md-image[style]) {
  max-height: unset;
  max-width: unset;
}
.editor-input :deep(.token-image.rendered .image-render img.md-image) {
  height: auto;
  border-radius: 4px;
  vertical-align: middle;
  cursor: pointer;
  display: block;
}
/* Broken local image (file not found after resolution attempt) */
.editor-input :deep(.token-image.rendered .image-render img.md-image-broken) {
  min-width: 80px;
  min-height: 40px;
  border: 2px dashed var(--error-color);
  opacity: 0.5;
  cursor: pointer;
}

/* ── Rendered: inline link ──────────────────────────────── */
.editor-input :deep(.token-link.rendered .marker) { display: none; }
.editor-input :deep(.token-link.rendered .content) {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}

/* Broken story:// links — story not found in the library */
.editor-input :deep(.token-link.rendered.link-broken .content) {
  color: var(--error-color);
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: 0.8;
}
.editor-input :deep(.token-link.source.link-broken .content) {
  color: var(--error-color);
  opacity: 0.8;
}

/* ── Source mode: show raw markdown ─────────────────────── */
.editor-input :deep(.token.source .marker) {
  display: inline !important;
  background-color: color-mix(in srgb, var(--accent-color) 15%, transparent);
  padding: 1px 3px;
  border-radius: 2px;
  color: var(--text-secondary);
}
.editor-input :deep(.token.source .content) {
  font-weight: normal !important;
  font-style: normal !important;
  text-decoration: none !important;
  opacity: 1 !important;
  background-color: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-size: 1em !important;
  padding-left: 0 !important;
}
/* Suppress the list bullet on nested .content spans too when in source mode */
.editor-input :deep(.token.source .content::before) { display: none !important; }
.editor-input :deep(.token-list.rendered > .content > .token.source .content::before) { display: none !important; }
.editor-input :deep(.token-header.source),
.editor-input :deep(.token-bold.source),
.editor-input :deep(.token-italic.source),
.editor-input :deep(.token-strikethrough.source),
.editor-input :deep(.token-code.source),
.editor-input :deep(.token-list.source),
.editor-input :deep(.token-hr.source),
.editor-input :deep(.token-blockquote.source),
.editor-input :deep(.token-ordered.source),
.editor-input :deep(.token-fenced.source),
.editor-input :deep(.token-table.source),
.editor-input :deep(.token-image.source),
.editor-input :deep(.token-link.source) {
  font-weight: normal !important;
  font-style: normal !important;
  text-decoration: none !important;
  background-color: transparent !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-size: 1em !important;
  border: none !important;
  border-left: none !important;
  color: inherit !important;
  display: inline !important;
  margin: 0 !important;
}

/* ── Inline AI ghost text (injected directly into the contenteditable) ── */
.editor-input :deep([data-ghost]) {
  pointer-events: none;
  user-select: none;
}
.editor-input :deep(.ghost-inline) {
  color: var(--text-tertiary);
  opacity: 0.6;
  font-style: italic;
}
.editor-input :deep(.ghost-loading) {
  color: var(--text-tertiary);
  opacity: 0.45;
  font-style: italic;
  animation: pulse 1.2s ease-in-out infinite;
}
.editor-input :deep(.ghost-badge) {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 5px;
  font-size: 10px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-tertiary);
  vertical-align: middle;
  opacity: 0.8;
  font-style: normal;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50%       { opacity: 0.6; }
}
</style>

<!-- Grab-handle image overlay (teleported to <body> — cannot be scoped) -->
<style>
/* Outer selection frame — sits exactly over the rendered image */
.img-ov {
  position: fixed;
  z-index: 9900;
  pointer-events: none;           /* overlay itself is transparent to clicks … */
  border: 2px solid var(--accent-color);
  border-radius: 3px;
  box-sizing: border-box;
}
/* … except for the children that need interaction */
.img-ov > * { pointer-events: auto; }

/* Top-left info bar */
.img-ov-topbar {
  position: absolute;
  top: -26px;
  left: -2px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--accent-color);
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px 3px 0 0;
  white-space: nowrap;
  user-select: none;
}
.img-ov-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 1px;
  border-radius: 3px;
  color: #fff;
  opacity: 0.75;
  transition: opacity 0.1s, background 0.1s;
}
.img-ov-lock:hover {
  opacity: 1;
  background: rgba(255,255,255,0.15);
}
.img-ov-lock.unlocked { opacity: 0.45; }
.img-ov-lock.unlocked:hover { opacity: 0.85; }

/* SE corner drag handle */
.img-ov-handle {
  position: absolute;
  bottom: -6px;
  right: -6px;
  width: 14px;
  height: 14px;
  background: var(--accent-color);
  border: 2px solid #fff;
  border-radius: 3px;
  cursor: nwse-resize;
  box-shadow: 0 1px 4px rgba(0,0,0,0.35);
  touch-action: none;      /* required for Pointer Events to work on touch */
}
</style>
