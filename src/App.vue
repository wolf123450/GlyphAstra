<template>
  <div class="app-container">
    <Sidebar />
    <Editor />
    <Overview />
    <Notification />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import Editor from '@/components/Editor.vue'
import Overview from '@/components/Overview.vue'
import Notification from '@/components/Notification.vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { initializeKeyboardShortcuts, registerDefaultShortcuts } from '@/utils/keyboard'

const uiStore = useUIStore()
const storyStore = useStoryStore()

onMounted(() => {
  // Initialize a new story if none exists
  if (!storyStore.currentStoryId) {
    storyStore.createNewStory('My Story')
  }

  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts()

  // Register default shortcuts
  registerDefaultShortcuts({
    'new-chapter': () => {
      // Trigger new chapter creation - will be handled via Sidebar
    },
    'save': () => {
      // Save current chapter - will be handled via Editor
    },
    'search': () => {
      // Open search panel - will be implemented in Phase 8
    },
    'settings': () => {
      uiStore.toggleSettings()
    },
    'toggle-mode': () => {
      const modes = ['editor', 'preview', 'overview'] as const
      const currentModeIndex = modes.indexOf(uiStore.activePanel)
      const nextMode = modes[(currentModeIndex + 1) % modes.length]
      uiStore.setActivePanel(nextMode)
    },
  })

  // Set initial theme
  uiStore.setTheme(uiStore.theme)

  // Show welcome message if no chapters
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