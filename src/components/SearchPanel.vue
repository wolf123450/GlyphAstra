<template>
  <Teleport to="body">
    <div v-if="uiStore.showSearchPanel" class="search-overlay" @click.self="close">
      <div class="search-panel" ref="panelEl" @keydown="onKeydown">

        <!-- ── Input ─────────────────────────────────────────── -->
        <div class="search-input-row">
          <span class="search-icon">⌕</span>
          <input
            ref="inputEl"
            v-model="query"
            class="search-input"
            :placeholder="'Search chapters… (Esc to close)'"
            autocomplete="off"
            spellcheck="false"
          />
          <button v-if="query" class="clear-btn" @click="query = ''" title="Clear">✕</button>
        </div>

        <!-- ── TOC (empty query) ─────────────────────────────── -->
        <div v-if="!query.trim()" class="search-body">
          <div class="section-label">Table of Contents</div>
          <div v-if="chapters.length === 0" class="empty-state">No chapters yet.</div>
          <div
            v-for="ch in chapters"
            :key="ch.id"
            class="toc-item"
            :class="{ active: ch.id === currentChapterId }"
            @click="navigate(ch.id)"
          >
            <span class="toc-name">{{ ch.name }}</span>
            <span class="toc-meta">{{ ch.wordCount }} words · {{ statusLabel(ch.status) }}</span>
          </div>
        </div>

        <!-- ── Results (non-empty query) ────────────────────── -->
        <div v-else class="search-body">
          <div class="section-label">
            {{ totalMatches }} match{{ totalMatches === 1 ? '' : 'es' }} across {{ resultGroups.length }} chapter{{ resultGroups.length === 1 ? '' : 's' }}
          </div>
          <div v-if="resultGroups.length === 0" class="empty-state">No results for <em>{{ query }}</em></div>
          <template v-for="group in resultGroups" :key="group.chapterId">
            <div class="result-chapter-header" @click="navigate(group.chapterId)">
              <span class="result-chapter-name">{{ group.chapterName }}</span>
              <span class="result-count">{{ group.snippets.length }} match{{ group.snippets.length === 1 ? '' : 'es' }}</span>
            </div>
            <div
              v-for="(snip, si) in group.snippets"
              :key="`${group.chapterId}-${si}`"
              class="result-snippet"
              :class="{ focused: focusedIndex === snip.globalIndex }"
              @click="navigate(group.chapterId)"
              @mouseenter="focusedIndex = snip.globalIndex"
            >
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="snippet-text" v-html="snip.html"></span>
            </div>
          </template>
        </div>

        <!-- ── Footer ─────────────────────────────────────────── -->
        <div class="search-footer">
          <span v-if="!query.trim()">{{ chapters.length }} chapter{{ chapters.length === 1 ? '' : 's' }} · {{ totalWords.toLocaleString() }} words total</span>
          <span v-else>↑↓ navigate &nbsp;·&nbsp; Enter jump &nbsp;·&nbsp; Esc close</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'

// ── Stores ────────────────────────────────────────────────────────────────────
const uiStore = useUIStore()
const storyStore = useStoryStore()
const editorStore = useEditorStore()

// ── Refs ──────────────────────────────────────────────────────────────────────
const query = ref('')
const focusedIndex = ref(0)
const panelEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────
const chapters = computed(() => storyStore.chapters)
const currentChapterId = computed(() => storyStore.currentChapterId)
const totalWords = computed(() => storyStore.totalWordCount)

// Get live content: for the currently-open chapter, use editorStore (may have unsaved changes)
function getContent(chapterId: string): string {
  if (chapterId === storyStore.currentChapterId) {
    return editorStore.content
  }
  return storyStore.getChapterById(chapterId)?.content ?? ''
}

// ── Search logic ──────────────────────────────────────────────────────────────

const SNIPPET_RADIUS = 80  // chars on each side of match

function escapeRegex(s: string): string {
  return s.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Strip markdown to plain text for snippet display */
function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')          // fenced code
    .replace(/`[^`]+`/g, '')                  // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')          // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // bold/italic/strike
    .replace(/^\s*[-*>]\s+/gm, '')            // bullets / blockquotes
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered lists
    .replace(/^---+$/gm, '')                  // hr
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
}

interface Snippet {
  html: string
  globalIndex: number
}

interface ResultGroup {
  chapterId: string
  chapterName: string
  snippets: Snippet[]
}

const resultGroups = computed((): ResultGroup[] => {
  const q = query.value.trim()
  if (!q) return []

  const re = new RegExp(escapeRegex(q), 'gi')
  let globalIndex = 0
  const groups: ResultGroup[] = []

  for (const ch of storyStore.chapters) {
    const plain = stripMd(getContent(ch.id))
    const snippets: Snippet[] = []

    let match: RegExpExecArray | null
    re.lastIndex = 0
    const seenOffsets = new Set<number>()

    while ((match = re.exec(plain)) !== null) {
      const pos = match.index
      // Deduplicate snippets that are very close together (within 2*radius)
      const bucket = Math.floor(pos / (SNIPPET_RADIUS * 2))
      if (seenOffsets.has(bucket)) continue
      seenOffsets.add(bucket)

      const start = Math.max(0, pos - SNIPPET_RADIUS)
      const end = Math.min(plain.length, pos + q.length + SNIPPET_RADIUS)
      let raw = plain.slice(start, end)
      if (start > 0) raw = '…' + raw
      if (end < plain.length) raw = raw + '…'

      // Highlight matches in snippet
      const html = escapeHtml(raw).replace(
        new RegExp(escapeRegex(escapeHtml(q)), 'gi'),
        '<mark>$&</mark>'
      )

      snippets.push({ html, globalIndex: globalIndex++ })

      if (snippets.length >= 3) break // max 3 snippets per chapter
    }

    if (snippets.length > 0) {
      groups.push({ chapterId: ch.id, chapterName: ch.name, snippets })
    }
  }

  return groups
})

const totalMatches = computed(() =>
  resultGroups.value.reduce((n, g) => n + g.snippets.length, 0)
)

// ── Keyboard handling ─────────────────────────────────────────────────────────

const allSnippets = computed(() =>
  resultGroups.value.flatMap((g) => g.snippets.map((s) => ({ ...s, chapterId: g.chapterId })))
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { close(); return }

  if (query.value.trim() && allSnippets.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusedIndex.value = (focusedIndex.value + 1) % allSnippets.value.length
      scrollFocused()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusedIndex.value = (focusedIndex.value - 1 + allSnippets.value.length) % allSnippets.value.length
      scrollFocused()
    } else if (e.key === 'Enter') {
      const item = allSnippets.value.find((s) => s.globalIndex === focusedIndex.value)
      if (item) navigate(item.chapterId)
    }
  }
}

function scrollFocused() {
  nextTick(() => {
    const el = panelEl.value?.querySelector('.result-snippet.focused') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────

function navigate(chapterId: string) {
  storyStore.setCurrentChapter(chapterId)
  close()
}

function close() {
  uiStore.showSearchPanel = false
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    'in-progress': 'In Progress',
    complete: 'Complete',
  }
  return map[status] ?? status
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(
  () => uiStore.showSearchPanel,
  async (visible) => {
    if (visible) {
      query.value = ''
      focusedIndex.value = 0
      await nextTick()
      inputEl.value?.focus()
    }
  }
)

// Reset focused index when results change
watch(resultGroups, () => { focusedIndex.value = 0 })
</script>

<style scoped>
/* ─── Overlay ─────────────────────────────────────────── */
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  backdrop-filter: blur(2px);
}

/* ─── Panel shell ─────────────────────────────────────── */
.search-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 560px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  outline: none;
}

/* ─── Input row ───────────────────────────────────────── */
.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.search-icon {
  font-size: 17px;
  color: var(--text-muted);
  flex-shrink: 0;
  line-height: 1;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  caret-color: var(--accent-color);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 3px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.clear-btn:hover { color: var(--text-primary); }

/* ─── Scrollable body ─────────────────────────────────── */
.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* ─── Section label ───────────────────────────────────── */
.section-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 6px 16px 4px;
}

/* ─── TOC items ───────────────────────────────────────── */
.toc-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.1s;
  border-radius: 0;
}
.toc-item:hover { background: var(--bg-hover, color-mix(in srgb, var(--bg-primary) 40%, var(--bg-secondary))); }
.toc-item.active { background: color-mix(in srgb, var(--accent-color) 12%, transparent); }

.toc-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toc-meta {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ─── Search results ──────────────────────────────────── */
.result-chapter-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 16px 4px;
  cursor: pointer;
}
.result-chapter-header:hover .result-chapter-name { color: var(--accent-color); }

.result-chapter-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  transition: color 0.15s;
}
.result-count {
  font-size: 10px;
  color: var(--text-muted);
}

.result-snippet {
  padding: 5px 16px 5px 24px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 6px;
  transition: background 0.1s;
}
.result-snippet:hover,
.result-snippet.focused {
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
}

.snippet-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  display: block;
  font-family: inherit;
}

/* Highlight matched text */
.snippet-text :deep(mark) {
  background: color-mix(in srgb, var(--accent-color) 35%, transparent);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}

/* ─── Empty state ─────────────────────────────────────── */
.empty-state {
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

/* ─── Footer ──────────────────────────────────────────── */
.search-footer {
  padding: 8px 16px;
  font-size: 11px;
  color: var(--text-muted);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
</style>
