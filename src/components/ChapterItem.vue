<template>
  <div class="chapter-item" :class="{ active: isActive }" @click="selectSelf">
    <div class="chapter-content">
      <div class="chapter-name-row">
        <span class="chapter-name">{{ chapter.name }}</span>
        <span v-if="chapter.isPlotOutline" class="badge badge-outline" title="Plot outline — injected into every AI prompt">▸ Outline</span>
      </div>
      <div class="chapter-meta">
        <span class="status" :class="`status-${chapter.status}`">
          {{ chapter.status }}
        </span>
        <span class="word-count">{{ chapter.wordCount }} words</span>
        <span v-if="chapter.contextTags && chapter.contextTags.length" class="tags-badge" :title="chapter.contextTags.join(', ')">
          &#x2317; {{ chapter.contextTags.length }}
        </span>
        <span v-if="chapter.summary" class="summary-badge" title="AI summary available">&#x2299;</span>
      </div>
    </div>
    <div class="chapter-actions" v-show="isActive">
      <button class="action-btn" @click.stop="openMeta" title="Edit properties">&#x2261;</button>
      <button class="action-btn delete" @click.stop="deleteThis" title="Delete">
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chapter } from '@/stores/storyStore'

interface Props {
  chapter: Chapter
  isActive: boolean
}

interface Emits {
  (e: 'select', id: string): void
  (e: 'delete', id: string): void
  (e: 'edit-meta', id: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectSelf = () => {
  emit('select', props.chapter.id)
}

const deleteThis = () => {
  emit('delete', props.chapter.id)
}

const openMeta = () => {
  emit('edit-meta', props.chapter.id)
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
  gap: var(--spacing-xs);
}

.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 14px;
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
