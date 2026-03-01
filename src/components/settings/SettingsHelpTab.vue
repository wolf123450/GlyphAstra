<template>
  <div class="tab-content help-tab">

    <div v-if="IconGallery" class="help-section">
      <h3 class="help-section-title">Icons</h3>
      <p class="setting-hint">Compare Phosphor and Material Design icon candidates for the UI overhaul (Phase 11.x).</p>
      <button class="btn-sm help-btn" @click="showIconGallery = true">&#9783; Browse icon gallery</button>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Onboarding</h3>
      <p class="setting-hint">Take the guided tour to learn the key areas of the app.</p>
      <button class="btn-sm help-btn" @click="startTour">&#9654; Take the tour</button>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Help Story</h3>
      <p class="setting-hint">The built-in help story contains reference material and sandbox chapters.</p>
      <div class="help-btn-row">
        <button class="btn-sm help-btn" @click="openHelpStory">Open help story</button>
        <button class="btn-sm help-btn" @click="resetHelpContent">Reset help content</button>
      </div>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">About</h3>
      <p class="setting-hint">BlockBreaker v{{ appVersion }}</p>
    </div>

    <component :is="IconGallery" v-if="IconGallery && showIconGallery" :show="showIconGallery" @close="showIconGallery = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { loadOrCreateHelpStory, resetHelpStory } from '@/utils/story/helpStoryService'
import { version as appVersion } from '../../../package.json'

const uiStore = useUIStore()
const storyStore = useStoryStore()

// Dev-only: lazy-load IconGallery so it is tree-shaken in production builds
const IconGallery = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../export/IconGallery.vue'))
  : null

const showIconGallery = ref(false)

async function openHelpStory() {
  uiStore.showSettings = false
  await loadOrCreateHelpStory()
  const chapters = storyStore.chapters
  if (chapters.length > 0) {
    storyStore.setCurrentChapter(chapters[0].id)
  }
}

async function resetHelpContent() {
  await resetHelpStory()
  uiStore.showNotification('Help story reference chapters have been reset.', 'success')
}

function startTour() {
  uiStore.showSettings = false
  uiStore.startTour()
}
</script>

<style scoped>
@import './settingsStyles.css';

.help-tab { display: flex; flex-direction: column; gap: var(--spacing-xl); }
.help-section { display: flex; flex-direction: column; gap: 8px; }
.help-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}
.help-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.help-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.help-btn:hover { background: var(--bg-hover); border-color: var(--accent-color); }
</style>
