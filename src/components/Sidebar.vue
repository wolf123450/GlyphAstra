<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': !isOpen }">
    <div class="sidebar-header">
      <span class="sidebar-title">Stories</span>
      <button class="sidebar-toggle" @click="toggleSidebar" title="Toggle sidebar" aria-label="Toggle sidebar">
        <AppIcon :path="isOpen ? mdiChevronLeft : mdiChevronRight" :size="16" class="toggle-icon" />
      </button>
    </div>

    <div v-if="isOpen" class="sidebar-content">

      <!-- Story Switcher -->
      <StoryPicker ref="storyPickerRef" />


      <!-- Chapter delete confirmation modal -->
      <Teleport to="body">
        <div v-if="pendingChapterDelete" class="delete-confirm-backdrop" @click.self="pendingChapterDelete = null">
          <div class="delete-confirm-modal">
            <p class="delete-confirm-title">Delete chapter?</p>
            <p class="delete-confirm-body">
              “{{ pendingChapterDelete.name }}” will be permanently deleted and cannot be recovered.
            </p>
            <div class="delete-confirm-actions">
              <button class="delete-confirm-cancel" @click="pendingChapterDelete = null">Cancel</button>
              <button class="delete-confirm-ok" @click="executeDeleteChapter">Delete</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- New Chapter Button -->
      <button class="btn-sidebar-action" @click="createNewChapter" title="Create new chapter (Ctrl+N)">
        <AppIcon :path="mdiPlusCircleOutline" :size="16" style="flex-shrink:0" />
        <span class="label">New Chapter</span>
      </button>

      <!-- Search Box -->
      <div class="search-container">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search chapters..."
          class="search-input"
        />
      </div>

      <!-- Chapters Tree -->
      <div
        class="chapters-tree"
        ref="treeRef"
        :class="{ 'is-reordering': dragChapterId !== null }"
      >
        <div v-if="chapters.length === 0" class="empty-state">
          <p>No chapters yet</p>
          <p class="text-muted">Create your first chapter to get started</p>
        </div>
        <template v-else>
          <template v-for="(chapter, index) in filteredChapters" :key="chapter.id">
            <div class="drop-zone" :class="{ 'drop-active': dropIndex === index }" />
            <chapter-item
              :chapter="chapter"
              :is-active="chapter.id === currentChapterId"
              :draggable="!searchQuery"
              :display-label="chapterDisplayLabels[chapter.id]"
              :class="{ 'is-dragging': chapter.id === dragChapterId }"
              @select="selectChapter"
              @delete="deleteChapter"
              @edit-meta="openChapterMeta"
              @handle-down="onHandleDown"
              @rename="renameChapter"
            />
          </template>
          <div class="drop-zone" :class="{ 'drop-active': dropIndex === filteredChapters.length }" />
        </template>
      </div>
    </div>

    <!-- Sidebar Footer -->
    <div class="sidebar-footer">
      <div class="icon-group">
        <button class="btn-icon" :class="{ active: uiStore.showSettings }" @click="toggleSettings" title="Settings (Ctrl+,)" aria-label="Settings">
          <AppIcon :path="mdiCog" :size="18" />
        </button>
        <button class="btn-icon" @click="toggleTheme" :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`" :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`">
          <AppIcon :path="theme === 'dark' ? mdiCircleHalfFull : mdiWhiteBalanceSunny" :size="18" />
        </button>
        <button class="btn-icon" @click="openHelpStory" title="Help &amp; Reference" aria-label="Help and Reference">
          ?
        </button>
      </div>
    </div>
  </aside>

  <!-- Chapter Metadata Editor -->
  <ChapterMeta
    :show="showChapterMeta"
    :chapter-id="metaChapterId"
    @close="showChapterMeta = false"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { mdiPlusCircleOutline, mdiCog, mdiChevronLeft, mdiChevronRight, mdiCircleHalfFull, mdiWhiteBalanceSunny } from '@mdi/js'
import { useStoryStore } from '@/stores/storyStore'
import { useUIStore } from '@/stores/uiStore'
import { HELP_STORY_ID } from '@/utils/story/helpStory'
import { loadOrCreateHelpStory } from '@/utils/story/helpStoryService'
import StoryPicker from './story/StoryPicker.vue'
import ChapterItem from './story/ChapterItem.vue'
import ChapterMeta from './story/ChapterMeta.vue'

const storyStore = useStoryStore()
const uiStore = useUIStore()

const storyPickerRef = ref<InstanceType<typeof StoryPicker> | null>(null)
const showChapterMeta = ref(false)
const metaChapterId   = ref<string | null>(null)

const openChapterMeta = (id: string) => {
  metaChapterId.value   = id
  showChapterMeta.value = true
}

const isOpen = computed({
  get: () => uiStore.sidebarOpen,
  set: (value) => {
    if (value) {
      uiStore.setSidebarWidth(250)
    } else {
      uiStore.setSidebarWidth(60)
    }
  },
})

const searchQuery = computed({
  get: () => uiStore.sidebarSearchQuery,
  set: (value) => uiStore.setSidebarSearchQuery(value),
})

const theme = computed(() => uiStore.theme)
const chapters = computed(() => storyStore.chapters)

/** Per-chapter display label: chapterLabel if set, "Chapter N" (auto) otherwise. */
const chapterDisplayLabels = computed(() => {
  const map: Record<string, string> = {}
  let n = 0
  for (const ch of storyStore.chapters) {
    if (ch.chapterLabel) {
      map[ch.id] = ch.chapterLabel
    } else {
      n++
      map[ch.id] = String(n)
    }
  }
  return map
})
const currentChapterId = computed(() => storyStore.currentChapterId)

const filteredChapters = computed(() => {
  if (!searchQuery.value) return chapters.value
  return chapters.value.filter((ch: { name: string }) =>
    ch.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// ─── Pointer-based drag-to-reorder ─────────────────────────────────────────────────────
const treeRef       = ref<HTMLElement | null>(null)
const dragChapterId = ref<string | null>(null)
const dropIndex     = ref<number | null>(null)

const getDropIndex = (clientY: number): number => {
  if (!treeRef.value) return 0
  const items = [...treeRef.value.querySelectorAll('[data-chapter-id]')] as HTMLElement[]
  let idx = filteredChapters.value.length
  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) { idx = i; break }
  }
  return idx
}

// Track drag cleanup so we can release listeners if the component is unmounted mid-drag
let _dragCleanup: (() => void) | null = null

const onHandleDown = (id: string, e: MouseEvent) => {
  if (searchQuery.value) return
  dragChapterId.value = id
  dropIndex.value = getDropIndex(e.clientY)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'

  const onMove = (me: MouseEvent) => {
    dropIndex.value = getDropIndex(me.clientY)
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    _dragCleanup = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (dragChapterId.value !== null && dropIndex.value !== null) {
      const id = dragChapterId.value
      const allChapters = storyStore.chapters
      const fromIndex = allChapters.findIndex(ch => ch.id === id)
      if (fromIndex !== -1) {
        const newOrder = allChapters.map(ch => ch.id)
        newOrder.splice(fromIndex, 1)
        const target = dropIndex.value > fromIndex ? dropIndex.value - 1 : dropIndex.value
        newOrder.splice(target, 0, id)
        storyStore.reorderChapters(newOrder)
        storyStore.saveStory()
      }
    }
    dragChapterId.value = null
    dropIndex.value = null
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  _dragCleanup = onUp   // store so onBeforeUnmount can invoke it
}

onBeforeUnmount(() => { _dragCleanup?.() })
// ────────────────────────────────────────────────────────────────────────────

const toggleSidebar = () => {
  uiStore.toggleSidebar()
}

const createNewChapter = () => {
  // Ensure a story exists
  if (!storyStore.currentStoryId) {
    storyStore.createNewStory()
  }

  const id = `chapter-${Date.now()}`
  const chapter = {
    id,
    name: 'Untitled Chapter',
    path: `chapters/${id}`,
    status: 'draft' as const,
    wordCount: 0,
    lastEdited: new Date().toISOString(),
    content: '',
  }
  storyStore.addChapter(chapter)
  storyStore.setCurrentChapter(id)
}

const selectChapter = (id: string) => {
  storyStore.setCurrentChapter(id)
}

const renameChapter = (id: string, newName: string) => {
  storyStore.updateChapter(id, { name: newName })
  storyStore.saveStory()
}

const pendingChapterDelete = ref<{ id: string; name: string } | null>(null)

const deleteChapter = (id: string) => {
  const chapter = storyStore.chapters.find(ch => ch.id === id)
  pendingChapterDelete.value = { id, name: chapter?.name ?? 'this chapter' }
}

const executeDeleteChapter = () => {
  if (!pendingChapterDelete.value) return
  const { id } = pendingChapterDelete.value
  pendingChapterDelete.value = null
  storyStore.deleteChapter(id)
  if (currentChapterId.value === id) {
    storyStore.setCurrentChapter(null)
  }
}

const toggleSettings = () => {
  uiStore.toggleSettings()
}

const openHelpStory = async () => {
  if (storyStore.currentStoryId !== HELP_STORY_ID) {
    await loadOrCreateHelpStory()
    if (storyStore.chapters.length > 0) {
      storyStore.setCurrentChapter(storyStore.chapters[0].id)
    }
  }
  storyPickerRef.value?.close()
}

const toggleTheme = () => {
  const newTheme = theme.value === 'dark' ? 'light' : 'dark'
  uiStore.setTheme(newTheme)
}

// ── Context menu triggers ─────────────────────────────────────────────────────
watch(() => uiStore.pendingDeleteChapterId, (id) => {
  if (id) {
    uiStore.clearChapterDelete()
    deleteChapter(id)
  }
})

watch(() => uiStore.pendingMetaChapterId, (id) => {
  if (id) {
    uiStore.clearChapterMeta()
    openChapterMeta(id)
  }
})
</script>

<style scoped>
/* ── Delete-story confirmation modal ───────────────────────── */
.delete-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.delete-confirm-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  max-width: 340px;
  width: 90%;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.delete-confirm-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.delete-confirm-body {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.delete-confirm-cancel {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.delete-confirm-cancel:hover {
  background: var(--bg-tertiary);
}

.delete-confirm-ok {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--error-color);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.delete-confirm-ok:hover {
  filter: brightness(1.15);
}

.sidebar {
  width: var(--sidebar-width);
  background-color: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  gap: var(--spacing-md);
  height: 52px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.sidebar-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

.sidebar-collapsed .sidebar-title {
  display: none;
}

.sidebar-toggle {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.btn-sidebar-action {
  margin: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background-color: transparent;
  color: var(--accent-color);
  padding: var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.btn-sidebar-action:hover {
  background-color: var(--accent-color);
  color: white;
  transform: translateY(-1px);
}

.sidebar-collapsed .btn-sidebar-action {
  margin: var(--spacing-md) var(--spacing-sm);
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
}

.sidebar-collapsed .icon {
  display: block;
}

.sidebar-collapsed .label {
  display: none;
}

.search-container {
  padding: var(--spacing-md);
}

.sidebar-collapsed .search-container {
  display: none;
}

.search-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.chapters-tree {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}
.chapters-tree.is-reordering {
  cursor: grabbing;
}

.drop-zone {
  height: 0;
  border-radius: 2px;
  transition: height 0.1s, background 0.1s, margin 0.1s;
  pointer-events: none;
}
.drop-zone.drop-active {
  height: 3px;
  background: var(--accent-color);
  box-shadow: 0 0 6px color-mix(in srgb, var(--accent-color) 60%, transparent);
  margin: 2px 0;
}

:deep(.is-dragging) {
  opacity: 0.35;
}

.empty-state {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-tertiary);
}

.empty-state p {
  margin: var(--spacing-sm) 0;
  font-size: 13px;
}

.sidebar-footer {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background-color: var(--bg-secondary);
}

.sidebar-footer .icon-group {
  display: flex;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  flex: 1;
}

.sidebar-collapsed .sidebar-footer {
  flex-direction: column;
}

.sidebar-collapsed .icon-group {
  flex-direction: column;
}

.btn-icon {
  flex: 1;
  min-width: 32px;
  min-height: 32px;
  padding: var(--spacing-sm);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 16px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.btn-icon:hover {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.btn-icon.active {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}
</style>
