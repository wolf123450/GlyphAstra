<template>
  <div class="editor-panel">
    <div class="editor-header">
      <div class="editor-title">
        <h2 v-if="currentChapter">{{ currentChapter.name }}</h2>
        <h2 v-else>No chapter selected</h2>
      </div>
      <div class="editor-controls">
        <!-- Split view: always visible, disabled outside markdown mode -->
        <button
          class="mode-btn"
          :class="{ active: splitView && renderMode === 'markdown' }"
          :disabled="renderMode !== 'markdown'"
          @click="splitView = !splitView"
          title="Split view — raw markdown left, live preview right"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiViewSplitVertical"/></svg>
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'markdown' }"
          @click="setMode('markdown')"
          title="Show all markdown"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiLanguageMarkdown"/></svg>
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'seamless' }"
          @click="setMode('seamless')"
          title="Seamless editing"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiApproximatelyEqual"/></svg>
        </button>
        <button
          class="mode-btn"
          :class="{ active: renderMode === 'preview' }"
          @click="setMode('preview')"
          title="Preview mode"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiEyeOutline"/></svg>
        </button>
        <div class="separator"></div>
        <button
          class="action-btn"
          @click="saveChapter"
          :disabled="!isDirty || isReadOnly"
          title="Save (Ctrl+S)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiContentSaveOutline"/></svg>
        </button>
        <button
          class="action-btn"
          :class="{ active: isOverviewOpen }"
          @click="toggleOverview"
          title="Story Overview"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiBookOpenVariant"/></svg>
        </button>
        <button
          class="action-btn"
          :class="{ active: isAIOpen }"
          @click="toggleAI"
          title="AI Assistant (Ctrl+Space)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiRobot"/></svg>
        </button>
        <button
          class="action-btn"
          :class="{ active: isExportOpen }"
          @click="toggleExport"
          title="Export / Import"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiApplicationExport"/></svg>
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

    <!-- Chapter type banners -->
      <div v-if="currentChapter?.chapterType === 'toc'" class="chapter-type-banner banner-toc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px"><path :d="mdiFormatListNumbered"/></svg>
        <strong>Table of Contents</strong> &mdash; On export, this chapter’s content is replaced with an auto-generated chapter list. Text written here is not included in the export.
      </div>
      <div v-if="currentChapter?.chapterType === 'illustration'" class="chapter-type-banner banner-illustration">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:6px"><path :d="mdiImageOutline"/></svg>
        <strong>Illustration</strong> &mdash; Set the image path and caption in <em>Chapter Properties</em>. Any text here appears after the image in the export.
      </div>
    <div class="editor-body" :class="{ 'editor-body--split': splitViewActive }">
      <!-- ── Live TOC panel replaces editor for Contents chapters ────────── -->
      <div v-if="currentChapter?.chapterType === 'toc'" class="toc-live-panel">
        <div class="toc-live-header">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiFormatListNumbered"/></svg>
          Table of Contents
          <span class="toc-live-badge">live &mdash; click any entry to navigate &bull; updates as chapters change</span>
        </div>
        <ol class="toc-live-list" v-if="liveTocEntries.length">
          <li v-for="entry in liveTocEntries" :key="entry.id" class="toc-live-item"
              @click="navigateToChapter(entry.id)"
              :title="'Go to: ' + entry.display">
            <span class="toc-num">{{ entry.num }}.</span>
            <span class="toc-name">{{ entry.display }}</span>
          </li>
        </ol>
        <p v-else class="toc-live-empty">No chapters yet &mdash; they&rsquo;ll appear here as you create them.</p>
      </div>
      <!-- ── Split view: active editor on the left, live preview on the right ── -->
      <template v-else-if="splitViewActive">
        <div class="split-editor">
          <EditorSeamless
            ref="splitEditorRef"
            :content="content"
            :cursorPos="cursorPosition"
            :forceMode="renderMode"
            :isReadOnly="isReadOnly"
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
            @navigate-story="navigateToStory"
            @undo="onUndo"
            @redo="onRedo"
            @snapshot="onSnapshot"
          />
        </div>
        <div class="split-divider" aria-hidden="true" />
        <div class="split-preview">
          <EditorPreview
            ref="splitPreviewRef"
            :content="content"
            @navigate-chapter="navigateToChapter"
            @navigate-story="navigateToStory"
          />
        </div>
      </template>

      <!-- ── Solo modes (unchanged) ──────────────────────────────────── -->
      <!-- Seamless Mode -->
      <EditorSeamless
        v-else-if="renderMode === 'seamless' && currentChapter"
        ref="soloSeamlessRef"
        :content="content"
        :cursorPos="cursorPosition"
        :isReadOnly="isReadOnly"
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
        @navigate-story="navigateToStory"
        @undo="onUndo"
        @redo="onRedo"
        @snapshot="onSnapshot"
      />
      <!-- Markdown Mode -->
      <EditorMarkdown
        v-else-if="renderMode === 'markdown' && currentChapter"
        ref="soloMarkdownRef"
        :content="content"
        :isReadOnly="isReadOnly"
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
        ref="soloPreviewRef"
        :content="content"
        @navigate-chapter="navigateToChapter"
        @navigate-story="navigateToStory"
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
      ><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path :d="mdiTextBoxOutline"/></svg>{{ currentChapter.summary ? 'Summary' : 'No summary' }}</button>
      <!-- Version history -->
      <button
        v-if="currentChapter"
        class="status-item status-history-btn"
        :title="'Version history'"
        @click="showHistory = true"
      ><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path :d="mdiHistory"/></svg> History</button>
      <!-- Image pack status widget -->
      <div
        v-if="storyStore.currentStoryId"
        class="status-item status-pack-pill"
        :class="{ 'pack-ok': !packIsStale }"
      >
        <button
          class="pack-archive-btn"
          :title="packIsStale ? 'Images not fully packed \u2014 click to pack' : 'All images packed'"
          @click="packFocusFailed = false; showPackModal = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle">
            <path :d="packIsStale ? mdiArchiveOutline : mdiArchive" />
          </svg>
        </button>
        <button
          v-if="packUnresolvedCount > 0"
          class="pack-error-btn"
          :title="`${packUnresolvedCount} image${packUnresolvedCount > 1 ? 's' : ''} could not be resolved`"
          @click="packFocusFailed = true; showPackModal = true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:2px">
            <path :d="mdiImageBrokenVariant" />
          </svg>
          <span class="pack-error-count">{{ packUnresolvedCount }}</span>
        </button>
      </div>
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
  <PackModal
    :show="showPackModal"
    :focus-failed="packFocusFailed"
    @close="showPackModal = false; checkPackStatus()"
    @packed="checkPackStatus()"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  mdiViewSplitVertical,
  mdiLanguageMarkdown,
  mdiApproximatelyEqual,
  mdiEyeOutline,
  mdiContentSaveOutline,
  mdiBookOpenVariant,
  mdiRobot,
  mdiApplicationExport,
  mdiHistory,
  mdiTextBoxOutline,
  mdiFormatListNumbered,
  mdiImageOutline,
  mdiArchive,
  mdiArchiveOutline,
  mdiImageBrokenVariant,
} from '@mdi/js'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { autoSaveManager } from '@/utils/autoSave'
import { useAISuggestion } from '@/utils/ai/useAISuggestion'
import type { RenderMode } from '@/utils/editor/seamlessRenderer'
import EditorSeamless from './EditorSeamless.vue'
import EditorMarkdown from './EditorMarkdown.vue'
import EditorPreview from './EditorPreview.vue'
import MarkdownReference from '../export/MarkdownReference.vue'
import ChapterMeta from '../story/ChapterMeta.vue'
import ChapterHistory from '../story/ChapterHistory.vue'
import PackModal from '../export/PackModal.vue'
import { storageManager } from '@/utils/storage/storage'
import { captureSnapshot } from '@/utils/story/historyManager'
import { getUnpackedSrcs } from '@/utils/media/imagePackManager'
import * as undoManager from '@/utils/editor/undoManager'
import { useScrollSync } from './useScrollSync'

const storyStore = useStoryStore()
const editorStore = useEditorStore()
const uiStore = useUIStore()

const currentChapter = computed(() => storyStore.currentChapter)

/** Reactive list of all non-TOC chapters in sidebar order — drives the live TOC panel. */
const liveTocEntries = computed(() => {
  let num = 0
  return storyStore.chapters
    .filter(c => c.chapterType !== 'toc')
    .map(c => {
      const display = c.chapterLabel && c.chapterLabel !== c.name
        ? `${c.chapterLabel}: ${c.name}`
        : c.chapterLabel || c.name
      return { id: c.id, display, num: ++num }
    })
})
const isDirty = computed(() => editorStore.isDirty)
const isReadOnly = computed(() => currentChapter.value?.isReadOnly ?? false)
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

// ─── Image pack status ────────────────────────────────────────────────────────
const packUnresolvedCount = ref(0)
const packIsStale         = ref(false)
const showPackModal       = ref(false)
const packFocusFailed     = ref(false)

async function checkPackStatus() {
  const id = storyStore.currentStoryId
  if (!id) { packIsStale.value = false; packUnresolvedCount.value = 0; return }
  const contents = storyStore.chapters.map(c => c.content ?? '')
  const unpacked = await getUnpackedSrcs(id, contents)
  packUnresolvedCount.value = unpacked.length
  packIsStale.value         = unpacked.length > 0
}

// ─── Split view ──────────────────────────────────────────────────────────────
const splitView   = ref(localStorage.getItem('blockbreaker_split_view') === 'true')
// Split view only applies to markdown mode (raw editing beside live preview)
const splitViewActive = computed(
  () => splitView.value && !!currentChapter.value && renderMode.value === 'markdown'
)
watch(splitView, (val) => localStorage.setItem('blockbreaker_split_view', String(val)))

// ─── Scroll sync composable ──────────────────────────────────────────────────
const renderMode = ref<RenderMode>('seamless')


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
  if (isReadOnly.value) return            // guard: read-only chapters cannot be edited
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

/**
 * Navigate to a story referenced by a story:// link.
 * Supports both story://story-id and story://story-id/chapter-id.
 * Story part matched by ID first, then by title (case-insensitive).
 * Chapter part matched by ID first, then by name (case-insensitive).
 */
const navigateToStory = async (rawPath: string) => {
  // Split at the first "/" to separate optional chapter segment
  const slashIdx = rawPath.indexOf('/')
  const storyPart   = slashIdx === -1 ? rawPath : rawPath.slice(0, slashIdx)
  const chapterPart = slashIdx === -1 ? null    : rawPath.slice(slashIdx + 1)

  // Try direct ID load first
  let loaded = await storyStore.loadStory(storyPart)

  if (!loaded) {
    // Fall back: find by title in the projects list
    const all = storageManager.getProjectsList()
    const match = all.find(
      (p) => p.name.toLowerCase() === storyPart.toLowerCase()
    )
    if (match) loaded = await storyStore.loadStory(match.id)
  }

  if (loaded) {
    if (chapterPart) {
      // Navigate to a specific chapter within the loaded story (id or name)
      navigateToChapter(chapterPart)
    } else if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
      storyStore.setCurrentChapter(storyStore.chapters[0].id)
    }
  }
}

const cursorPosition = ref(0)

// editorStore.content is the single source of truth while editing.
// When the chapter changes we flush to storyStore and load the new chapter.
const content = computed({
  get: () => editorStore.content,
  set: (value) => editorStore.setContent(value),
})

// Scroll sync must be initialised after `content` is declared
const {
  splitEditorRef,
  splitPreviewRef,
  soloSeamlessRef,
  soloMarkdownRef,
  soloPreviewRef,
  setMode,
} = useScrollSync(content, renderMode, splitViewActive)

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

// When the story changes, re-check pack status
watch(() => storyStore.currentStoryId, () => checkPackStatus())

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

  // Check image pack status for the current story
  checkPackStatus()
})

onBeforeUnmount(() => {
  autoSaveManager.unregisterSaveCallback('current-chapter')
})

// Word/line counts — debounced to avoid per-keystroke string splitting
const wordCount = ref(0)
const lineCount = ref(0)
let _statsTimer: ReturnType<typeof setTimeout> | undefined
watch(content, (val) => {
  if (_statsTimer !== undefined) clearTimeout(_statsTimer)
  _statsTimer = setTimeout(() => {
    wordCount.value = val.trim().split(/\s+/).filter((w: string) => w.length > 0).length
    lineCount.value = val.split('\n').length
  }, 300)
}, { immediate: true })

const saveChapter = async () => {
  if (!currentChapter.value || isReadOnly.value) return
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

.action-btn:disabled,
.mode-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.mode-btn:disabled:hover {
  background-color: transparent;
  border-color: transparent;
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

.chapter-type-banner {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  margin-bottom: 10px;
  line-height: 1.5;
}
.banner-toc {
  background: color-mix(in srgb, #7c5cbf 12%, transparent);
  border: 1px solid color-mix(in srgb, #7c5cbf 35%, transparent);
  color: color-mix(in srgb, #7c5cbf 90%, currentColor);
}
.banner-illustration {
  background: color-mix(in srgb, #1a6fa8 12%, transparent);
  border: 1px solid color-mix(in srgb, #1a6fa8 35%, transparent);
  color: color-mix(in srgb, #1a6fa8 90%, currentColor);
}

/* Live TOC panel */
.toc-live-panel {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}
.toc-live-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #7c5cbf;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, #7c5cbf 25%, transparent);
}
.toc-live-badge {
  font-weight: 400;
  font-size: 11px;
  color: var(--text-tertiary);
}
.toc-live-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.toc-live-item {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 14px;
  color: var(--text-primary);
  transition: background var(--transition-fast);
  cursor: pointer;
  user-select: none;
}
.toc-live-item:hover { background: var(--bg-tertiary); }
.toc-live-item:hover .toc-name { color: var(--accent-color); text-decoration: underline; }
.toc-num {
  color: var(--text-tertiary);
  min-width: 2em;
  text-align: right;
  flex-shrink: 0;
}
.toc-live-empty {
  color: var(--text-tertiary);
  font-style: italic;
  font-size: 13px;
  text-align: center;
  margin-top: 40px;
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

/* ── Image pack status pill ─────────────────────────────────────────── */
.status-pack-pill {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-tertiary);
  gap: 0;
}
.pack-archive-btn,
.pack-error-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
  font-size: 11px;
  line-height: 1;
}
.pack-archive-btn:hover { background: var(--bg-hover); color: var(--accent-color); }
.pack-error-btn {
  border-left: 1px solid var(--border-color);
  color: var(--error-color, #f44336);
}
.pack-error-btn:hover { background: rgba(244, 67, 54, 0.1); }
.pack-error-count { font-size: 11px; font-weight: 600; }
.status-pack-pill.pack-ok .pack-archive-btn { color: var(--accent-color); }

/* ── Split view layout ─────────────────────────────────────────────── */
.editor-body--split {
  padding: 0;
  gap: 0;
}

.split-editor,
.split-preview {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  /* Must be a flex container so inner .editor-wrapper / .editor-preview
     can use flex:1 and overflow-y:auto correctly */
  display: flex;
  flex-direction: column;
}

.split-divider {
  width: 1px;
  height: 100%;
  background-color: var(--border-color);
  flex-shrink: 0;
}
</style>
