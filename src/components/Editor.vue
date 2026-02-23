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
        <button
          class="action-btn"
          :class="{ active: isExportOpen }"
          @click="toggleExport"
          title="Export / Import"
        >
          ⬡
        </button>
        <button
          class="action-btn"
          :class="{ active: showMarkdownRef }"
          @click="showMarkdownRef = true"
          title="Markdown Reference"
        >
          ?
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
        @update:content="onContentFromEditor($event)"
        @update:cursorPos="cursorPosition = $event"
        @trigger-ai="onTriggerAI"
        @accept-suggestion="onAcceptSuggestion"
        @dismiss-suggestion="onDismissSuggestion"
        @next-suggestion="onNextSuggestion"
        @prev-suggestion="onPrevSuggestion"
        @type-char="onTypeChar"
        @navigate-chapter="navigateToChapter"
        @undo="onUndo"
        @redo="onRedo"
        @snapshot="onSnapshot"
      />
      <EditorMarkdown
        v-else-if="renderMode === 'markdown' && currentChapter"
        :content="content"
        :suggestion-text="ai.remainingText.value"
        :suggestion-count="ai.totalCount.value"
        :suggestion-index="ai.currentIndex.value"
        :suggestion-generating="ai.isGenerating.value"
        @update:content="onContentFromEditor($event)"
        @update:cursorPos="cursorPosition = $event"
        @trigger-ai="onTriggerAI"
        @accept-suggestion="onAcceptSuggestion"
        @dismiss-suggestion="onDismissSuggestion"
        @next-suggestion="onNextSuggestion"
        @prev-suggestion="onPrevSuggestion"
        @type-char="onTypeChar"
        @undo="onUndo"
        @redo="onRedo"
        @snapshot="onSnapshot"
      />

      <!-- Preview Mode -->
      <EditorPreview
        v-else-if="renderMode === 'preview' && currentChapter"
        :content="content"
        @navigate-chapter="navigateToChapter"
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
      <!-- Chapter summary status -->
      <button
        v-if="currentChapter"
        class="status-item status-summary-btn"
        :class="{ 'has-summary': currentChapter.summary }"
        :title="currentChapter.summary ? 'AI summary available — click to edit chapter properties' : 'No summary yet — click to open chapter properties'"
        @click="openChapterMeta"
      >&#x2299; {{ currentChapter.summary ? 'Summary' : 'No summary' }}</button>
      <!-- Version history -->
      <button
        v-if="currentChapter"
        class="status-item status-history-btn"
        :title="'Version history'"
        @click="showHistory = true"
      >&#x23F1; History</button>
    </div>
  </div>

  <MarkdownReference :show="showMarkdownRef" @close="showMarkdownRef = false" />
  <ChapterMeta
    :show="showChapterMeta"
    :chapter-id="metaChapterId"
    @close="showChapterMeta = false"
  />
  <ChapterHistory
    :show="showHistory"
    @close="showHistory = false"
  />
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
import MarkdownReference from './MarkdownReference.vue'
import ChapterMeta from './ChapterMeta.vue'
import ChapterHistory from './ChapterHistory.vue'
import { captureSnapshot } from '@/utils/historyManager'
import * as undoManager from '@/utils/undoManager'

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

const isExportOpen = computed(() => uiStore.activePanel === 'export')
const toggleExport = () => {
  uiStore.setActivePanel(isExportOpen.value ? 'editor' : 'export')
}

const showMarkdownRef = ref(false)

const showChapterMeta = ref(false)
const metaChapterId   = ref<string | null>(null)
const showHistory     = ref(false)

const openChapterMeta = () => {
  const id = storyStore.currentChapterId
  if (!id) return
  metaChapterId.value   = id
  showChapterMeta.value = true
}

// ─── AI inline suggestions ─────────────────────────────────────────────────
const ai = useAISuggestion()

const onTriggerAI = () => {
  ai.trigger(content.value.slice(0, cursorPosition.value))
}

const onAcceptSuggestion = () => {
  const text = ai.acceptFull()
  if (!text) return
  const pos = cursorPosition.value
  content.value = content.value.slice(0, pos) + text + content.value.slice(pos)
  cursorPosition.value = pos + text.length
}

const onDismissSuggestion = () => ai.clear()
const onNextSuggestion    = () => ai.next()
const onPrevSuggestion    = () => ai.prev()
const onTypeChar          = (char: string) => ai.tryMatchChar(char)

// ─── Session undo/redo ─────────────────────────────────────────────────────
/** Called by every editor update:content so we push to the undo stack. */
const onContentFromEditor = (newContent: string) => {
  content.value = newContent        // → editorStore.setContent (marks dirty)
  const id = storyStore.currentChapterId
  if (id) undoManager.push(id, newContent, () => cursorPosition.value)
}

/** Flush the pre-edit state immediately (before Enter/Delete/Tab/paste/cut). */
const onSnapshot = () => {
  const id = storyStore.currentChapterId
  if (id) undoManager.flush(id, content.value, cursorPosition.value)
}

const onUndo = () => {
  const id = storyStore.currentChapterId
  if (!id) return
  undoManager.flush(id, content.value, cursorPosition.value)  // save current first
  const entry = undoManager.undo(id)
  if (!entry) return
  content.value = entry.content
  cursorPosition.value = entry.cursorPos
}

const onRedo = () => {
  const id = storyStore.currentChapterId
  if (!id) return
  const entry = undoManager.redo(id)
  if (!entry) return
  content.value = entry.content
  cursorPosition.value = entry.cursorPos
}

// Dismiss suggestion when chapter changes
watch(() => storyStore.currentChapterId, () => ai.clear())

/**
 * Navigate to a chapter referenced by a chapter:// link.
 * Tries by id first, then falls back to matching by name (case-insensitive).
 */
const navigateToChapter = (idOrName: string) => {
  const byId = storyStore.getChapterById(idOrName)
  if (byId) {
    storyStore.setCurrentChapter(byId.id)
    return
  }
  // Fall back: match by chapter name
  const byName = storyStore.chapters.find(
    (ch) => ch.name.toLowerCase() === idOrName.toLowerCase()
  )
  if (byName) storyStore.setCurrentChapter(byName.id)
}

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
    if (newId) undoManager.init(newId, chapter?.content ?? '', 0)
  }
)

// On mount: initialise editor with the content of the already-selected chapter
onMounted(() => {
  const chapter = storyStore.currentChapter
  if (chapter) {
    editorStore.loadContent(chapter.content)
    const id = storyStore.currentChapterId
    if (id) undoManager.init(id, chapter.content, 0)
  }

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
      // Capture a history snapshot (no-ops if change is too small)
      await captureSnapshot(
        storyStore.currentStoryId,
        currentChapter.value,
        content.value,
      )
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

.status-summary-btn {
  margin-left: auto;
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--text-tertiary); padding: 0;
  font-family: inherit; transition: color var(--transition-fast);
}
.status-summary-btn:hover { color: var(--accent-color); }
.status-summary-btn.has-summary { color: var(--accent-color); opacity: 0.75; }
.status-summary-btn.has-summary:hover { opacity: 1; }

.status-history-btn {
  background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--text-tertiary); padding: 0;
  font-family: inherit; transition: color var(--transition-fast);
}
.status-history-btn:hover { color: var(--accent-color); }
</style>
