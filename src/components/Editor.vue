<template>
  <div class="editor-panel">
    <div class="editor-header">
      <div class="editor-title">
        <h2 v-if="currentChapter">{{ currentChapter.name }}</h2>
        <h2 v-else>No chapter selected</h2>
      </div>
      <div class="editor-controls">
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'markdown' }"
          @click="setRenderMode('markdown')"
          title="Show all markdown"
        >
          ⁋
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'seamless' }"
          @click="setRenderMode('seamless')"
          title="Seamless editing"
        >
          ≈
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'preview' }"
          @click="setRenderMode('preview')"
          title="Preview mode"
        >
          ▣
        </button>
        <div class="separator"></div>
        <button
          class="action-btn"
          @click="saveChapter"
          :disabled="!isDirty"
          title="Save (Ctrl+S)"
        >
          ⬇
        </button>
      </div>
    </div>

    <div class="editor-body">
      <!-- Preview Mode: Full rendered view only -->
      <div v-if="renderMode === 'preview' && currentChapter" class="preview-only">
        <div class="editor-display preview-render">
          <div v-html="renderedText" class="editor-content"></div>
        </div>
      </div>

      <!-- Edit Modes: Unified textarea + rendered display -->
      <div v-else-if="renderMode !== 'preview' && currentChapter" class="editor-wrapper">
        <!-- Hidden textarea for actual text editing -->
        <textarea
          ref="editorTextarea"
          v-model="content"
          class="editor-textarea-hidden"
          @input="onContentChange"
          @click="updateCursorPos"
          @keyup="updateCursorPos"
          @keydown="updateCursorPos"
        ></textarea>

        <!-- Rendered text display (synced with textarea) -->
        <div class="editor-display">
          <div v-html="renderedText" class="editor-content"></div>
        </div>
      </div>

      <!-- No chapter selected -->
      <div v-else class="editor-empty">
        <p v-if="renderMode === 'preview'">Select a chapter to see the preview</p>
        <p v-else>Select a chapter to start writing</p>
        <p class="text-muted">Create a new chapter using the ⊕ button in the sidebar</p>
      </div>
    </div>

    <!-- Status Bar -->
    <div class="editor-status">
      <span v-if="isDirty" class="status-item unsaved">● Unsaved changes</span>
      <span v-else class="status-item saved">✓ Saved</span>
      <span class="status-item">
        {{ content.length }} characters
      </span>
      <span class="status-item">
        {{ wordCount }} words
      </span>
      <span class="status-item">
        Lines: {{ lineCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'
import { renderMarkdown, type RenderMode } from '@/utils/markdownRenderer'

const storyStore = useStoryStore()
const editorStore = useEditorStore()
const editorTextarea = ref<HTMLTextAreaElement | null>(null)

const currentChapter = computed(() => storyStore.currentChapter)
const isDirty = computed(() => editorStore.isDirty)

const renderMode = ref<RenderMode>('seamless')
const cursorPosition = ref(0)

const content = computed({
  get: () => {
    if (currentChapter.value) {
      return currentChapter.value.content || editorStore.content
    }
    return editorStore.content
  },
  set: (value) => {
    editorStore.setContent(value)
  },
})

const wordCount = computed(() => {
  return content.value
    .trim()
    .split(/\s+/)
    .filter((word: string) => word.length > 0).length
})

const lineCount = computed(() => {
  return content.value.split('\n').length
})

const renderedText = computed(() => {
  return renderMarkdown(content.value, cursorPosition.value, renderMode.value)
})

const setRenderMode = (mode: RenderMode) => {
  renderMode.value = mode
}

const updateCursorPos = () => {
  if (editorTextarea.value) {
    cursorPosition.value = editorTextarea.value.selectionStart
  }
}

const onContentChange = () => {
  editorStore.setContent(content.value)
}

const saveChapter = async () => {
  if (currentChapter.value) {
    const wordCount = content.value
      .trim()
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length
    storyStore.updateChapter(currentChapter.value.id, {
      content: content.value,
      wordCount,
      lastEdited: new Date().toISOString(),
    })
    // Save to storage
    await storyStore.saveStory()
    editorStore.markAsSaved()
  }
}
</script>

<style scoped>
.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.editor-title {
  flex: 1;
  min-width: 200px;
}

.editor-title h2 {
  margin: 0;
  font-size: 18px;
}

.editor-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.mode-btn,
.action-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.mode-btn:hover,
.action-btn:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.mode-btn.active {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.separator {
  width: 1px;
  height: 24px;
  background-color: var(--border-color);
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: var(--spacing-md);
  position: relative;
}

.preview-only {
  flex: 1;
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--bg-secondary);
  overflow: hidden;
}

.preview-render {
  color: var(--text-primary);
  user-select: text;
  pointer-events: auto;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--bg-secondary);
  overflow: hidden;
}

.editor-textarea-hidden {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: var(--spacing-md);
  border: none;
  background-color: transparent;
  color: transparent;
  caret-color: var(--accent-color);
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  z-index: 10;
}

.editor-textarea-hidden:focus {
  outline: none;
}

.editor-display {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  pointer-events: none;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.preview-render {
  pointer-events: auto;
  user-select: text;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.editor-content {
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.editor-content strong {
  font-weight: 600;
}

.editor-content em {
  font-style: italic;
}

.editor-content del {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.editor-content code {
  background-color: var(--bg-tertiary);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 13px;
  font-family: 'Fira Code', 'Courier New', monospace;
}

.editor-content h1,
.editor-content h2,
.editor-content h3,
.editor-content h4,
.editor-content h5,
.editor-content h6 {
  font-weight: 600;
  color: var(--accent-color);
  margin: var(--spacing-md) 0 var(--spacing-sm) 0;
  line-height: 1.4;
}

.editor-content h1 {
  font-size: 1.8em;
}

.editor-content h2 {
  font-size: 1.5em;
}

.editor-content h3 {
  font-size: 1.3em;
}

.editor-content h4 {
  font-size: 1.1em;
}

.editor-content h5 {
  font-size: 1em;
}

.editor-content h6 {
  font-size: 0.95em;
}

.editor-content ul,
.editor-content li {
  margin-left: var(--spacing-lg);
}

.editor-content ul {
  list-style-position: inside;
  list-style-type: disc;
  padding: 0;
  margin: var(--spacing-sm) 0;
}

.editor-content li {
  margin-left: 0;
  margin-bottom: var(--spacing-xs);
}

.editor-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
}

.editor-empty p {
  margin: var(--spacing-sm);
}

.markdown-content {
  color: var(--text-primary);
  line-height: 1.6;
}

.editor-status {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);
}

.status-item {
  display: flex;
  align-items: center;
}

.status-item.unsaved {
  color: var(--warning-color);
  font-weight: 500;
}

.status-item.saved {
  color: var(--success-color);
  font-weight: 500;
}
</style>
