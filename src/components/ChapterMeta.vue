<template>
  <Teleport to="body">
    <div v-if="show && chapter" class="meta-backdrop" @mousedown.self="close">
      <div class="meta-modal" role="dialog" aria-modal="true">

        <!-- Header -->
        <div class="meta-header">
          <h2 class="meta-title">Chapter Properties</h2>
          <button class="close-btn" @click="close" title="Close (Esc)">&#x2715;</button>
        </div>

        <div class="meta-body">

          <!-- Title -->
          <div class="field-group">
            <label class="field-label">Title</label>
            <input
              v-model="draft.name"
              class="field-input"
              type="text"
              placeholder="Chapter title"
              @keydown.enter.prevent="saveAndClose"
            />
          </div>

          <!-- Status -->
          <div class="field-group">
            <label class="field-label">Status</label>
            <div class="pill-row">
              <button
                v-for="s in statusOptions"
                :key="s.value"
                class="pill"
                :class="[`pill-status-${s.value}`, { active: draft.status === s.value }]"
                @click="draft.status = s.value"
              >{{ s.label }}</button>
            </div>
          </div>

          <!-- Display label -->
          <div class="field-group">
            <label class="field-label">Display label
              <span class="label-hint">— shown in sidebar and as export heading prefix</span>
            </label>
            <input
              v-model="draft.chapterLabel"
              class="field-input"
              type="text"
              placeholder="e.g. Prologue, Chapter 4, Part II… (leave blank for auto-numbering)"
            />
            <div class="label-preset-row">
              <button class="label-preset" @click="draft.chapterLabel = 'Prologue'">Prologue</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Epilogue'">Epilogue</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Interlude'">Interlude</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Appendix'">Appendix</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Part I'">Part I</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Part II'">Part II</button>
              <button class="label-preset" @click="draft.chapterLabel = 'Part III'">Part III</button>
              <button v-if="draft.chapterLabel" class="label-preset label-preset--clear" @click="draft.chapterLabel = ''">&#x2715; Clear</button>
            </div>
          </div>

          <!-- Chapter Type -->
          <div class="field-group">
            <label class="field-label">Chapter type</label>
            <div class="pill-row">
              <button
                class="pill"
                :class="{ active: !draft.isPlotOutline }"
                @click="draft.isPlotOutline = false"
              >Normal</button>
              <button
                class="pill pill-outline"
                :class="{ active: draft.isPlotOutline }"
                @click="draft.isPlotOutline = true"
                title="Injected as the story outline layer in every AI prompt"
              >&#x25B8; Plot Outline</button>
            </div>
            <p v-if="draft.isPlotOutline" class="field-hint">
              This chapter's content will be injected as a story outline in every AI prompt.
              <template v-if="otherOutlineChapter">
                <strong>Warning:</strong> "{{ otherOutlineChapter.name }}" is also marked as a plot outline — only the first will be used.
              </template>
            </p>
          </div>

          <!-- Context Tags -->
          <div class="field-group">
            <label class="field-label">Context tags
              <span class="label-hint">— untagged chapters are always included in AI context</span>
            </label>
            <div class="tag-editor">
              <div class="tag-chips">
                <span
                  v-for="tag in draft.contextTags"
                  :key="tag"
                  class="tag-chip"
                >{{ tag }}<button class="chip-remove" @click="removeTag(tag)" title="Remove tag">&#x2715;</button></span>
                <input
                  ref="tagInputRef"
                  v-model="tagInputValue"
                  class="tag-input"
                  type="text"
                  placeholder="Add tag…"
                  @keydown="onTagKeydown"
                  @blur="commitTagInput"
                  autocomplete="off"
                />
              </div>
              <div v-if="tagSuggestions.length > 0" class="tag-suggestions">
                <button
                  v-for="s in tagSuggestions"
                  :key="s"
                  class="tag-suggestion-item"
                  @mousedown.prevent="addTag(s)"
                >{{ s }}</button>
              </div>
            </div>
            <p class="field-hint">Press Enter or comma to add. Examples: POV: Alice, Timeline A, Subplot: Heist</p>
          </div>

          <!-- Summary Section -->
          <div class="field-group summary-group">
            <div class="summary-header-row">
              <label class="field-label">AI Summary</label>
              <div class="summary-actions">
                <button
                  class="btn-sm"
                  :disabled="isRegenerating || !aiStore.isConnected"
                  @click="regenerate"
                  :title="aiStore.isConnected ? 'Regenerate summary now' : 'Ollama not connected'"
                >{{ isRegenerating ? '…' : '⟳ Regenerate' }}</button>
              </div>
            </div>

            <!-- Manual edit warning -->
            <div v-if="draft.summaryManuallyEdited" class="summary-warn">
              &#9888; Manual edit active — will not update automatically.
              Regenerate to replace.
            </div>

            <!-- Paused warning -->
            <div v-if="draft.summaryPaused" class="summary-info">
              &#9208; Auto-summary is paused for this chapter.
            </div>

            <textarea
              v-model="draft.summary"
              class="summary-textarea"
              :placeholder="chapter.summaryGeneratedAt ? '' : 'No summary yet. Click Regenerate to generate one.'"
              rows="4"
              @input="draft.summaryManuallyEdited = true"
            ></textarea>

            <div class="summary-meta-row">
              <span class="summary-ts">
                {{ summaryTimestamp }}
              </span>
              <label class="pause-label">
                <input type="checkbox" v-model="draft.summaryPaused" />
                Pause auto-summary
              </label>
            </div>
          </div>

          <!-- Read-only toggle -->
          <div class="field-group">
            <label class="pause-label readonly-toggle">
              <input type="checkbox" v-model="draft.isReadOnly" />
              Lock chapter (read-only) — disable editing in the editor
            </label>
            <p class="field-hint">Useful for reference chapters or finished work you don’t want to accidentally change.</p>
          </div>

        </div>

        <!-- Footer -->
        <div class="meta-footer">
          <button class="btn-secondary" @click="close">Cancel</button>
          <button class="btn-primary" @click="saveAndClose">Save</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useAIStore } from '@/stores/aiStore'
import { triggerSummary } from '@/utils/summaryManager'

interface Props {
  show: boolean
  chapterId: string | null
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit  = defineEmits<Emits>()

const storyStore = useStoryStore()
const aiStore    = useAIStore()

// ─── Draft state ──────────────────────────────────────────────────────────────

interface DraftState {
  name: string
  chapterLabel: string
  status: 'draft' | 'in-progress' | 'complete'
  isPlotOutline: boolean
  isReadOnly: boolean
  contextTags: string[]
  summary: string
  summaryPaused: boolean
  summaryManuallyEdited: boolean
}

const draft = ref<DraftState>({
  name: '',
  chapterLabel: '',
  status: 'draft',
  isPlotOutline: false,
  isReadOnly: false,
  contextTags: [],
  summary: '',
  summaryPaused: false,
  summaryManuallyEdited: false,
})

// ─── Source chapter ───────────────────────────────────────────────────────────

const chapter = computed(() =>
  props.chapterId ? storyStore.getChapterById(props.chapterId) : null
)

watch(
  () => props.show,
  (visible) => {
    if (visible && chapter.value) {
      const ch = chapter.value
      draft.value = {
        name:                  ch.name,
        chapterLabel:          ch.chapterLabel ?? '',
        status:                ch.status,
        isPlotOutline:         ch.isPlotOutline ?? false,
        isReadOnly:            ch.isReadOnly ?? false,
        contextTags:           [...(ch.contextTags ?? [])],
        summary:               ch.summary ?? '',
        summaryPaused:         ch.summaryPaused ?? false,
        summaryManuallyEdited: ch.summaryManuallyEdited ?? false,
      }
    }
  },
  { immediate: true }
)

// ─── Options ──────────────────────────────────────────────────────────────────

const statusOptions = [
  { value: 'draft'       as const, label: 'Draft' },
  { value: 'in-progress' as const, label: 'In Progress' },
  { value: 'complete'    as const, label: 'Complete' },
]

/** Any other chapter (not this one) that is also a plot outline — warn if found. */
const otherOutlineChapter = computed(() =>
  draft.value.isPlotOutline
    ? storyStore.chapters.find(c => c.id !== props.chapterId && c.isPlotOutline)
    : null
)

// ─── Tag input ────────────────────────────────────────────────────────────────

const tagInputRef    = ref<HTMLInputElement | null>(null)
const tagInputValue  = ref('')

const tagSuggestions = computed(() => {
  const q = tagInputValue.value.trim().toLowerCase()
  if (!q) return []
  return storyStore.allContextTags.filter(
    t => t.toLowerCase().includes(q) && !draft.value.contextTags.includes(t)
  ).slice(0, 6)
})

const addTag = (raw: string) => {
  const tag = raw.trim()
  if (tag && !draft.value.contextTags.includes(tag)) {
    draft.value.contextTags.push(tag)
  }
  tagInputValue.value = ''
  nextTick(() => tagInputRef.value?.focus())
}

const removeTag = (tag: string) => {
  draft.value.contextTags = draft.value.contextTags.filter(t => t !== tag)
}

const commitTagInput = () => {
  if (tagInputValue.value.trim()) addTag(tagInputValue.value)
}

const onTagKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    commitTagInput()
  } else if (e.key === 'Backspace' && tagInputValue.value === '') {
    draft.value.contextTags.pop()
  }
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

const summaryTimestamp = computed(() => {
  const ts = chapter.value?.summaryGeneratedAt
  if (!ts) return 'Never generated'
  const diffMs = Date.now() - ts
  const mins  = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days  = Math.floor(diffMs / 86_400_000)
  if (mins < 1)   return 'Generated just now'
  if (hours < 1)  return `Generated ${mins} minute${mins !== 1 ? 's' : ''} ago`
  if (days < 1)   return `Generated ${hours} hour${hours !== 1 ? 's' : ''} ago`
  return `Generated ${days} day${days !== 1 ? 's' : ''} ago`
})

const isRegenerating = ref(false)

const regenerate = async () => {
  if (!props.chapterId || isRegenerating.value) return
  // Save current draft first so the summary manager sees the latest name etc.
  saveChapter()
  isRegenerating.value = true
  try {
    await triggerSummary(props.chapterId)
    // Refresh draft summary from store after generation
    const updated = storyStore.getChapterById(props.chapterId)
    if (updated) {
      draft.value.summary               = updated.summary ?? ''
      draft.value.summaryManuallyEdited = false
    }
  } finally {
    isRegenerating.value = false
  }
}

// ─── Save / close ─────────────────────────────────────────────────────────────

const saveChapter = () => {
  if (!props.chapterId) return
  storyStore.updateChapter(props.chapterId, {
    name:                  draft.value.name.trim() || chapter.value?.name,
    chapterLabel:          draft.value.chapterLabel.trim() || undefined,
    status:                draft.value.status,
    isPlotOutline:         draft.value.isPlotOutline,
    isReadOnly:            draft.value.isReadOnly,
    contextTags:           draft.value.contextTags,
    summary:               draft.value.summary,
    summaryPaused:         draft.value.summaryPaused,
    summaryManuallyEdited: draft.value.summaryManuallyEdited,
  })
}

const saveAndClose = () => {
  saveChapter()
  close()
}

const close = () => {
  tagInputValue.value = ''
  emit('close')
}

// Keyboard: Escape closes
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) close()
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
}
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<style scoped>
.meta-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1100;
}

.meta-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 520px; max-width: 95vw;
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}

.meta-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.meta-title {
  font-size: 16px; font-weight: 600; margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none; border: none; cursor: pointer;
  font-size: 16px; color: var(--text-tertiary);
  padding: 4px 8px; border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.close-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

.meta-body {
  flex: 1; overflow-y: auto;
  padding: var(--spacing-lg);
  display: flex; flex-direction: column; gap: var(--spacing-lg);
}

/* Field groups */
.field-group { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.field-label {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--text-tertiary);
}
.label-hint {
  font-weight: 400; text-transform: none; letter-spacing: 0;
  font-size: 11px; color: var(--text-tertiary);
}

.field-input {
  width: 100%; box-sizing: border-box;
  padding: 7px 10px; font-size: 14px;
  background: var(--bg-primary); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  outline: none; font-family: inherit;
}
.field-input:focus { border-color: var(--accent-color); }

.field-hint { font-size: 11px; color: var(--text-tertiary); margin: 0; }

/* Pills */
.pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
.pill {
  padding: 4px 12px; font-size: 12px;
  border: 1px solid var(--border-color); border-radius: 20px;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: all var(--transition-fast);
}
.pill:hover  { border-color: var(--accent-color); color: var(--accent-color); }
.pill.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
.pill-outline { border-style: dashed; }
.pill-status-draft.active       { background: var(--status-draft-bg); border-color: var(--status-draft-bg); color: var(--status-draft-fg); }
.pill-status-in-progress.active { background: var(--status-progress-bg); border-color: var(--status-progress-bg); color: var(--status-progress-fg); }
.pill-status-complete.active    { background: var(--status-complete-bg); border-color: var(--status-complete-bg); color: var(--status-complete-fg); }

/* Label presets */
.label-preset-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.label-preset {
  padding: 2px 9px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 99px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}
.label-preset:hover { border-color: var(--accent-color); color: var(--accent-color); }
.label-preset--clear { color: var(--error-color); border-color: currentColor; }
.label-preset--clear:hover { background: color-mix(in srgb, var(--error-color) 10%, transparent); }

/* Tag chips */
.tag-editor { position: relative; }
.tag-chips {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
  padding: 5px 8px; min-height: 36px;
  background: var(--bg-primary); border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); cursor: text;
}
.tag-chips:focus-within { border-color: var(--accent-color); }

.tag-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px; font-size: 12px;
  background: var(--accent-color); color: #fff;
}
.chip-remove {
  background: none; border: none; cursor: pointer;
  font-size: 10px; color: rgba(255,255,255,0.8); padding: 0;
  line-height: 1; transition: color 0.1s;
}
.chip-remove:hover { color: #fff; }

.tag-input {
  flex: 1; min-width: 80px; border: none; outline: none;
  background: transparent; color: var(--text-primary);
  font-size: 13px; font-family: inherit; padding: 2px 0;
}

.tag-suggestions {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  background: var(--bg-secondary); border: 1px solid var(--border-color);
  border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  max-height: 140px; overflow-y: auto;
}
.tag-suggestion-item {
  display: block; width: 100%; text-align: left;
  padding: 6px 10px; font-size: 13px;
  background: none; border: none; cursor: pointer; color: var(--text-primary);
}
.tag-suggestion-item:hover { background: var(--bg-tertiary); }

/* Summary */
.summary-group { gap: var(--spacing-md); }
.summary-header-row {
  display: flex; align-items: center; justify-content: space-between;
}

.summary-warn {
  padding: 8px 10px; border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--warning-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning-color) 30%, transparent);
  font-size: 12px; color: var(--text-secondary);
}
.summary-info {
  padding: 8px 10px; border-radius: var(--radius-sm);
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  font-size: 12px; color: var(--text-tertiary);
}

.summary-textarea {
  width: 100%; box-sizing: border-box;
  padding: 8px 10px; font-size: 13px; line-height: 1.55;
  background: var(--bg-primary); color: var(--text-primary);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  outline: none; resize: vertical; font-family: inherit; min-height: 80px;
}
.summary-textarea:focus { border-color: var(--accent-color); }

.summary-meta-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 11px; color: var(--text-tertiary);
}
.summary-ts { font-style: italic; }
.pause-label {
  display: flex; align-items: center; gap: 5px; cursor: pointer;
  user-select: none; font-size: 12px; color: var(--text-secondary);
}

/* Buttons */
.btn-sm {
  padding: 4px 10px; font-size: 12px;
  background: transparent; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text-secondary);
  transition: all var(--transition-fast);
}
.btn-sm:not(:disabled):hover { border-color: var(--accent-color); color: var(--accent-color); }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

/* Footer */
.meta-footer {
  display: flex; justify-content: flex-end; gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.btn-secondary {
  padding: 7px 18px; font-size: 13px;
  background: transparent; border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); cursor: pointer; color: var(--text-secondary);
  transition: all var(--transition-fast);
}
.btn-secondary:hover { border-color: var(--accent-color); color: var(--accent-color); }

.btn-primary {
  padding: 7px 18px; font-size: 13px;
  background: var(--accent-color); border: 1px solid var(--accent-color);
  border-radius: var(--radius-sm); cursor: pointer; color: #fff;
  font-weight: 600; transition: opacity var(--transition-fast);
}
.btn-primary:hover { opacity: 0.85; }
</style>
