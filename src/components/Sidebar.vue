<template>
  <aside class="sidebar" :class="{ 'sidebar-collapsed': !isOpen }">
    <div class="sidebar-header">
      <h1 class="sidebar-title">BlockBreaker</h1>
      <button class="sidebar-toggle" @click="toggleSidebar" title="Toggle sidebar">
        <span class="toggle-icon">{{ isOpen ? '◀' : '▶' }}</span>
      </button>
    </div>

    <div v-if="isOpen" class="sidebar-content">
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
      <div class="chapters-tree">
        <div v-if="chapters.length === 0" class="empty-state">
          <p>No chapters yet</p>
          <p class="text-muted">Create your first chapter to get started</p>
        </div>
        <div v-else>
          <chapter-item
            v-for="chapter in filteredChapters"
            :key="chapter.id"
            :chapter="chapter"
            :is-active="chapter.id === currentChapterId"
            @select="selectChapter"
            @delete="deleteChapter"
            @rename="renameChapter"
          />
        </div>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useUIStore } from '@/stores/uiStore'
import ChapterItem from './ChapterItem.vue'

const storyStore = useStoryStore()
const uiStore = useUIStore()

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

const toggleSidebar = () => {
  uiStore.toggleSidebar()
}

const createNewChapter = () => {
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

const deleteChapter = (id: string) => {
  if (confirm('Are you sure you want to delete this chapter?')) {
    storyStore.deleteChapter(id)
    if (currentChapterId.value === id) {
      storyStore.setCurrentChapter(null)
    }
  }
}

const renameChapter = (id: string, newName: string) => {
  storyStore.updateChapter(id, { name: newName })
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
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  gap: var(--spacing-md);
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
