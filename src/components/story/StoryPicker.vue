<template>
  <div class="story-section">
    <button class="story-title-btn" @click="showPicker = !showPicker" :title="currentStoryTitle">
      <span class="story-name">{{ currentStoryTitle }}</span>
      <AppIcon :path="showPicker ? mdiChevronUp : mdiChevronDown" :size="14" class="story-caret" />
    </button>

    <div v-if="showPicker" class="story-picker">
      <button class="story-new-btn" @click="createAndSwitchStory"><AppIcon :path="mdiPlusCircleOutline" :size="16" style="vertical-align:middle;margin-right:4px" />New Story</button>
      <div class="story-list">
        <div
          v-for="proj in savedProjects"
          :key="proj.id"
          class="story-item"
          :class="{ active: proj.id === storyStore.currentStoryId }"
        >
          <button class="story-item-info" @click="switchToStory(proj.id)">
            <span class="story-item-name">{{ proj.name }}</span>
            <span class="story-item-date">{{ formatDate(proj.lastModified) }}</span>
          </button>
          <button
            class="story-item-delete"
            title="Delete story"
            @click.stop="requestDeleteStory(proj.id, proj.name)"
          ><AppIcon :path="mdiDeleteOutline" :size="14" /></button>
        </div>
        <div v-if="savedProjects.length === 0" class="story-item-empty">No saved stories</div>
      </div>
    </div>
  </div>

  <!-- Delete-story confirmation modal -->
  <Teleport to="body">
    <div v-if="pendingDelete" class="delete-confirm-backdrop" @click.self="pendingDelete = null">
      <div class="delete-confirm-modal">
        <p class="delete-confirm-title">Delete story?</p>
        <p class="delete-confirm-body">
          "{{ pendingDelete.name }}" and all its chapters will be permanently removed.
          This cannot be undone.
        </p>
        <div class="delete-confirm-actions">
          <button class="delete-confirm-cancel" @click="pendingDelete = null">Cancel</button>
          <button class="delete-confirm-ok" @click="executeDeleteStory">Delete</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { mdiPlusCircleOutline, mdiDeleteOutline, mdiChevronUp, mdiChevronDown } from '@mdi/js'
import { useStoryStore } from '@/stores/storyStore'
import { useUIStore } from '@/stores/uiStore'
import { useEditorStore } from '@/stores/editorStore'
import { storageManager } from '@/utils/storage/storage'
import { HELP_STORY_ID } from '@/utils/story/helpStory'

const storyStore = useStoryStore()
const editorStore = useEditorStore()
const uiStore = useUIStore()

const showPicker = ref(false)

const close = () => { showPicker.value = false }
defineExpose({ close })

const currentStoryTitle = computed(() => storyStore.metadata.title || 'Untitled Story')

const savedProjects = computed(() => {
  const projects = storageManager.getProjectsList()
  const currentId = storyStore.currentStoryId
  const liveTitle = storyStore.metadata.title
  return [...projects]
    .map((p) => p.id === currentId ? { ...p, name: liveTitle || p.name } : p)
    .sort((a, b) => {
      const mDiff = new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      if (mDiff !== 0) return mDiff
      const createdB = parseInt(b.id.split('-')[1] ?? '0') || 0
      const createdA = parseInt(a.id.split('-')[1] ?? '0') || 0
      return createdB - createdA
    })
})

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso)
    const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return `${datePart} · ${timePart}`
  } catch {
    return ''
  }
}

const pendingDelete = ref<{ id: string; name: string } | null>(null)

const requestDeleteStory = (id: string, name: string) => {
  if (id === HELP_STORY_ID) {
    uiStore.showNotification(
      'The help story cannot be deleted. You can reset it to its original content from Settings → Help.',
      'info', 4000
    )
    return
  }
  pendingDelete.value = { id, name }
}

const executeDeleteStory = async () => {
  if (!pendingDelete.value) return
  const { id } = pendingDelete.value
  pendingDelete.value = null
  const wasCurrent = id === storyStore.currentStoryId
  await storyStore.deleteStory(id)
  const remaining = storageManager.getProjectsList()
  if (wasCurrent) {
    if (remaining.length > 0) {
      const sorted = [...remaining].sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      )
      await storyStore.loadStory(sorted[0].id)
      if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
        storyStore.setCurrentChapter(storyStore.chapters[0].id)
      }
    } else {
      storyStore.createNewStory('My Story')
    }
  }
  showPicker.value = remaining.length > 0
}

/** Flush current chapter, save, then load the selected story */
const switchToStory = async (id: string) => {
  if (id === storyStore.currentStoryId) {
    showPicker.value = false
    return
  }
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
  if (!storyStore.currentChapterId && storyStore.chapters.length > 0) {
    storyStore.setCurrentChapter(storyStore.chapters[0].id)
  }
  showPicker.value = false
}

const createAndSwitchStory = async () => {
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
  showPicker.value = false
}
</script>

<style scoped>
.story-section {
  margin: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  background-color: var(--bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
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
  background-color: var(--bg-card-hover);
}

.story-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.story-caret {
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.story-picker {
}

.story-new-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--accent-color);
  font-size: 13px;
  font-weight: 500;
}

.story-new-btn:hover {
  background-color: var(--bg-card-hover);
}

.story-list {
  max-height: 200px;
  overflow-y: auto;
}

.story-item {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: transparent;
}

.story-item:hover {
  background-color: var(--bg-card-hover);
}

.story-item.active {
  background-color: color-mix(in srgb, var(--accent-color) 15%, transparent);
}

.story-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
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

.story-item-delete {
  flex-shrink: 0;
  padding: 0 var(--spacing-md);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast), color var(--transition-fast);
  align-self: stretch;
  display: flex;
  align-items: center;
}

.story-item:hover .story-item-delete {
  opacity: 1;
}

.story-item-delete:hover {
  color: var(--error-color) !important;
}

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

.story-item-empty {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
