<template>
  <aside class="overview-panel" v-if="isVisible">
    <div class="overview-header">
      <h3>Story Overview</h3>
      <button class="close-btn" @click="closeOverview" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose"/></svg></button>
    </div>

    <div class="overview-content">
      <!-- Story Metadata -->
      <section class="overview-section">
        <h4>Story Info</h4>
        <div class="info-item">
          <label>Title:</label>
          <input v-model="metadata.title" type="text" placeholder="Story title" />
        </div>
        <div class="info-item">
          <label>Genre:</label>
          <input v-model="metadata.genre" type="text" placeholder="e.g., Fantasy, Sci-Fi" />
        </div>
        <div class="info-item">
          <label>Tone:</label>
          <input v-model="metadata.tone" type="text" placeholder="e.g., Dark, Humorous" />
        </div>
        <div class="info-item">
          <label>Summary:</label>
          <textarea v-model="metadata.summary" placeholder="Story summary..." rows="4"></textarea>
        </div>
      </section>

      <!-- Statistics -->
      <section class="overview-section">
        <h4>Statistics</h4>
        <div class="stat-row">
          <span>Total Words:</span>
          <strong>{{ totalWordCount }}</strong>
        </div>
        <div class="stat-row">
          <span>Chapters:</span>
          <strong>{{ chapters.length }}</strong>
        </div>
        <div class="stat-row">
          <span>Created:</span>
          <span class="text-muted">{{ formatDate(metadata.createdDate) }}</span>
        </div>
        <div class="stat-row">
          <span>Last Modified:</span>
          <span class="text-muted">{{ formatDate(metadata.lastModified) }}</span>
        </div>
      </section>

      <!-- Characters -->
      <section class="overview-section">
        <div class="section-header">
          <h4>Characters</h4>
          <button class="btn-add" @click="addCharacter" title="Add character">⊕</button>
        </div>
        <div class="character-list">
          <div v-if="characters.length === 0" class="empty-list">
            No characters added yet
          </div>
          <div v-for="char in characters" :key="char.id" class="character-item">
            <div class="character-name">{{ char.name }}</div>
            <div v-if="char.role" class="character-role">{{ char.role }}</div>
            <div class="character-actions">
              <button class="action-btn" @click="editCharacter(char)" title="Edit">✎</button>
              <button class="action-btn delete" @click="deleteCharacter(char.id)" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDeleteOutline"/></svg></button>
            </div>
          </div>
        </div>
      </section>

      <!-- Save Button -->
      <button class="btn-save" @click="saveOverview">Save Changes</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mdiClose, mdiDeleteOutline } from '@mdi/js'
import { useStoryStore } from '@/stores/storyStore'
import { useUIStore } from '@/stores/uiStore'
import type { Character } from '@/stores/storyStore'

const storyStore = useStoryStore()
const uiStore = useUIStore()

const isVisible = computed(() => uiStore.activePanel === 'overview')
const chapters = computed(() => storyStore.chapters)
const totalWordCount = computed(() => storyStore.totalWordCount)
const characters = computed(() => storyStore.characters)

// Bind directly to the store object — no local copy needed.
// When the story switches, storyStore.metadata is replaced and Vue
// re-renders the template automatically.
const metadata = computed(() => storyStore.metadata)

const closeOverview = () => {
  uiStore.setActivePanel('editor')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}

const addCharacter = () => {
  const name = prompt('Character name:')
  if (name && name.trim()) {
    const character: Character = {
      id: `char-${Date.now()}`,
      name: name.trim(),
      description: '',
      role: '',
    }
    storyStore.addCharacter(character)
  }
}

const editCharacter = (char: Character) => {
  const newRole = prompt('Character role:', char.role || '')
  if (newRole !== null) {
    storyStore.updateCharacter(char.id, { role: newRole })
  }
}

const deleteCharacter = (id: string) => {
  if (confirm('Delete this character?')) {
    storyStore.deleteCharacter(id)
  }
}

const saveOverview = async () => {
  // Fields are already live-bound to storyStore.metadata via v-model,
  // so just trigger a save and update lastModified.
  storyStore.updateMetadata({})
  await storyStore.saveStory()
  uiStore.showNotification('Story overview saved!', 'success')
}
</script>

<style scoped>
.overview-panel {
  width: 300px;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideInRight var(--transition-normal);
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  height: 52px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.overview-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.overview-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.overview-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-header h4 {
  margin: 0;
}

.btn-add {
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.btn-add:hover {
  background-color: var(--accent-hover);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.info-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-item input,
.info-item textarea {
  font-size: 13px;
  padding: var(--spacing-sm);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
}

.stat-row strong {
  color: var(--accent-color);
  font-weight: 600;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty-list {
  padding: var(--spacing-md);
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.character-item {
  padding: var(--spacing-md);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  transition: all var(--transition-fast);
}

.character-item:hover {
  border-color: var(--accent-color);
  background-color: var(--bg-tertiary);
}

.character-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}

.character-role {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.character-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.action-btn {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  transition: all var(--transition-fast);
  color: var(--text-primary);
}

.action-btn:hover {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.action-btn.delete:hover {
  background-color: var(--error-color);
  border-color: var(--error-color);
}

.btn-save {
  width: 100%;
  padding: var(--spacing-md);
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  transition: all var(--transition-fast);
  margin-top: auto;
}

.btn-save:hover {
  background-color: var(--accent-hover);
  transform: translateY(-1px);
}
</style>
