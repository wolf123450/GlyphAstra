<template>
  <div ref="previewDiv" class="editor-preview" @click.capture="handleLinkClick"></div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { tokenizeMarkdown } from '@/utils/seamlessRenderer'

interface Props {
  content: string
}

interface Emits {
  'navigate-chapter': [id: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const previewDiv = ref<HTMLDivElement | null>(null)

/**
 * Intercept all <a> clicks inside the preview.
 * - External URLs (http/https) open in the system browser via plugin-opener.
 * - Internal chapter:// links emit navigate-chapter so the editor can switch chapters.
 * - Everything else is blocked (no navigation inside the Tauri WebView).
 */
const handleLinkClick = (event: MouseEvent) => {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor) return

  event.preventDefault()
  event.stopPropagation()

  const href = anchor.getAttribute('href') ?? ''

  if (href.startsWith('chapter://')) {
    const chapterId = href.slice('chapter://'.length)
    emit('navigate-chapter', chapterId)
    return
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    openUrl(href).catch(console.error)
    return
  }
  // All other hrefs (relative paths, etc.) are silently ignored
}

const tokens = computed(() => {
  return tokenizeMarkdown(props.content)
})

/**
 * Inject data-source-line="N" into the outermost opening tag of an HTML string.
 * This lets the scroll-sync logic identify which source line a rendered block corresponds to.
 */
function withSourceLine(html: string, line: number): string {
  return html.replace(/^(<[a-zA-Z][a-zA-Z0-9]*)([\s>])/, `$1 data-source-line="${line}"$2`)
}

/**
 * Build HTML for rendered tokens (all rendered, no source).
 * Each block gets a data-source-line attribute matching its first source line.
 */
const buildRenderedHTML = (): string => {
  return tokens.value
    .map((token) => {
      const line = props.content.slice(0, token.start).split('\n').length - 1
      return withSourceLine(token.rendered, line)
    })
    .join('')
}

// Update preview when content changes
watch(
  () => props.content,
  () => {
    nextTick(() => {
      if (previewDiv.value) {
        const html = buildRenderedHTML()
        previewDiv.value.innerHTML = html
      }
    })
  },
  { immediate: true }
)

// Expose the scroll container for scroll-sync use by a parent
defineExpose({ scrollEl: previewDiv })
</script>

<!-- Not scoped: content is injected via innerHTML and scoped selectors
     (which append [data-v-xxx] to the deepest rule) would never match those
     dynamically-created elements. All rules are prefixed with .editor-preview
     so there is no risk of global style leakage. -->
<style>
.editor-preview {
  flex: 1;
  padding: var(--spacing-md);
  overflow-y: auto;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  user-select: text;
  color: var(--text-primary);
}

/* Header styling */
.editor-preview h1,
.editor-preview h2,
.editor-preview h3,
.editor-preview h4,
.editor-preview h5,
.editor-preview h6 {
  font-weight: 600;
  margin: var(--spacing-lg) 0 var(--spacing-md) 0;
}

.editor-preview h1 {
  font-size: 1.8em;
}

.editor-preview h2 {
  font-size: 1.6em;
}

.editor-preview h3 {
  font-size: 1.4em;
}

.editor-preview h4 {
  font-size: 1.2em;
}

.editor-preview h5 {
  font-size: 1.1em;
}

.editor-preview h6 {
  font-size: 1em;
}

/* Text styling */
.editor-preview strong {
  font-weight: 600;
}

.editor-preview em {
  font-style: italic;
}

.editor-preview del {
  text-decoration: line-through;
  opacity: 0.6;
}

.editor-preview code {
  background-color: var(--bg-tertiary);
  color: var(--accent-color);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

/* Lists */
.editor-preview ul {
  list-style-position: inside;
  list-style-type: disc;
  padding: 0;
  margin: var(--spacing-sm) 0;
}

.editor-preview ol {
  list-style-position: inside;
  list-style-type: decimal;
  padding: 0;
  margin: var(--spacing-sm) 0;
}

.editor-preview li {
  margin-left: 0;
  margin-bottom: var(--spacing-xs);
}

/* Blockquote */
.editor-preview blockquote {
  border-left: 3px solid var(--accent-color);
  margin: var(--spacing-sm) 0;
  padding: var(--spacing-xs) var(--spacing-md);
  color: var(--text-secondary);
  font-style: italic;
  background-color: var(--bg-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* Links */
.editor-preview a {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}

/* Horizontal rule */
.editor-preview hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: var(--spacing-lg) 0;
}

/* Preformatted / fenced code */
.editor-preview pre {
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  overflow-x: auto;
  margin: var(--spacing-sm) 0;
  white-space: pre;
}

.editor-preview pre code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: 0.9em;
}

/* Tables */
.editor-preview table {
  border-collapse: collapse;
  width: 100%;
  margin: var(--spacing-sm) 0;
  white-space: normal;
}

.editor-preview th,
.editor-preview td {
  border: 1px solid var(--border-color);
  padding: var(--spacing-xs) var(--spacing-sm);
  text-align: left;
}

.editor-preview thead th {
  background-color: var(--bg-tertiary);
  font-weight: 600;
}

.editor-preview tbody tr:nth-child(even) {
  background-color: var(--bg-secondary);
}</style>
