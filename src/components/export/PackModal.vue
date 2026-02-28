<template>
  <Teleport to="body">
    <div v-if="show" class="pack-overlay" @click.self="$emit('close')">
      <div class="pack-modal" role="dialog" aria-modal="true" aria-label="Pack images">
        <!-- Header -->
        <div class="pack-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="pack-header-icon">
            <path :d="mdiArchive" />
          </svg>
          <span>Pack Images</span>
          <button class="pack-close-btn" @click="$emit('close')" title="Close">✕</button>
        </div>

        <!-- Body -->
        <div class="pack-body">
          <!-- Idle state (not yet run) -->
          <div v-if="state === 'idle'" class="pack-intro">
            <p>Pack stores a copy of every image referenced in your story inside the AppData folder, so images display correctly on other machines and inside exported files.</p>
            <label class="pack-force-label">
              <input v-model="forceRepack" type="checkbox" />
              Force re-pack all (ignore already-packed images)
            </label>
          </div>

          <!-- Scanning / packing in-progress -->
          <div v-else-if="state === 'packing'" class="pack-working">
            <div class="pack-spinner" />
            <span>Packing images…</span>
          </div>

          <!-- Done -->
          <div v-else-if="state === 'done'" class="pack-result">
            <div class="pack-summary">
              <span class="pack-stat packed">✓ {{ result!.packed }} packed</span>
              <span class="pack-stat skipped">⊘ {{ result!.skipped }} skipped</span>
              <template v-if="result!.failed > 0">
                <span class="pack-stat failed">✕ {{ result!.failed }} failed</span>
              </template>
              <span class="pack-stat total">of {{ result!.total }} total</span>
            </div>

            <div v-if="result!.failedSrcs.length > 0" class="pack-failed-list">
              <p class="pack-failed-heading">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:4px">
                  <path :d="mdiImageBrokenVariant" />
                </svg>
                Could not resolve the following images:
              </p>
              <ul>
                <li v-for="entry in result!.failedDetails" :key="entry.src" class="pack-failed-item">
                  <span class="pack-failed-src" :title="entry.src">{{ entry.src }}</span>
                  <span class="pack-failed-error">{{ entry.error }}</span>
                </li>
              </ul>
              <p class="pack-failed-hint">
                Check that these files exist in your story folder or that the remote URL is accessible.
              </p>
            </div>

            <label class="pack-force-label">
              <input v-model="forceRepack" type="checkbox" />
              Force re-pack all next time
            </label>
          </div>

          <!-- Error -->
          <div v-else-if="state === 'error'" class="pack-error">
            <p>An error occurred while packing: {{ errorMsg }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="pack-footer">
          <button
            v-if="state !== 'packing'"
            class="pack-btn pack-btn-primary"
            @click="runPack"
          >
            {{ state === 'done' ? 'Pack again' : 'Pack now' }}
          </button>
          <button class="pack-btn pack-btn-secondary" @click="$emit('close')">
            {{ state === 'done' ? 'Close' : 'Cancel' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { mdiArchive, mdiImageBrokenVariant } from '@mdi/js'
import { packAllImages } from '@/utils/media/imagePackManager'
import type { PackResult } from '@/utils/media/imagePackManager'
import { useStoryStore } from '@/stores/storyStore'

const props = defineProps<{
  show: boolean
  /** If true, the modal will scroll to the failed-images section after packing. */
  focusFailed?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'packed'): void
}>()

const storyStore = useStoryStore()

type State = 'idle' | 'packing' | 'done' | 'error'

const state      = ref<State>('idle')
const result     = ref<PackResult | null>(null)
const errorMsg   = ref('')
const forceRepack = ref(false)

// Reset to idle whenever the modal opens
watch(() => props.show, (val) => {
  if (val) {
    state.value    = 'idle'
    result.value   = null
    errorMsg.value = ''
  }
})

async function runPack() {
  const storyId = storyStore.currentStoryId
  if (!storyId) return

  // Collect all chapter markdown
  const chapters = storyStore.chapters
  const markdownContents = chapters.map(c => c.content ?? '')

  state.value = 'packing'
  try {
    result.value  = await packAllImages(storyId, markdownContents, forceRepack.value)
    state.value   = 'done'
    emit('packed')
  } catch (err: unknown) {
    state.value   = 'error'
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<style scoped>
.pack-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.pack-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: min(520px, 92vw);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

/* Header */
.pack-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.pack-header-icon { color: var(--accent-color); flex-shrink: 0; }
.pack-header span { flex: 1; }
.pack-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
}
.pack-close-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

/* Body */
.pack-body {
  padding: 16px;
  min-height: 80px;
}

.pack-intro p {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.pack-working {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
}
.pack-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: pack-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes pack-spin { to { transform: rotate(360deg); } }

.pack-result { font-size: 13px; }

.pack-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  font-size: 13px;
}
.pack-stat { padding: 3px 8px; border-radius: 4px; font-weight: 500; }
.pack-stat.packed  { background: rgba(76, 175, 80, 0.15);  color: #4caf50; }
.pack-stat.skipped { background: rgba(158, 158, 158, 0.12); color: var(--text-secondary); }
.pack-stat.failed  { background: rgba(244, 67, 54, 0.15);  color: var(--error-color, #f44336); }
.pack-stat.total   { color: var(--text-secondary); }

.pack-failed-list {
  background: rgba(244, 67, 54, 0.07);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.pack-failed-heading {
  margin: 0 0 8px;
  color: var(--error-color, #f44336);
  font-weight: 500;
}
.pack-failed-list ul {
  margin: 0 0 8px;
  padding-left: 18px;
  max-height: 140px;
  overflow-y: auto;
}
.pack-failed-src {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}
.pack-failed-error {
  font-size: 11px;
  color: var(--error-color, #f44336);
  opacity: 0.85;
  word-break: break-word;
}
.pack-failed-item {
  margin-bottom: 8px;
}
.pack-failed-hint { margin: 0; color: var(--text-secondary); font-size: 12px; }

.pack-error { color: var(--error-color, #f44336); font-size: 13px; }

.pack-force-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.pack-force-label input { cursor: pointer; }

/* Footer */
.pack-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.pack-btn {
  padding: 6px 14px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s, opacity 0.15s;
}
.pack-btn:disabled { opacity: 0.5; cursor: default; }
.pack-btn-primary  { background: var(--accent-color); color: #fff; }
.pack-btn-primary:hover:not(:disabled) { opacity: 0.88; }
.pack-btn-secondary {
  background: var(--bg-hover, rgba(128,128,128,0.15));
  color: var(--text-primary);
}
.pack-btn-secondary:hover { background: var(--border-color); }
</style>
