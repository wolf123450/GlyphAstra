<template>
  <aside class="export-panel" v-if="isVisible">
    <div class="export-header">
      <h3>Export / Import</h3>
      <button class="close-btn" @click="closePanel" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose"/></svg></button>
    </div>

    <div class="export-content">

      <!-- Export full story -->
      <section class="ex-section">
        <div class="sec-label">Export story</div>
        <div class="btn-col">
          <button class="ex-btn" @click="doExport('story-md')" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiLanguageMarkdown"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">Markdown</span>
              <span class="ex-desc">All chapters as one .md file</span>
            </span>
          </button>
          <button class="ex-btn" @click="doExport('story-html')" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiLanguageHtml5"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">HTML</span>
              <span class="ex-desc">Styled page, printable to PDF</span>
            </span>
          </button>
          <button class="ex-btn" @click="doExport('story-docx')" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiFileWordOutline"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">Word (.docx)</span>
              <span class="ex-desc">Word-compatible document</span>
            </span>
          </button>
          <button class="ex-btn" @click="doExport('story-epub')" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiBookOpenPageVariant"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">EPUB (.epub)</span>
              <span class="ex-desc">E-reader compatible ebook</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Export current chapter -->
      <section class="ex-section">
        <div class="sec-label">Export current chapter</div>
        <div v-if="currentChapter" class="current-ch-name">{{ currentChapter.name }}</div>
        <div v-else class="hint">No chapter selected</div>
        <div class="btn-col">
          <button class="ex-btn" @click="doExport('chapter-md')" :disabled="busy || !currentChapter">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiLanguageMarkdown"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">Markdown</span>
              <span class="ex-desc">Current chapter as .md file</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Import -->
      <section class="ex-section">
        <div class="sec-label">Import</div>
        <div class="btn-col">
          <button class="ex-btn" @click="doImport" :disabled="busy">
            <span class="ex-icon">⬆</span>
            <span class="ex-info">
              <span class="ex-name">Import Markdown</span>
              <span class="ex-desc">Add .md file as new chapter</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Backup & Restore -->
      <section class="ex-section">
        <div class="sec-label">Backup &amp; Restore</div>
        <div class="btn-col">
          <button class="ex-btn" @click="doBackup" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDatabaseExportOutline"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">Export backup</span>
              <span class="ex-desc">Full story + AI data to .json</span>
            </span>
          </button>
          <button class="ex-btn" @click="doRestoreBackup" :disabled="busy">
            <span class="ex-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDatabaseImportOutline"/></svg></span>
            <span class="ex-info">
              <span class="ex-name">Restore backup</span>
              <span class="ex-desc">Load a .json backup as new story</span>
            </span>
          </button>
        </div>
      </section>

      <!-- Status -->
      <div v-if="status" class="status-msg" :class="statusType">{{ status }}</div>
      <div v-if="busy" class="status-msg info">Working…</div>

    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useStoryStore } from '@/stores/storyStore'
import { useEditorStore } from '@/stores/editorStore'
import {
  exportStoryToMarkdown,
  exportChapterToMarkdown,
  exportStoryToHTML,
  exportStoryToDocx,
  exportStoryToEpub,
  importMarkdownAsChapter,
  type ExportChapter,
  type ExportMeta,
} from '@/utils/storage/exportImport'
import { exportBackup, importBackup } from '@/utils/storage/backupRestore'
import { logger } from '@/utils/logger'
import {
  mdiClose,
  mdiLanguageMarkdown,
  mdiLanguageHtml5,
  mdiFileWordOutline,
  mdiBookOpenPageVariant,
  mdiDatabaseExportOutline,
  mdiDatabaseImportOutline,
} from '@mdi/js'

const uiStore     = useUIStore()
const storyStore  = useStoryStore()
const editorStore = useEditorStore()

const isVisible     = computed(() => uiStore.activePanel === 'export')
const currentChapter = computed(() => storyStore.currentChapter)

const busy       = ref(false)
const status     = ref('')
const statusType = ref<'ok' | 'err' | 'info'>('info')

const closePanel = () => uiStore.setActivePanel('editor')

/** Build chapter list for export — injects unsaved editor content for the active chapter */
const buildChapters = (): ExportChapter[] =>
  storyStore.chapters.map((ch, i) => ({
    name:    ch.name,
    content: ch.id === storyStore.currentChapterId
      ? editorStore.content   // live (possibly unsaved) content
      : ch.content,
    order: i,
    label:              ch.chapterLabel       || undefined,
    chapterType:        ch.chapterType        || undefined,
    illustrationPath:   ch.illustrationPath   || undefined,
    illustrationCaption: ch.illustrationCaption || undefined,
  }))

const buildMeta = (): ExportMeta => ({
  title:   storyStore.metadata.title,
  genre:   storyStore.metadata.genre  || undefined,
  tone:    storyStore.metadata.tone   || undefined,
  summary: storyStore.metadata.summary || undefined,
})

const setStatus = (msg: string, type: 'ok' | 'err' | 'info' = 'ok') => {
  status.value    = msg
  statusType.value = type
  setTimeout(() => { status.value = '' }, 4000)
}

const doExport = async (kind: string) => {
  busy.value = true
  status.value = ''
  try {
    let ok = false
    if (kind === 'story-md') {
      ok = await exportStoryToMarkdown(buildMeta(), buildChapters())
    } else if (kind === 'story-html') {
      ok = await exportStoryToHTML(buildMeta(), buildChapters(), storyStore.currentStoryId ?? undefined)
    } else if (kind === 'story-docx') {
      ok = await exportStoryToDocx(buildMeta(), buildChapters())
    } else if (kind === 'story-epub') {
      ok = await exportStoryToEpub(buildMeta(), buildChapters(), storyStore.currentStoryId ?? undefined)
    } else if (kind === 'chapter-md') {
      const ch = currentChapter.value
      if (ch) ok = await exportChapterToMarkdown(ch.name, editorStore.content)
    }
    if (ok) setStatus('Exported successfully.', 'ok')
    else     setStatus('Export cancelled.', 'info')
  } catch (e) {
    logger.error('Export', e)
    setStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`, 'err')
  } finally {
    busy.value = false
  }
}

const doImport = async () => {
  busy.value = true
  status.value = ''
  try {
    const result = await importMarkdownAsChapter()
    if (!result) { setStatus('Import cancelled.', 'info'); return }
    const id = `chapter-${Date.now()}`
    const wc = result.content.split(/\s+/).filter(Boolean).length
    storyStore.addChapter({
      id,
      name: result.name,
      path: `chapters/${id}`,
      status: 'draft',
      wordCount: wc,
      lastEdited: new Date().toISOString(),
      content: result.content,
    })
    storyStore.setCurrentChapter(id)
    setStatus(`Imported "${result.name}".`, 'ok')
  } catch (e) {
    logger.error('Import', e)
    setStatus(`Import failed: ${e instanceof Error ? e.message : String(e)}`, 'err')
  } finally {
    busy.value = false
  }
}

const doBackup = async () => {
  busy.value = true
  status.value = ''
  try {
    const ok = await exportBackup(
      storyStore.currentStoryId ?? 'unknown',
      storyStore.metadata,
      storyStore.chapters,
      storyStore.characters,
    )
    if (ok) setStatus('Backup saved.', 'ok')
    else     setStatus('Backup cancelled.', 'info')
  } catch (e) {
    logger.error('Backup', e)
    setStatus(`Backup failed: ${e instanceof Error ? e.message : String(e)}`, 'err')
  } finally {
    busy.value = false
  }
}

const doRestoreBackup = async () => {
  busy.value = true
  status.value = ''
  try {
    const backup = await importBackup()
    if (!backup) { setStatus('Restore cancelled.', 'info'); return }
    const newId = storyStore.restoreFromBackup(backup)
    await storyStore.saveStory(newId)
    setStatus(`Restored "${backup.metadata.title}".`, 'ok')
  } catch (e) {
    logger.error('Restore', e)
    setStatus(`Restore failed: ${e instanceof Error ? e.message : String(e)}`, 'err')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.export-panel {
  width: var(--right-panel-width);
  min-width: 220px;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.export-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  height: 52px;
  flex-shrink: 0;
}
.export-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary); }

.export-content {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.ex-section {
  background: var(--bg-primary); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); padding: var(--spacing-md);
  display: flex; flex-direction: column; gap: var(--spacing-sm);
}


.current-ch-name {
  font-size: 13px; color: var(--text-secondary);
  font-style: italic;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}


.btn-col { display: flex; flex-direction: column; gap: 6px; }

.ex-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: var(--bg-secondary);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  cursor: pointer; text-align: left; width: 100%;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.ex-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: var(--bg-tertiary);
}
.ex-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.ex-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
.ex-info { display: flex; flex-direction: column; gap: 2px; }
.ex-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.ex-desc { font-size: 11px; color: var(--text-tertiary); }

.status-msg {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}
.status-msg.ok  { background: color-mix(in srgb, var(--success-color) 12%, transparent); color: var(--success-color); }
.status-msg.err { background: color-mix(in srgb, var(--error-color)   12%, transparent); color: var(--error-color); }
.status-msg.info { background: var(--bg-tertiary); color: var(--text-tertiary); }
</style>
