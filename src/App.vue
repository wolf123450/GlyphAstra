<template>
  <div class="app-container">
    <Sidebar />
    <Editor />
    <Overview />
    <AIPanel />
    <ExportPanel />
    <Settings />
    <Notification />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import Editor from '@/components/Editor.vue'
import Overview from '@/components/Overview.vue'
import AIPanel from '@/components/AIPanel.vue'
import ExportPanel from '@/components/ExportPanel.vue'
import Settings from '@/components/Settings.vue'
import Notification from '@/components/Notification.vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { initializeKeyboardShortcuts, registerDefaultShortcuts } from '@/utils/keyboard'
import { storageManager } from '@/utils/storage'

const LAST_STORY_KEY = 'blockbreaker_last_story'

const uiStore = useUIStore()
const storyStore = useStoryStore()
const settingsStore = useSettingsStore()

// Apply persisted theme immediately
uiStore.setTheme(settingsStore.settings.theme)

// Persist the last-open story ID so we can reload it on restart
watch(() => storyStore.currentStoryId, (id) => {
  if (id) localStorage.setItem(LAST_STORY_KEY, id)
})

onMounted(async () => {
  // Try to restore the last open story
  let loaded = false

  const lastId = localStorage.getItem(LAST_STORY_KEY)
  if (lastId) {
    loaded = await storyStore.loadStory(lastId)
  }

  if (!loaded) {
    // Fall back to the most recently modified saved story
    const projects = storageManager.getProjectsList()
    if (projects.length > 0) {
      const sorted = [...projects].sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      )
      loaded = await storyStore.loadStory(sorted[0].id)
    }
  }

  if (!loaded) {
    storyStore.createNewStory('My Story')
  }

  // Auto-select first chapter if none selected
  if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
    storyStore.setCurrentChapter(storyStore.chapters[0].id)
  }

  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts()

  registerDefaultShortcuts({
    'new-chapter': () => {},
    'save': () => {},
    'search': () => {},
    'settings': () => { uiStore.toggleSettings() },
    'toggle-mode': () => {
      const modes = ['editor', 'preview', 'overview'] as const
      const panel = uiStore.activePanel
      const inModes = modes.includes(panel as typeof modes[number])
      const currentModeIndex = inModes ? modes.indexOf(panel as typeof modes[number]) : -1
      const nextMode = modes[(currentModeIndex + 1) % modes.length]
      uiStore.setActivePanel(nextMode)
    },
  })

  uiStore.setTheme(uiStore.theme)

  if (storyStore.chapters.length === 0) {
    uiStore.showNotification('Welcome to BlockBreaker! Create your first chapter to get started.', 'info', 0)
  }
})
</script>

<style scoped>
.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background-color: var(--bg-primary);
}
</style>