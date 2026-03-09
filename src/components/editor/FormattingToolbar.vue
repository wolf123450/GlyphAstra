<template>
  <div class="formatting-toolbar">
    <button
      v-for="btn in buttons"
      :key="btn.label"
      class="tb-fmt-btn"
      :title="btn.title"
      @mousedown.prevent="btn.action()"
    >
      <AppIcon v-if="btn.icon" :path="btn.icon" :size="15" />
      <span v-else class="tb-fmt-text">{{ btn.glyph }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { getSelectionRange } from '@/utils/editor/editorCursor'
import {
  mdiFormatBold,
  mdiFormatItalic,
  mdiFormatStrikethrough,
  mdiCodeTags,
  mdiLinkVariant,
  mdiFormatHeader1,
  mdiFormatHeader2,
  mdiFormatHeader3,
  mdiFormatQuoteOpen,
  mdiFormatListBulleted,
  mdiFormatListNumbered,
  mdiMinus,
  mdiImageOutline,
} from '@mdi/js'

const props = defineProps<{
  /** Current plain-text content of the editor */
  content: string
  /** Current cursor position (byte offset into content) */
  cursorPos: number
  /** Whether the toolbar is disabled (preview mode / no chapter) */
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when toolbar inserts/wraps text; caller replaces content + moves cursor */
  (e: 'insert', payload: { content: string; cursorPos: number }): void
}>()

// ── Insert helpers ────────────────────────────────────────────────────────────

interface WrapOptions {
  /** Syntax wrapping both sides: ** for bold, * for italic, etc. */
  wrap?: string
  /** Prefix inserted at start of current line: ## for h2, > for quote, etc. */
  linePrefix?: string
  /** Full snippet inserted at cursor when no selection and no line-prefix */
  snippet?: string
  /** The placeholder text shown inside the snippet (will be "selected" on insert) */
  placeholder?: string
}

function apply(opts: WrapOptions) {
  if (props.disabled) return

  const text   = props.content
  const cursor = props.cursorPos

  // Read the live browser selection from the contenteditable (which is still
  // focused because we used @mousedown.prevent on every button).
  const active = document.activeElement as HTMLElement | null
  let selStart = cursor
  let selEnd   = cursor
  if (active && active.isContentEditable) {
    const [s, e] = getSelectionRange(active, window.getSelection())
    if (e > s) { selStart = s; selEnd = e }
  }

  const hasSelection = selEnd > selStart
  const selected     = hasSelection ? text.slice(selStart, selEnd) : ''

  if (opts.wrap) {
    const w = opts.wrap
    if (hasSelection) {
      // Wrap selection
      const newContent = text.slice(0, selStart) + w + selected + w + text.slice(selEnd)
      emit('insert', { content: newContent, cursorPos: selStart + w.length + selected.length + w.length })
    } else {
      // Insert placeholder with cursor after opening wrap so user types inside it
      const ph = opts.placeholder ?? 'text'
      const newContent = text.slice(0, cursor) + w + ph + w + text.slice(cursor)
      emit('insert', { content: newContent, cursorPos: cursor + w.length })
    }
    return
  }

  if (opts.linePrefix) {
    // Insert prefix at the start of the line containing the cursor
    const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
    const alreadyPrefixed = text.slice(lineStart).startsWith(opts.linePrefix)
    if (alreadyPrefixed) {
      // Toggle off
      const newContent = text.slice(0, lineStart) + text.slice(lineStart + opts.linePrefix.length)
      emit('insert', { content: newContent, cursorPos: Math.max(lineStart, cursor - opts.linePrefix.length) })
    } else {
      const newContent = text.slice(0, lineStart) + opts.linePrefix + text.slice(lineStart)
      emit('insert', { content: newContent, cursorPos: cursor + opts.linePrefix.length })
    }
    return
  }

  if (opts.snippet) {
    const newContent = text.slice(0, cursor) + opts.snippet + text.slice(cursor)
    const ph = opts.placeholder
    const phStart = ph ? newContent.indexOf(ph, cursor) : cursor + opts.snippet.length
    emit('insert', { content: newContent, cursorPos: ph ? phStart + ph.length : phStart })
  }
}

// ── Button definitions ────────────────────────────────────────────────────────

const buttons = [
  {
    label: 'bold',
    icon: mdiFormatBold,
    title: 'Bold (Ctrl+B)',
    action: () => apply({ wrap: '**', placeholder: 'bold text' }),
  },
  {
    label: 'italic',
    icon: mdiFormatItalic,
    title: 'Italic (Ctrl+I)',
    action: () => apply({ wrap: '*', placeholder: 'italic text' }),
  },
  {
    label: 'strike',
    icon: mdiFormatStrikethrough,
    title: 'Strikethrough',
    action: () => apply({ wrap: '~~', placeholder: 'strikethrough' }),
  },
  {
    label: 'code',
    icon: mdiCodeTags,
    title: 'Inline code',
    action: () => apply({ wrap: '`', placeholder: 'code' }),
  },
  {
    label: 'link',
    icon: mdiLinkVariant,
    title: 'Link',
    action: () => apply({ snippet: '[link text](url)', placeholder: 'url' }),
  },
  {
    label: 'h1',
    icon: mdiFormatHeader1,
    title: 'Heading 1',
    action: () => apply({ linePrefix: '# ' }),
  },
  {
    label: 'h2',
    icon: mdiFormatHeader2,
    title: 'Heading 2',
    action: () => apply({ linePrefix: '## ' }),
  },
  {
    label: 'h3',
    icon: mdiFormatHeader3,
    title: 'Heading 3',
    action: () => apply({ linePrefix: '### ' }),
  },
  {
    label: 'quote',
    icon: mdiFormatQuoteOpen,
    title: 'Blockquote',
    action: () => apply({ linePrefix: '> ' }),
  },
  {
    label: 'ul',
    icon: mdiFormatListBulleted,
    title: 'Unordered list',
    action: () => apply({ linePrefix: '- ' }),
  },
  {
    label: 'ol',
    icon: mdiFormatListNumbered,
    title: 'Ordered list',
    action: () => apply({ linePrefix: '1. ' }),
  },
  {
    label: 'hr',
    icon: mdiMinus,
    title: 'Horizontal rule',
    action: () => apply({ snippet: '\n\n---\n\n' }),
  },
  {
    label: 'image',
    icon: mdiImageOutline,
    title: 'Image',
    action: () => apply({ snippet: '![alt text](url)', placeholder: 'url' }),
  },
] as { label: string; icon?: string; glyph?: string; title: string; action: () => void }[]
</script>

<style scoped>
.formatting-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px var(--spacing-sm);
  height: 34px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.formatting-toolbar::-webkit-scrollbar { display: none; }

.tb-fmt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.tb-fmt-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-color);
}
.tb-fmt-text {
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
  line-height: 1;
  pointer-events: none;
}
</style>
