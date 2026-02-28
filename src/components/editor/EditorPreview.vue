<template>
  <div ref="previewDiv" class="editor-preview" @click.capture="handleLinkClick"></div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { tokenizeMarkdown, renderPreview } from '@/utils/editor/seamlessRenderer'
import { storageManager } from '@/utils/storage/storage'
import { useStoryStore } from '@/stores/storyStore'
import { resolveLocalImages } from '@/utils/media/imageUtils'
import { sanitizeHtml } from '@/utils/sanitize'
import { logger } from '@/utils/logger'

interface Props {
  content: string
}

interface Emits {
  'navigate-chapter': [id: string]
  'navigate-story':   [id: string]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const storyStore = useStoryStore()

const previewDiv = ref<HTMLDivElement | null>(null)

/**
 * Intercept all <a> clicks inside the preview.
 * - External URLs (http/https) open in the system browser via plugin-opener.
 * - Internal chapter:// links emit navigate-chapter so the editor can switch chapters.
 * - Internal story:// links emit navigate-story so the app can open a different story.
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

  if (href.startsWith('story://')) {
    emit('navigate-story', href.slice('story://'.length))
    return
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    openUrl(href).catch((e: unknown) => logger.error('Preview', e))
    return
  }
  // All other hrefs (relative paths, etc.) are silently ignored
}

const tokens = computed(() => {
  return tokenizeMarkdown(props.content)
})

/**
 * Build HTML for rendered tokens with proper list grouping and source-line
 * annotations for scroll-sync.
 */
const buildRenderedHTML = (): string => {
  return renderPreview(tokens.value, props.content)
}

/**
 * Walk all story:// <a> elements and add or remove the 'link-broken' class
 * depending on whether the target story ID exists in the local library.
 */
function annotateStoryLinks(container: HTMLElement): void {
  const projects = storageManager.getProjectsList()
  const knownIds   = new Set(projects.map((p) => p.id))
  const knownNames = new Set(projects.map((p) => p.name.toLowerCase()))
  container.querySelectorAll<HTMLAnchorElement>('a[href^="story://"]').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    const storyPart = href.slice('story://'.length).split('/')[0]
    const broken = !!storyPart && !knownIds.has(storyPart) && !knownNames.has(storyPart.toLowerCase())
    a.classList.toggle('link-broken', broken)
  })
}

// Update preview when content changes
watch(
  () => props.content,
  () => {
    nextTick(() => {
      if (previewDiv.value) {
        const html = sanitizeHtml(buildRenderedHTML())
        previewDiv.value.innerHTML = html
        annotateStoryLinks(previewDiv.value)
        resolveLocalImages(previewDiv.value, storyStore.currentStoryId).catch((e: unknown) => logger.error('Preview', e))
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
  white-space: normal;
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
.editor-preview p {
  margin: 0 0 var(--spacing-sm) 0;
}

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
  list-style-type: disc;
  padding-left: 1.5em;
  margin: var(--spacing-sm) 0;
}

.editor-preview ol {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin: var(--spacing-sm) 0;
}

/* Nested lists should not add extra vertical margin */
.editor-preview ul ul,
.editor-preview ul ol,
.editor-preview ol ul,
.editor-preview ol ol {
  margin: 0;
}

.editor-preview li {
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

/* Images */
.editor-preview img.md-image {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  margin: var(--spacing-xs) 0;
  display: block;
}
/* Local image that resolved successfully — no extra treatment needed */
/* Local image that failed to resolve (file not found) */
.editor-preview img.md-image-broken {
  min-width: 120px;
  min-height: 60px;
  background: var(--bg-tertiary);
  border: 2px dashed var(--error-color);
  opacity: 0.5;
}

/* Broken story:// links — story not found in the library */
.editor-preview a.link-broken {
  color: var(--error-color);
  text-decoration: line-through;
  cursor: not-allowed;
  opacity: 0.8;
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
