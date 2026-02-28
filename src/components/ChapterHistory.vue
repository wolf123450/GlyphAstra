<template>
  <Teleport to="body">
    <div v-if="show" class="hist-overlay" @click.self="$emit('close')">
      <div class="hist-modal" role="dialog" aria-modal="true" aria-label="Version History" @keydown.esc.prevent="$emit('close')" tabindex="-1">

        <!-- Header -->
        <div class="hist-header">
          <div class="hist-title-row">
            <svg class="hist-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiHistory"/></svg>
            <h3 class="hist-title">Version History</h3>
            <span class="hist-subtitle">{{ chapterName }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')" title="Close" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="mdiClose"/></svg></button>
        </div>

        <!-- Body -->
        <div class="hist-body">

          <!-- Left: snapshot list -->
          <div class="hist-list">
            <div v-if="loading" class="hist-status">Loading…</div>
            <div v-else-if="entries.length === 0" class="hist-status hist-empty-msg">
              No snapshots yet.<br>
              Snapshots are captured automatically on each save when meaningful changes are detected.
            </div>
            <button
              v-else
              v-for="entry in entries"
              :key="entry.savedAt"
              class="snap-item"
              :class="{ active: selectedEntry === entry }"
              @click="selectedEntry = entry"
            >
              <span class="snap-time">{{ formatTime(entry.savedAt) }}</span>
              <span class="snap-date">{{ formatShortDate(entry.savedAt) }}</span>
              <span class="snap-wc">{{ entry.wordCount }} words</span>
            </button>
          </div>

          <!-- Right: preview / diff -->
          <div class="hist-preview">
            <div v-if="!selectedEntry" class="hist-no-sel">
              <span>Select a snapshot from the list to preview it</span>
            </div>
            <template v-else>
              <div class="preview-toolbar">
                <div class="diff-mode-group">
                  <button class="diff-mode-btn" :class="{ active: diffMode === 'none' }"     @click="diffMode = 'none'">
                    <span class="dmb-glyph">◈</span><span class="dmb-label">Preview</span>
                  </button>
                  <button class="diff-mode-btn" :class="{ active: diffMode === 'current' }"  @click="diffMode = 'current'">
                    <span class="dmb-glyph">⇔</span><span class="dmb-label">vs&nbsp;Current</span>
                  </button>
                  <button class="diff-mode-btn" :class="{ active: diffMode === 'previous', disabled: !hasPrevious }" @click="diffMode = 'previous'" :disabled="!hasPrevious">
                    <span class="dmb-glyph">⇦</span><span class="dmb-label">vs&nbsp;Previous</span>
                  </button>
                </div>
                <span class="snapshot-age">{{ formatDateFull(selectedEntry.savedAt) }}</span>
                <button class="btn-restore" @click="restore"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path :d="mdiArrowULeftTop"/></svg> Restore</button>
              </div>
              <div class="preview-scroll">
                <div
                  v-if="diffMode === 'none'"
                  class="preview-content markdown-body"
                  v-html="renderedSnapshot"
                />
                <div v-else class="diff-view">
                  <div class="diff-legend">
                    <span class="legend-del">■ removed</span>
                    <span class="legend-add">■ added</span>
                  </div>
                  <div
                    v-for="(line, i) in diffLines"
                    :key="i"
                    class="diff-line"
                    :class="line.type"
                  >
                    <template v-if="line.segments && line.segments.length">
                      <span
                        v-for="(seg, j) in line.segments"
                        :key="j"
                        :class="{ 'diff-char': seg.changed, 'diff-marker': seg.marker }"
                      >{{ seg.text }}</span>
                    </template>
                    <template v-else>{{ line.text === '' ? '\u00a0' : line.text }}</template>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Footer -->
        <div class="hist-footer">
          <span v-if="restoredMsg" class="restored-msg">{{ restoredMsg }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'
import { getHistory, type HistoryEntry } from '@/utils/historyManager'
import { renderMarkdown } from '@/utils/markdownRenderer'
import { sanitizeHtml } from '@/utils/sanitize'
import { computeLineDiff, pairDelAdd, type DiffLine } from '@/utils/diffEngine'
import { mdiHistory, mdiArrowULeftTop, mdiClose } from '@mdi/js'

interface Props {
  show: boolean
}

const props = defineProps<Props>()
defineEmits<{ (e: 'close'): void }>()

const storyStore  = useStoryStore()
const editorStore = useEditorStore()

const entries       = ref<HistoryEntry[]>([])
const loading       = ref(false)
const selectedEntry = ref<HistoryEntry | null>(null)
const diffMode      = ref<'none' | 'current' | 'previous'>('none')
const restoredMsg   = ref('')

const chapterName = computed(() => storyStore.currentChapter?.name ?? 'Unknown')

// ─── When the selection changes, disable 'previous' mode if already at last ─
watch(selectedEntry, () => {
  if (diffMode.value === 'previous' && !hasPrevious.value) {
    diffMode.value = 'current'
  }
})

// ─── Load history when modal opens ───────────────────────────────────────────
watch(() => props.show, async (visible) => {
  if (!visible) {
    // Reset state on close
    selectedEntry.value = null
    diffMode.value      = 'none'
    restoredMsg.value   = ''
    return
  }
  loading.value = true
  try {
    const storyId   = storyStore.currentStoryId
    const chapterId = storyStore.currentChapterId
    if (!storyId || !chapterId) { entries.value = []; return }
    entries.value = await getHistory(storyId, chapterId)
    // Pre-select the most recent snapshot
    if (entries.value.length > 0) selectedEntry.value = entries.value[0]
  } finally {
    loading.value = false
  }
})

// ─── Markdown preview of selected snapshot ───────────────────────────────────
const renderedSnapshot = computed(() => {
  if (!selectedEntry.value) return ''
  return sanitizeHtml(renderMarkdown(selectedEntry.value.content, 0, 'preview'))
})

// ─── hasPrevious + diffTarget ───────────────────────────────────────────────
const hasPrevious = computed(() => {
  if (!selectedEntry.value) return false
  const idx = entries.value.indexOf(selectedEntry.value)
  return idx < entries.value.length - 1
})

const diffLines = computed<DiffLine[]>(() => {
  if (diffMode.value === 'none' || !selectedEntry.value) return []
  let base: string
  let comparison: string
  if (diffMode.value === 'current') {
    // Show what changed from the snapshot up to now: snapshot = base, editor = new
    base       = selectedEntry.value.content
    comparison = editorStore.content
  } else {
    // Show what changed from the previous snapshot to this one
    const idx  = entries.value.indexOf(selectedEntry.value)
    const prev = entries.value[idx + 1]
    if (!prev) return []
    base       = prev.content                    // older = base (del = removed)
    comparison = selectedEntry.value.content     // newer = comparison (add = added)
  }
  return pairDelAdd(computeLineDiff(base, comparison))
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatShortDate(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}


function formatDateFull(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Restore ──────────────────────────────────────────────────────────────────
function restore() {
  if (!selectedEntry.value) return
  editorStore.setContent(selectedEntry.value.content)
  restoredMsg.value = '✓ Editor content replaced'
  setTimeout(() => { restoredMsg.value = '' }, 3000)
}
</script>

<style scoped>
.hist-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.hist-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg, 10px);
  width: min(920px, 92vw);
  height: min(640px, 88vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* Header */
.hist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  border-radius: var(--radius-lg, 10px) var(--radius-lg, 10px) 0 0;
  height: 52px;
  flex-shrink: 0;
  gap: var(--spacing-md);
}

.hist-title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  overflow: hidden;
}

.hist-icon { font-size: 16px; flex-shrink: 0; }

.hist-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  flex-shrink: 0;
}

.hist-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-btn {
  font-size: 18px;
  flex-shrink: 0;
}

/* Body */
.hist-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Snapshot list */
.hist-list {
  width: 250px;
  min-width: 220px;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.hist-status {
  padding: var(--spacing-md);
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.hist-empty-msg { line-height: 1.5; }

.snap-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px var(--spacing-md);
  border: none;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.snap-item:hover { background: var(--bg-tertiary); }
.snap-item.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.snap-time {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.snap-item.active .snap-time { color: white; }

.snap-date {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 1px;
}
.snap-item.active .snap-date { color: rgba(255,255,255,0.8); }

.snap-wc {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
.snap-item.active .snap-wc { color: rgba(255,255,255,0.6); }

/* Preview pane */
.hist-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hist-no-sel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
  gap: var(--spacing-md);
}

/* Segmented diff-mode button group — mirrors editor mode-btn style */
.diff-mode-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 2px;
  flex-shrink: 0;
}

.diff-mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) - 1px);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: all var(--transition-fast);
  user-select: none;
}
.diff-mode-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.diff-mode-btn.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}
.diff-mode-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dmb-glyph { font-size: 13px; line-height: 1; }
.dmb-label { font-size: 11px; font-weight: 500; }

.snapshot-age {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  flex: 1;
  text-align: center;
}

.preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
}

/* Markdown preview inside history */
.preview-content {
  font-family: var(--editor-font-family, inherit);
  font-size: var(--editor-font-size, 14px);
  line-height: var(--editor-line-height, 1.6);
}
.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3) {
  color: var(--text-primary);
  margin-top: 1em;
  margin-bottom: 0.4em;
}
.preview-content :deep(p) {
  color: var(--text-primary);
  line-height: 1.65;
  margin-bottom: 0.75em;
}
.preview-content :deep(em)     { color: var(--text-secondary); }
.preview-content :deep(strong) { color: var(--text-primary); }
.preview-content :deep(blockquote) {
  border-left: 3px solid var(--border-color);
  margin: 0;
  padding-left: var(--spacing-md);
  color: var(--text-secondary);
}
.preview-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
}
.preview-content :deep(th),
.preview-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 4px 8px;
  text-align: left;
}
.preview-content :deep(thead th) {
  background-color: var(--bg-tertiary);
  font-weight: 600;
}
.preview-content :deep(ul),
.preview-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.preview-content :deep(li) {
  margin-bottom: 0.25em;
}
.preview-content :deep(pre) {
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  padding: 0.5em;
  overflow-x: auto;
}
.preview-content :deep(code) {
  background-color: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
}

/* Diff view */
.diff-view {
  font-family: var(--editor-font-family, 'Fira Code', monospace);
  font-size: var(--editor-font-size, 13px);
  line-height: var(--editor-line-height, 1.55);
}

.diff-legend {
  display: flex;
  gap: var(--spacing-lg);
  font-size: 11px;
  margin-bottom: var(--spacing-md);
}
.legend-del { color: var(--error-color); }
.legend-add { color: var(--success-color); }

.diff-line {
  padding: 1px 6px;
  border-radius: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}
.diff-line.same { color: var(--text-secondary); }

/* Line background tint — no global text color override; chars handle their own color */
.diff-line.del  { background: color-mix(in srgb, var(--error-color) 10%, transparent); }
.diff-line.add  { background: color-mix(in srgb, var(--success-color) 8%, transparent); }

/* Unchanged chars within a modified line — muted so changed chars stand out */
.diff-line.del span:not(.diff-char) { color: color-mix(in srgb, var(--error-color) 55%, var(--text-secondary)); }
.diff-line.add span:not(.diff-char) { color: color-mix(in srgb, var(--success-color) 55%, var(--text-secondary)); }

/* Inline character-level highlight — full color + stronger background */
.diff-line.del .diff-char {
  background: color-mix(in srgb, var(--error-color) 40%, transparent);
  color: var(--error-color);
  border-radius: 2px;
  padding: 0 1px;
}
.diff-line.add .diff-char {
  background: color-mix(in srgb, var(--success-color) 35%, transparent);
  color: var(--success-color);
  border-radius: 2px;
  padding: 0 1px;
}

/* Zero-width deletion-point marker on the add line */
.diff-line.add .diff-marker {
  display: inline-block;
  width: 2px;
  height: 1em;
  vertical-align: middle;
  border-radius: 1px;
  background: var(--success-color);
  padding: 0;
}

/* Footer */
.hist-footer {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  min-height: 36px;
  flex-shrink: 0;
}

.btn-restore {
  padding: 6px 14px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-restore:hover { opacity: 0.85; }
.btn-restore:disabled { opacity: 0.4; cursor: not-allowed; }

.restored-msg {
  font-size: 12px;
  color: var(--success-color);
}
</style>
