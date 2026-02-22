<template>
  <Teleport to="body">
    <div v-if="show" class="hist-overlay" @click.self="$emit('close')">
      <div class="hist-modal" @keydown.esc.prevent="$emit('close')" tabindex="-1">

        <!-- Header -->
        <div class="hist-header">
          <div class="hist-title-row">
            <span class="hist-icon">⏱</span>
            <h3 class="hist-title">Version History</h3>
            <span class="hist-subtitle">{{ chapterName }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')" title="Close">✕</button>
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
                <button class="btn-restore" @click="restore">↩ Restore</button>
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
                        :class="{ 'diff-char': seg.changed }"
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
  return renderMarkdown(selectedEntry.value.content, 0, 'preview')
})

// ─── hasPrevious + diffTarget ───────────────────────────────────────────────
const hasPrevious = computed(() => {
  if (!selectedEntry.value) return false
  const idx = entries.value.indexOf(selectedEntry.value)
  return idx < entries.value.length - 1
})

const diffTarget = computed<string>(() => {
  if (diffMode.value === 'current') return editorStore.content
  if (diffMode.value === 'previous') {
    if (!selectedEntry.value) return ''
    const idx = entries.value.indexOf(selectedEntry.value)
    const prev = entries.value[idx + 1]
    return prev ? prev.content : ''
  }
  return ''
})

// ─── Line-level LCS diff ─────────────────────────────────────────────────────
type InlineSegment = { changed: boolean; text: string }
type DiffLine = { type: 'same' | 'add' | 'del'; text: string; segments?: InlineSegment[] }

function computeLineDiff(snapshotText: string, currentText: string): DiffLine[] {
  const a = snapshotText.split('\n')
  const b = currentText.split('\n')
  const m = a.length
  const n = b.length

  // Guard against very large texts for perf (fall back to two-block diff)
  if (m * n > 120_000) {
    return [
      { type: 'del', text: '— snapshot (too large for inline diff) —' },
      { type: 'add', text: '— current (too large for inline diff) —' },
    ]
  }

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // Backtrace
  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'same', text: a[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: b[j - 1] })     // added in current
      j--
    } else {
      result.unshift({ type: 'del', text: a[i - 1] })     // removed from snapshot
      i--
    }
  }
  return result
}

// ─── Char-level LCS helpers ──────────────────────────────────────────────────
function computeCharLCS(a: string, b: string): number[][] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp
}

/** Produce inline segments for `text` where chars NOT in LCS with `other` are marked changed. */
function charSegments(text: string, other: string): InlineSegment[] {
  if (!text) return [{ changed: false, text: '' }]
  if (!other || text.length * other.length > 80_000) return [{ changed: true, text }]

  const dp = computeCharLCS(text, other)
  const changed: boolean[] = new Array(text.length).fill(true)
  let i = text.length, j = other.length
  while (i > 0 && j > 0) {
    if (text[i - 1] === other[j - 1]) {
      changed[i - 1] = false
      i--; j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  const segs: InlineSegment[] = []
  let cur: InlineSegment = { changed: changed[0] ?? false, text: text[0] ?? '' }
  for (let k = 1; k < text.length; k++) {
    if (changed[k] === cur.changed) {
      cur.text += text[k]
    } else {
      segs.push(cur)
      cur = { changed: changed[k], text: text[k] }
    }
  }
  if (cur.text !== undefined) segs.push(cur)
  return segs
}

/** Scan pairs of adjacent del+add lines and attach char-level segments to each. */
function pairDelAdd(lines: DiffLine[]): DiffLine[] {
  const out: DiffLine[] = []
  let i = 0
  while (i < lines.length) {
    if (
      lines[i].type === 'del' &&
      i + 1 < lines.length &&
      lines[i + 1].type === 'add'
    ) {
      const delLine = lines[i]
      const addLine = lines[i + 1]
      out.push({ ...delLine, segments: charSegments(delLine.text, addLine.text) })
      out.push({ ...addLine, segments: charSegments(addLine.text, delLine.text) })
      i += 2
    } else {
      out.push(lines[i])
      i++
    }
  }
  return out
}

const diffLines = computed<DiffLine[]>(() => {
  if (diffMode.value === 'none' || !selectedEntry.value) return []
  return pairDelAdd(computeLineDiff(selectedEntry.value.content, diffTarget.value))
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
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.close-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

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
.diff-line.del  {
  background: color-mix(in srgb, var(--error-color) 12%, transparent);
  color: var(--error-color);
}
.diff-line.add  {
  background: color-mix(in srgb, var(--success-color) 10%, transparent);
  color: var(--success-color);
}

/* Inline character-level highlight — stronger than the line background */
.diff-line.del .diff-char {
  background: color-mix(in srgb, var(--error-color) 38%, transparent);
  border-radius: 2px;
  padding: 0 1px;
}
.diff-line.add .diff-char {
  background: color-mix(in srgb, var(--success-color) 32%, transparent);
  border-radius: 2px;
  padding: 0 1px;
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
