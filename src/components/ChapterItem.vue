<template>
  <div class="chapter-item" :class="{ active: isActive }" @click="selectSelf">
    <div class="chapter-content">
      <div class="chapter-name">{{ chapter.name }}</div>
      <div class="chapter-meta">
        <span class="status" :class="`status-${chapter.status}`">
          {{ chapter.status }}
        </span>
        <span class="word-count">{{ chapter.wordCount }} words</span>
      </div>
    </div>
    <div class="chapter-actions" v-show="isActive">
      <button class="action-btn" @click.stop="renameThis" title="Rename">
        ✎
      </button>
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
  (e: 'rename', id: string, newName: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectSelf = () => {
  emit('select', props.chapter.id)
}

const deleteThis = () => {
  emit('delete', props.chapter.id)
}

const renameThis = () => {
  const newName = prompt('New chapter name:', props.chapter.name)
  if (newName && newName.trim()) {
    emit('rename', props.chapter.id, newName.trim())
  }
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

.chapter-name {
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-meta {
  display: flex;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--text-tertiary);
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
  background-color: #e74c3c;
}
</style>
