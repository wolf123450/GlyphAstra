<template>
  <div
    class="chapter-item"
    :class="{ active: isActive }"
    :data-chapter-id="chapter.id"
    @click="selectSelf"
  >
    <span
      v-if="draggable"
      class="drag-handle"
      title="Drag to reorder"
      @mousedown.stop.prevent="onHandleDown"
    ><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDragVertical"/></svg></span>
    <div class="chapter-content">
      <div class="chapter-name-row">
          <span v-if="props.displayLabel" class="chapter-label" :title="chapter.chapterLabel ? 'Custom label' : 'Auto-numbered'">{{ props.displayLabel }}</span>
          <input
          v-if="isEditingTitle"
          ref="titleInput"
          v-model="editTitleValue"
          class="chapter-name-input"
          @blur="commitRename"
          @keydown.enter="commitRename"
          @keydown.esc="cancelRename"
          @click.stop
        />
        <span
          v-else
          class="chapter-name"
          title="Click to rename"
          @click.stop="startRename"
        >
          {{ chapter.name }}
          <svg class="edit-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiPencilOutline"/></svg>
        </span>
        <span v-if="chapter.isPlotOutline" class="badge badge-outline" title="Plot outline — injected into every AI prompt">▸ Outline</span>
        <span v-else-if="chapter.chapterType === 'toc'" class="badge badge-toc" title="Table of Contents — auto-generates chapter list on export">&#x2261; TOC</span>
        <span v-else-if="chapter.chapterType === 'cover'" class="badge badge-cover" title="Cover page">&#x25C6; Cover</span>
        <span v-else-if="chapter.chapterType === 'license'" class="badge badge-license" title="License / legal block">&#x2A3E; License</span>
        <span v-else-if="chapter.chapterType === 'illustration'" class="badge badge-illus" title="Illustration chapter">&#x25A1; Illus.</span>
      </div>
      <div class="chapter-meta">
        <span class="status" :class="`status-${chapter.status}`">
          {{ chapter.status }}
        </span>
        <span class="word-count">{{ chapter.wordCount }} words</span>
        <span v-if="chapter.contextTags && chapter.contextTags.length" class="tags-badge" :title="chapter.contextTags.join(', ')">
          &#x2317; {{ chapter.contextTags.length }}
        </span>
        <span v-if="chapter.summary" class="summary-badge" title="AI summary available"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiTextBoxOutline"/></svg></span>
      </div>
    </div>
    <div class="chapter-actions" v-show="isActive">
      <button class="action-btn delete" @click.stop="deleteThis" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDeleteOutline"/></svg></button>
      <button class="action-btn" @click.stop="openMeta" title="Edit properties"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDotsVertical"/></svg></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { mdiDragVertical, mdiPencilOutline, mdiDotsVertical, mdiDeleteOutline, mdiTextBoxOutline } from '@mdi/js'
import type { Chapter } from '@/stores/storyStore'

interface Props {
  chapter: Chapter
  isActive: boolean
  draggable?: boolean
  displayLabel?: string
}

interface Emits {
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'edit-meta', id: string): void
  (e: 'handle-down', id: string, event: MouseEvent): void
  (e: 'rename', id: string, newName: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isEditingTitle = ref(false)
const editTitleValue = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

const startRename = () => {
  selectSelf()
  isEditingTitle.value = true
  editTitleValue.value = props.chapter.name
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus()
      titleInput.value.select()
    }
  })
}

const commitRename = () => {
  if (!isEditingTitle.value) return
  const trimmed = editTitleValue.value.trim()
  if (trimmed && trimmed !== props.chapter.name) {
    emit('rename', props.chapter.id, trimmed)
  }
  isEditingTitle.value = false
}

const cancelRename = () => {
  isEditingTitle.value = false
}

const selectSelf = () => {
  emit('select', props.chapter.id)
}

const deleteThis = () => {
  emit('delete', props.chapter.id)
}

const openMeta = () => {
  emit('edit-meta', props.chapter.id)
}

const onHandleDown = (e: MouseEvent) => {
  emit('handle-down', props.chapter.id, e)
}
</script>

<style scoped>
.chapter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.drag-handle {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 16px;
  line-height: 1;
  padding-right: 6px;
  opacity: 0.35;
  cursor: grab;
  user-select: none;
  transition: opacity var(--transition-fast);
}
.chapter-item:hover .drag-handle {
  opacity: 0.7;
}
.chapter-item.active .drag-handle {
  color: white;
  opacity: 0.5;
}

.chapter-item:hover {
  background-color: var(--bg-tertiary);
  border-color: var(--accent-color);
}

.chapter-item.active {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.chapter-content {
  flex: 1;
  min-width: 0;
}

.chapter-name-row {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
}

.chapter-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1; min-width: 0;
  cursor: text;
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-icon {
  font-size: 12px;
  opacity: 0;
  transition: opacity var(--transition-fast);
  color: var(--text-tertiary);
}

.chapter-name:hover .edit-icon {
  opacity: 1;
}

.chapter-item.active .edit-icon {
  color: rgba(255, 255, 255, 0.7);
}

.chapter-name-input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 3px;
  padding: 0 4px;
  margin: -1px -5px;
  outline: none;
}

.chapter-item.active .chapter-name-input {
  color: var(--text-primary);
}

.chapter-label {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
  align-self: center;
  margin-right: 4px;
}

.chapter-item.active .chapter-label {
  background: rgba(255,255,255,0.15);
  border-color: rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.85);
}

.badge {
  display: inline-block; padding: 1px 5px;
  border-radius: 3px; font-size: 10px; font-weight: 600;
  white-space: nowrap; flex-shrink: 0;
}
.badge-outline {
  background: color-mix(in srgb, var(--accent-color) 15%, transparent);
  color: var(--accent-color); border: 1px solid currentColor;
}
.badge-toc {
  background: color-mix(in srgb, #7c5cbf 15%, transparent);
  color: #7c5cbf; border: 1px solid currentColor;
}
.badge-cover {
  background: color-mix(in srgb, #b08420 15%, transparent);
  color: #b08420; border: 1px solid currentColor;
}
.badge-license {
  background: color-mix(in srgb, #3a7d5a 15%, transparent);
  color: #3a7d5a; border: 1px solid currentColor;
}
.badge-illus {
  background: color-mix(in srgb, #1a6fa8 15%, transparent);
  color: #1a6fa8; border: 1px solid currentColor;
}

.chapter-meta {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-tertiary);
  align-items: center;
}

.tags-badge, .summary-badge {
  font-size: 11px; color: var(--text-tertiary); opacity: 0.7;
}

.chapter-item.active .chapter-meta {
  color: rgba(255, 255, 255, 0.7);
}

.status {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.chapter-item.active .status {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.status-draft {
  background-color: var(--status-draft-bg);
  color: var(--status-draft-fg);
}

.chapter-item.active .status-draft {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.status-in-progress {
  background-color: var(--status-progress-bg);
  color: var(--status-progress-fg);
}

.chapter-item.active .status-in-progress {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.status-complete {
  background-color: var(--status-complete-bg);
  color: var(--status-complete-fg);
}

.chapter-item.active .status-complete {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.word-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.chapter-item.active .word-count {
  color: rgba(255, 255, 255, 0.7);
}

.chapter-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: var(--spacing-xs);
}

.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.4;
  transition: all var(--transition-fast);
  color: white;
}

.action-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.action-btn.delete:hover {
  background-color: var(--error-color);
}
</style>
