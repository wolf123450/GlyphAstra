<template>
  <div class="editor-wrapper">
    <div
      ref="editorInput"
      class="editor-input"
      contenteditable="plaintext-only"
      :spellcheck="settingsStore.settings.spellCheck"
      @input="onInput"
      @click="handleEditorClick"
      @keydown="handleKeydown"
      @keyup="onKeyup"
      @mouseup="onCursorActivity"
      @paste="handlePaste"
      @cut="handleCut"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useSettingsStore } from '@/stores/settingsStore'
import { tokenizeMarkdown } from '@/utils/seamlessRenderer'
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
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const settingsStore = useSettingsStore()

const editorInput = ref<HTMLDivElement | null>(null)
let selectionStart = 0
let selectionEnd = 0
let isUpdatingDOM = false
let pendingCursorPos: number | null = null

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
 * Handle Ctrl+click on a rendered link token.
 * External URLs open in the system browser; chapter:// links navigate within the app.
 */
const handleEditorClick = (event: MouseEvent) => {
  if (event.ctrlKey || event.metaKey) {
    const target = event.target as HTMLElement
    const linkSpan = target.closest<HTMLElement>('.token-link.rendered')
    if (linkSpan) {
      const url = linkSpan.getAttribute('data-url') ?? ''
      if (url.startsWith('chapter://')) {
        emit('navigate-chapter', url.slice('chapter://'.length))
        return
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        openUrl(url).catch(console.error)
        return
      }
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

  // ── Ctrl+Space → trigger AI generation ──────────────────────────
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
</script>

<style scoped>
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

/* ── Rendered: inline link ──────────────────────────────── */
.editor-input :deep(.token-link.rendered .marker) { display: none; }
.editor-input :deep(.token-link.rendered .content) {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
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
