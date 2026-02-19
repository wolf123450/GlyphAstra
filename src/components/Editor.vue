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
          @click="renderMode = 'markdown'"
          title="Show all markdown"
        >
          ⁋
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'seamless' }"
          @click="renderMode = 'seamless'"
          title="Seamless editing"
        >
          ≈
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'preview' }"
          @click="renderMode = 'preview'"
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
        <button
          class="action-btn"
          :class="{ active: isOverviewOpen }"
          @click="toggleOverview"
          title="Story Overview"
        >
          ◨
        </button>
        <button
          class="action-btn"
          :class="{ active: isAIOpen }"
          @click="toggleAI"
          title="AI Assistant (Ctrl+Space)"
        >
          ✦
        </button>
      </div>
    </div>

    <div class="editor-body">
      <!-- Seamless Mode -->
      <EditorSeamless
        v-if="renderMode === 'seamless' && currentChapter"
        :content="content"
        :cursorPos="cursorPosition"
        :suggestion-text="ai.remainingText.value"
        :suggestion-count="ai.totalCount.value"
        :suggestion-index="ai.currentIndex.value"
        :suggestion-generating="ai.isGenerating.value"
        @update:content="content = $event"
        @update:cursorPos="cursorPosition = $event"
        @trigger-ai="onTriggerAI"
        @accept-suggestion="onAcceptSuggestion"
        @dismiss-suggestion="onDismissSuggestion"
        @next-suggestion="onNextSuggestion"
        @prev-suggestion="onPrevSuggestion"
        @type-char="onTypeChar"
      />

      <!-- Markdown Mode -->
      <EditorMarkdown
        v-else-if="renderMode === 'markdown' && currentChapter"
        :content="content"
        :suggestion-text="ai.remainingText.value"
        :suggestion-count="ai.totalCount.value"
        :suggestion-index="ai.currentIndex.value"
        :suggestion-generating="ai.isGenerating.value"
        @update:content="content = $event"
        @update:cursorPos="cursorPosition = $event"
        @trigger-ai="onTriggerAI"
        @accept-suggestion="onAcceptSuggestion"
        @dismiss-suggestion="onDismissSuggestion"
        @next-suggestion="onNextSuggestion"
        @prev-suggestion="onPrevSuggestion"
        @type-char="onTypeChar"
      />

      <!-- Preview Mode -->
      <EditorPreview
        v-else-if="renderMode === 'preview' && currentChapter"
        :content="content"
      />

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
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { autoSaveManager } from '@/utils/autoSave'
import { useAISuggestion } from '@/utils/useAISuggestion'
import type { RenderMode } from '@/utils/seamlessRenderer'
import EditorSeamless from './EditorSeamless.vue'
import EditorMarkdown from './EditorMarkdown.vue'
import EditorPreview from './EditorPreview.vue'

const storyStore = useStoryStore()
const editorStore = useEditorStore()
const uiStore = useUIStore()

const currentChapter = computed(() => storyStore.currentChapter)
const isDirty = computed(() => editorStore.isDirty)
const isOverviewOpen = computed(() => uiStore.activePanel === 'overview')
const isAIOpen = computed(() => uiStore.activePanel === 'ai')

const toggleOverview = () => {
  uiStore.setActivePanel(isOverviewOpen.value ? 'editor' : 'overview')
}

const toggleAI = () => {
  uiStore.setActivePanel(isAIOpen.value ? 'editor' : 'ai')
}

// ─── AI inline suggestions ─────────────────────────────────────────────────
const ai = useAISuggestion()

const onTriggerAI = () => {
  const pos = editorStore.cursorPosition
  ai.trigger(editorStore.content.slice(0, pos))
}

const onAcceptSuggestion = () => {
  const text = ai.acceptFull()
  if (text) editorStore.insertAtCursor(text)
}

const onDismissSuggestion = () => ai.clear()
const onNextSuggestion    = () => ai.next()
const onPrevSuggestion    = () => ai.prev()
const onTypeChar          = (char: string) => ai.tryMatchChar(char)

// Dismiss suggestion when chapter changes
watch(() => storyStore.currentChapterId, () => ai.clear())

const renderMode = ref<RenderMode>('seamless')
const cursorPosition = ref(0)

// editorStore.content is the single source of truth while editing.
// When the chapter changes we flush to storyStore and load the new chapter.
const content = computed({
  get: () => editorStore.content,
  set: (value) => editorStore.setContent(value),
})

/** Flush editor content back into the currently-tracked chapter (if it still exists) */
const flushCurrentChapter = (chapterId: string | null) => {
  if (!chapterId) return
  // Only flush if this chapter belongs to the currently loaded story
  if (!storyStore.getChapterById(chapterId)) return
  const wc = editorStore.content
    .trim()
    .split(/\s+/)
    .filter((w: string) => w.length > 0).length
  storyStore.updateChapter(chapterId, {
    content: editorStore.content,
    wordCount: wc,
    lastEdited: new Date().toISOString(),
  })
}

// When the active chapter changes: save the previous one, load the new one
watch(
  () => storyStore.currentChapterId,
  (newId, oldId) => {
    flushCurrentChapter(oldId ?? null)
    const chapter = newId ? storyStore.getChapterById(newId) : null
    editorStore.loadContent(chapter?.content ?? '')
  }
)

// On mount: initialise editor with the content of the already-selected chapter
onMounted(() => {
  const chapter = storyStore.currentChapter
  if (chapter) editorStore.loadContent(chapter.content)

  // Wire up auto-save so it actually calls saveChapter
  autoSaveManager.registerSaveCallback('current-chapter', async () => {
    await saveChapter()
  })
})

onBeforeUnmount(() => {
  autoSaveManager.unregisterSaveCallback('current-chapter')
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
    // Save to storage - will use currentStoryId from store
    const saved = await storyStore.saveStory()
    if (saved) {
      editorStore.markAsSaved()
    }
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
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  gap: var(--spacing-lg);
  height: 52px;
  box-sizing: border-box;
  flex-shrink: 0;
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
