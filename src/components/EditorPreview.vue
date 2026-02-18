<template>
  <div ref="previewDiv" class="editor-preview"></div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { tokenizeMarkdown } from '@/utils/seamlessRenderer'

interface Props {
  content: string
}

const props = defineProps<Props>()

const previewDiv = ref<HTMLDivElement | null>(null)

const tokens = computed(() => {
  return tokenizeMarkdown(props.content)
})

/**
 * Build HTML for rendered tokens (all rendered, no source)
 */
const buildRenderedHTML = (): string => {
  return tokens.value
    .map((token) => token.rendered)
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
</script>

<style scoped>
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

.editor-preview li {
  margin-left: 0;
  margin-bottom: var(--spacing-xs);
}
</style>
