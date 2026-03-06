<template>
  <TitleBar />
  <div class="app-container">
    <Sidebar />
    <div v-if="uiStore.sidebarOpen" class="pane-divider">
      <div class="divider-handle" title="Drag to resize sidebar" @mousedown="sidebarResize.onDividerMousedown">
      </div>
    </div>
    <Editor />
    <div v-if="hasRightPanel" class="pane-divider">
      <div class="divider-handle" title="Drag to resize panel" @mousedown="rightPanelResize.onDividerMousedown">
      </div>
    </div>
    <Overview />
    <AIPanel />
    <ExportPanel />
    <Settings />
    <SearchPanel />
    <Notification />
    <OnboardingTour />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import TitleBar from '@/components/TitleBar.vue'
import { usePaneResize } from '@/utils/editor/usePaneResize'
import Editor from '@/components/editor/Editor.vue'
import Overview from '@/components/story/Overview.vue'
import AIPanel from '@/components/ai/AIPanel.vue'
import ExportPanel from '@/components/export/ExportPanel.vue'
import Settings from '@/components/Settings.vue'
import SearchPanel from '@/components/story/SearchPanel.vue'
import Notification from '@/components/Notification.vue'
import OnboardingTour from '@/components/OnboardingTour.vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { initializeKeyboardShortcuts, registerDefaultShortcuts } from '@/utils/keyboard'
import { storageManager } from '@/utils/storage/storage'
import { loadOrCreateHelpStory, ensureHelpStoryExists } from '@/utils/story/helpStoryService'
import { useSummaryManager } from '@/utils/ai/summaryManager'
import { reconcileProjectsList } from '@/utils/storage/persistenceService'

const LAST_STORY_KEY   = 'glyphastra_last_story'
const ONBOARDING_KEY   = 'glyphastra_onboarding_complete'

const uiStore = useUIStore()
const storyStore = useStoryStore()
const settingsStore = useSettingsStore()

/** True when any right-side panel (Overview / AI / Export) is open. */
const hasRightPanel = computed(() =>
  ['overview', 'ai', 'export'].includes(uiStore.activePanel)
)

// ── Pane resize helpers ──────────────────────────────────────────────────────
const sidebarResize = usePaneResize({
  cssVar: '--sidebar-width',
  min: 160,
  max: 400,
  storageKey: 'glyphastra_sidebar_width',
  getWidth: (x) => x,
})

const rightPanelResize = usePaneResize({
  cssVar: '--right-panel-width',
  min: 220,
  max: 520,
  storageKey: 'glyphastra_right_panel_width',
  getWidth: (x) => window.innerWidth - x,
})

// Start background chapter auto-summariser
useSummaryManager()

// Apply persisted theme immediately
uiStore.setTheme(settingsStore.settings.theme)

// Persist the last-open story ID so we can reload it on restart
watch(() => storyStore.currentStoryId, (id) => {
  if (id) localStorage.setItem(LAST_STORY_KEY, id)
})

onMounted(async () => {
  // Restore persisted pane widths
  sidebarResize.restoreWidth()
  rightPanelResize.restoreWidth()

  // Merge any story folders on disk that aren't yet in the localStorage index
  await reconcileProjectsList()

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
    // First launch: show the built-in help story instead of a blank canvas
    loaded = await loadOrCreateHelpStory()
  }

  // Ensure the help story always exists in the sidebar (background creation, no switch)
  ensureHelpStoryExists().catch(() => {})

  // Auto-select first chapter if none selected
  if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
    storyStore.setCurrentChapter(storyStore.chapters[0].id)
  }

  // Initialize keyboard shortcuts
  initializeKeyboardShortcuts()

  registerDefaultShortcuts({
    'new-chapter': () => {},
    'save': () => {},
    'search': () => { uiStore.toggleSearchPanel() },
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

  // Start onboarding tour on first launch
  if (!localStorage.getItem(ONBOARDING_KEY)) {
    setTimeout(() => uiStore.startTour(), 600)
  }

  if (storyStore.chapters.length === 0) {
    uiStore.showNotification('Welcome to Glyph Astra! Create your first chapter to get started.', 'info', 0)
  }
})
</script>

<style scoped>
.app-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background-color: var(--bg-primary);
}

/* ── Pane divider overlay ──────────────────────────────────────────── */
.pane-divider {
  width: 0;
  position: relative;
  overflow: visible;
  z-index: 20;
  flex-shrink: 0;
}

/* Hit area — centered on the boundary, extends slightly into each pane */
.divider-handle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 48px;
  cursor: col-resize;
}

/* Visible pill */
.divider-handle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--border-color);
  transition: height var(--transition-fast), background-color var(--transition-fast);
}
.divider-handle:hover::before,
.divider-handle:active::before {
  height: 32px;
  background: var(--accent-color);
}
</style>