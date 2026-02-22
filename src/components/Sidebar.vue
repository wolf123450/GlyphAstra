<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': !isOpen }">
    <div class="sidebar-header">
      <h1 class="sidebar-title">BlockBreaker</h1>
      <button class="sidebar-toggle" @click="toggleSidebar" title="Toggle sidebar">
        <span class="toggle-icon">{{ isOpen ? '◀' : '▶' }}</span>
      </button>
    </div>

    <div v-if="isOpen" class="sidebar-content">

      <!-- Story Switcher -->
      <div class="story-section">
        <button class="story-title-btn" @click="showStoryPicker = !showStoryPicker" :title="currentStoryTitle">
          <span class="story-name">{{ currentStoryTitle }}</span>
          <span class="story-caret">{{ showStoryPicker ? '▲' : '▼' }}</span>
        </button>

        <div v-if="showStoryPicker" class="story-picker">
          <button class="story-new-btn" @click="createAndSwitchStory">⊕ New Story</button>
          <div class="story-list">
            <button
              v-for="proj in savedProjects"
              :key="proj.id"
              class="story-item"
              :class="{ active: proj.id === storyStore.currentStoryId }"
              @click="switchToStory(proj.id)"
            >
              <span class="story-item-name">{{ proj.name }}</span>
              <span class="story-item-date">{{ formatDate(proj.lastModified) }}</span>
            </button>
            <div v-if="savedProjects.length === 0" class="story-item-empty">No saved stories</div>
          </div>
        </div>
      </div>

      <!-- New Chapter Button -->
      <button class="btn-sidebar-action" @click="createNewChapter" title="Create new chapter (Ctrl+N)">
        <span class="icon">⊕</span>
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
      <button class="btn-icon" @click="toggleSettings" title="Settings (Ctrl+,)">
        ⚙
      </button>
      <button class="btn-icon" @click="toggleTheme" :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`">
        {{ theme === 'dark' ? '◐' : '☀' }}
      </button>
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
import { computed, ref } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useUIStore } from '@/stores/uiStore'
import { useEditorStore } from '@/stores/editorStore'
import { storageManager } from '@/utils/storage'
import ChapterItem from './ChapterItem.vue'
import ChapterMeta from './ChapterMeta.vue'

const storyStore = useStoryStore()
const editorStore = useEditorStore()
const uiStore = useUIStore()

const showStoryPicker = ref(false)
const showChapterMeta = ref(false)
const metaChapterId   = ref<string | null>(null)

const openChapterMeta = (id: string) => {
  metaChapterId.value   = id
  showChapterMeta.value = true
}

const currentStoryTitle = computed(() => storyStore.metadata.title || 'Untitled Story')

const savedProjects = computed(() => {
  const projects = storageManager.getProjectsList()
  const currentId = storyStore.currentStoryId
  // Patch the current story's name with the live in-memory title so the list
  // updates immediately when the user renames the story, before the next save.
  const liveTitle = storyStore.metadata.title
  return [...projects]
    .map((p) => p.id === currentId ? { ...p, name: liveTitle || p.name } : p)
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
})

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

const switchToStory = async (id: string) => {
  if (id === storyStore.currentStoryId) {
    showStoryPicker.value = false
    return
  }
  // Flush and save the current story first
  if (storyStore.currentChapterId) {
    const wc = editorStore.content.trim().split(/\s+/).filter((w: string) => w.length > 0).length
    storyStore.updateChapter(storyStore.currentChapterId, {
      content: editorStore.content,
      wordCount: wc,
      lastEdited: new Date().toISOString(),
    })
  }
  await storyStore.saveStory()
  await storyStore.loadStory(id)
  // Auto-select first chapter of the newly loaded story
  if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
    storyStore.setCurrentChapter(storyStore.chapters[0].id)
  }
  showStoryPicker.value = false
}

const createAndSwitchStory = async () => {
  // Save current story first
  if (storyStore.currentChapterId) {
    const wc = editorStore.content.trim().split(/\s+/).filter((w: string) => w.length > 0).length
    storyStore.updateChapter(storyStore.currentChapterId, {
      content: editorStore.content,
      wordCount: wc,
      lastEdited: new Date().toISOString(),
    })
  }
  await storyStore.saveStory()
  storyStore.createNewStory('Untitled Story')
  showStoryPicker.value = false
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
}
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

const deleteChapter = (id: string) => {
  if (confirm('Are you sure you want to delete this chapter?')) {
    storyStore.deleteChapter(id)
    if (currentChapterId.value === id) {
      storyStore.setCurrentChapter(null)
    }
  }
}

const toggleSettings = () => {
  uiStore.toggleSettings()
}

const toggleTheme = () => {
  const newTheme = theme.value === 'dark' ? 'light' : 'dark'
  uiStore.setTheme(newTheme)
}
</script>

<style scoped>
.story-section {
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.story-title-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.story-title-btn:hover {
  background-color: var(--bg-tertiary);
}

.story-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.story-caret {
  font-size: 10px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.story-picker {
  background-color: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

.story-new-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 500;
}

.story-new-btn:hover {
  background-color: var(--bg-tertiary);
}

.story-list {
  max-height: 200px;
  overflow-y: auto;
}

.story-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.story-item:hover {
  background-color: var(--bg-tertiary);
}

.story-item.active {
  background-color: color-mix(in srgb, var(--accent-color) 15%, transparent);
}

.story-item-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.story-item-date {
  font-size: 11px;
  color: var(--text-tertiary);
}

.story-item-empty {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: 12px;
  color: var(--text-tertiary);
}

.sidebar {
  width: 250px;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-collapsed {
  width: 60px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  gap: var(--spacing-md);
  height: 52px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.sidebar-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-color);
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
  border-bottom: 1px solid var(--border-color);
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
  border-top: 1px solid var(--border-color);
  background-color: var(--bg-primary);
}

.sidebar-collapsed .sidebar-footer {
  flex-direction: column;
}

.btn-icon {
  flex: 1;
  padding: var(--spacing-md);
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
</style>
