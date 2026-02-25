<template>
  <Teleport to="body">
    <div v-if="show" class="ig-backdrop" @click.self="emit('close')">
      <div class="ig-modal" role="dialog" aria-label="Icon Gallery">

        <!-- ── Header ──────────────────────────────────────────── -->
        <div class="ig-header">
          <h2 class="ig-title">Icon Selection</h2>
          <div class="ig-header-controls">
            <div class="ig-size-row">
              <span class="ig-weight-label">Size:</span>
              <button
                v-for="s in [16, 20, 24, 32]" :key="s"
                class="ig-weight-btn"
                :class="{ active: iconSize === s }"
                @click="iconSize = s"
              >{{ s }}</button>
            </div>
            <button class="ig-close-btn" @click="emit('close')" title="Close">✕</button>
          </div>
        </div>

        <!-- ── Legend ──────────────────────────────────────────── -->
        <div class="ig-legend">
          <span class="ig-badge ig-badge--now">Now</span> current glyph &ensp;
          <span class="ig-badge ig-badge--mdi">MDI</span> <a href="https://materialdesignicons.com" class="ig-link">Material Design Icons</a> &ensp;
          <span class="ig-hint">Click an icon to select it for that slot. Click again to deselect.</span>
        </div>

        <!-- ── Slots ───────────────────────────────────────────── -->
        <div class="ig-body">
          <div v-for="slot in slots" :key="slot.id" class="ig-slot">
            <div class="ig-slot-meta">
              <span class="ig-slot-name">{{ slot.name }}</span>
              <span v-if="selections[slot.id]" class="ig-slot-selection">
                ✓ {{ selections[slot.id]!.label }}
              </span>
              <span class="ig-slot-desc">{{ slot.description }}</span>
            </div>

            <div class="ig-card-row">
              <!-- Current glyph -->
              <div class="ig-card ig-card--now" title="Current glyph">
                <span class="ig-glyph" :style="{ fontSize: iconSize + 'px', lineHeight: 1 }">{{ slot.current }}</span>
                <span class="ig-card-name">current</span>
                <span class="ig-badge ig-badge--now">Now</span>
              </div>

              <!-- MDI candidates -->
              <div
                v-for="mdi in slot.mdiCandidates"
                :key="mdi.importName"
                class="ig-card ig-card--mdi"
                :class="{ 'ig-card--selected': selections[slot.id]?.importName === mdi.importName }"
                :title="mdi.importName"
                role="button"
                @click="selectIcon(slot.id, mdi)"
              >
                <svg
                  :width="iconSize"
                  :height="iconSize"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                ><path :d="mdi.path" /></svg>
                <span class="ig-card-name">{{ mdi.label }}</span>
                <span class="ig-badge ig-badge--mdi">MDI</span>
                <span v-if="selections[slot.id]?.importName === mdi.importName" class="ig-selected-check">✓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── JSON Export ──────────────────────────────────────── -->
        <div class="ig-json-panel">
          <div class="ig-json-header">
            <span class="ig-json-title">
              Selections
              <span class="ig-json-count">{{ selectedCount }} / {{ slots.length }}</span>
            </span>
            <div class="ig-json-actions">
              <button class="ig-json-btn" @click="clearAll" :disabled="selectedCount === 0">
                Clear all
              </button>
              <button class="ig-json-btn ig-json-btn--primary" @click="copyJson" :disabled="selectedCount === 0">
                {{ jsonCopied ? '✓ Copied!' : 'Copy JSON' }}
              </button>
            </div>
          </div>
          <textarea
            class="ig-json-output"
            readonly
            :value="jsonOutput"
            :placeholder="selectedCount === 0 ? 'Select icons above to build your replacement map…' : ''"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
        </div>

        <!-- ── Footer ──────────────────────────────────────────── -->
        <div class="ig-footer">
          <button class="ig-close-footer-btn" @click="emit('close')">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// ─── Material Design Icons ────────────────────────────────────────
import {
  // ── delete / close
  mdiClose,
  mdiCloseCircleOutline,
  mdiDelete,
  mdiDeleteOutline,
  mdiTrashCanOutline,
  // ── sidebar toggle
  mdiChevronLeft,
  mdiChevronDoubleLeft,
  mdiArrowCollapseLeft,
  mdiPageLayoutSidebarLeft,
  mdiMenuOpen,
  // ── seamless mode
  mdiPencilRuler,
  mdiFileEditOutline,
  mdiTextBoxEditOutline,
  mdiPencilOutline,
  mdiWaves,
  mdiApproximatelyEqualBox,
  // ── theme toggle
  mdiWeatherNight,
  mdiWeatherSunny,
  mdiWhiteBalanceSunny,
  mdiThemeLightDark,
  mdiBrightness6,
  mdiInvertColors,
  mdiCircleHalfFull,
  mdiLightbulbOutline,
  // ── summary badge
  mdiTextBoxOutline,
  mdiNotebookOutline,
  mdiCommentTextOutline,
  mdiFileDocumentOutline,
  // ── tags badge
  mdiTagOutline,
  mdiTagMultipleOutline,
  mdiLabelOutline,
  mdiPoundBoxOutline,
  mdiPound,
  mdiTag,
  // ── notification icons
  mdiCheckCircle,
  mdiCheckCircleOutline,
  mdiCloseCircle,
  mdiAlertCircle,
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiInformation,
  mdiInformationOutline,
  mdiInformationSlabCircleOutline,
  // ── export format icons
  mdiLanguageMarkdown,
  mdiLanguageMarkdownOutline,
  mdiLanguageHtml5,
  mdiFileWordOutline,
  mdiFilePdfBox,
  mdiCodeBrackets,
  // ── backup / restore icons
  mdiBackupRestore,
  mdiContentSaveAllOutline,
  mdiFolderArrowDownOutline,
  mdiFolderOpenOutline,
  mdiDatabaseExportOutline,
  mdiDatabaseImportOutline,
} from '@mdi/js'

// ─── Types ────────────────────────────────────────────────────────
interface MdiCandidate {
  label: string
  importName: string
  path: string
}
interface Slot {
  id: string
  name: string
  description: string
  current: string
  mdiCandidates: MdiCandidate[]
}

// ─── State ────────────────────────────────────────────────────────
defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const iconSize   = ref(24)
const selections = ref<Record<string, MdiCandidate | null>>({})
const jsonCopied = ref(false)

const selectIcon = (slotId: string, mdi: MdiCandidate) => {
  if (selections.value[slotId]?.importName === mdi.importName) {
    selections.value[slotId] = null
  } else {
    selections.value[slotId] = mdi
  }
}

const selectedCount = computed(() =>
  Object.values(selections.value).filter(Boolean).length
)

const jsonOutput = computed(() => {
  const result: Record<string, { label: string; importName: string }> = {}
  for (const [slotId, sel] of Object.entries(selections.value)) {
    if (sel) result[slotId] = { label: sel.label, importName: sel.importName }
  }
  if (!Object.keys(result).length) return ''
  return JSON.stringify(result, null, 2)
})

const clearAll = () => { selections.value = {} }

const copyJson = async () => {
  if (!jsonOutput.value) return
  await navigator.clipboard.writeText(jsonOutput.value).catch(() => {})
  jsonCopied.value = true
  setTimeout(() => { jsonCopied.value = false }, 1800)
}

// ─── Icon Slot Definitions ────────────────────────────────────────
const slots: Slot[] = [
  {
    id: 'close-modal',
    name: 'Close modal',
    description: '✕ X on modal/panel headers (Overview, Export, ChapterMeta, WritingProfile, etc.)',
    current: '✕',
    mdiCandidates: [
      { label: 'Close',             importName: 'mdiClose',             path: mdiClose },
      { label: 'CloseCircleOutline',importName: 'mdiCloseCircleOutline',path: mdiCloseCircleOutline },
    ],
  },
  {
    id: 'delete-item',
    name: 'Delete item',
    description: '× button on chapter rows and story list items to delete them',
    current: '×',
    mdiCandidates: [
      { label: 'Delete',          importName: 'mdiDelete',          path: mdiDelete },
      { label: 'DeleteOutline',   importName: 'mdiDeleteOutline',   path: mdiDeleteOutline },
      { label: 'TrashCanOutline', importName: 'mdiTrashCanOutline', path: mdiTrashCanOutline },
      { label: 'Close',           importName: 'mdiClose',           path: mdiClose },
    ],
  },

  // ── Sidebar controls ───────────────────────────────────────────────
  {
    id: 'sidebar-toggle',
    name: 'Sidebar toggle',
    description: 'The ◀/▶ button that collapses / expands the chapter sidebar',
    current: '◀/▶',
    mdiCandidates: [
      { label: 'ChevronLeft',           importName: 'mdiChevronLeft',           path: mdiChevronLeft },
      { label: 'ChevronDoubleLeft',     importName: 'mdiChevronDoubleLeft',     path: mdiChevronDoubleLeft },
      { label: 'ArrowCollapseLeft',     importName: 'mdiArrowCollapseLeft',     path: mdiArrowCollapseLeft },
      { label: 'PageLayoutSidebarLeft', importName: 'mdiPageLayoutSidebarLeft', path: mdiPageLayoutSidebarLeft },
      { label: 'MenuOpen',              importName: 'mdiMenuOpen',              path: mdiMenuOpen },
    ],
  },

  // ── Editor mode buttons ─────────────────────────────────────────
  {
    id: 'seamless-mode',
    name: 'Seamless mode',
    description: 'The ≈ button for rendered-while-editing (WYSIWYG-like) mode — needs to feel distinct from preview (eye) and markdown (code)',
    current: '≈',
    mdiCandidates: [
      { label: 'ApproxEqualBox',  importName: 'mdiApproximatelyEqualBox', path: mdiApproximatelyEqualBox },
      { label: 'Waves',          importName: 'mdiWaves',                 path: mdiWaves },
      { label: 'PencilRuler',    importName: 'mdiPencilRuler',           path: mdiPencilRuler },
      { label: 'FileEditOutline',importName: 'mdiFileEditOutline',       path: mdiFileEditOutline },
      { label: 'TextBoxEdit',    importName: 'mdiTextBoxEditOutline',    path: mdiTextBoxEditOutline },
    ],
  },

  // ── Sidebar footer ──────────────────────────────────────────────
  {
    id: 'theme-dark',
    name: 'Dark mode icon',
    description: 'The ◐ icon shown when in dark mode (clicking switches to light)',
    current: '◐',
    mdiCandidates: [
      { label: 'CircleHalfFull', importName: 'mdiCircleHalfFull', path: mdiCircleHalfFull },
      { label: 'WeatherNight',   importName: 'mdiWeatherNight',   path: mdiWeatherNight },
      { label: 'ThemeLightDark', importName: 'mdiThemeLightDark', path: mdiThemeLightDark },
      { label: 'Brightness6',    importName: 'mdiBrightness6',    path: mdiBrightness6 },
      { label: 'InvertColors',   importName: 'mdiInvertColors',   path: mdiInvertColors },
    ],
  },
  {
    id: 'theme-light',
    name: 'Light mode icon',
    description: 'The ☀ icon shown when in light mode (clicking switches to dark)',
    current: '☀',
    mdiCandidates: [
      { label: 'WeatherSunny',      importName: 'mdiWeatherSunny',      path: mdiWeatherSunny },
      { label: 'WhiteBalanceSunny', importName: 'mdiWhiteBalanceSunny', path: mdiWhiteBalanceSunny },
      { label: 'LightbulbOutline',  importName: 'mdiLightbulbOutline',  path: mdiLightbulbOutline },
      { label: 'ThemeLightDark',    importName: 'mdiThemeLightDark',    path: mdiThemeLightDark },
      { label: 'Brightness6',       importName: 'mdiBrightness6',       path: mdiBrightness6 },
    ],
  },

  // ── Status bar badges ───────────────────────────────────────────
  {
    id: 'summary',
    name: 'AI summary badge',
    description: 'The ⊙ badge on chapter rows and ⊙ Summary button in the status bar',
    current: '⊙',
    mdiCandidates: [
      { label: 'TextBoxOutline',      importName: 'mdiTextBoxOutline',      path: mdiTextBoxOutline },
      { label: 'NotebookOutline',     importName: 'mdiNotebookOutline',     path: mdiNotebookOutline },
      { label: 'CommentTextOutline',  importName: 'mdiCommentTextOutline',  path: mdiCommentTextOutline },
      { label: 'FileDocumentOutline', importName: 'mdiFileDocumentOutline', path: mdiFileDocumentOutline },
    ],
  },
  {
    id: 'tags-badge',
    name: 'Context tags badge',
    description: 'The ⌗ N badge on chapter items showing the count of AI context tags',
    current: '⌗',
    mdiCandidates: [
      { label: 'Pound',              importName: 'mdiPound',              path: mdiPound },
      { label: 'Tag',                importName: 'mdiTag',                path: mdiTag },
      { label: 'TagOutline',         importName: 'mdiTagOutline',         path: mdiTagOutline },
      { label: 'TagMultipleOutline', importName: 'mdiTagMultipleOutline', path: mdiTagMultipleOutline },
      { label: 'LabelOutline',       importName: 'mdiLabelOutline',       path: mdiLabelOutline },
      { label: 'PoundBoxOutline',    importName: 'mdiPoundBoxOutline',    path: mdiPoundBoxOutline },
    ],
  },

  // ── Notification toast icons (4 types) ─────────────────────────
  {
    id: 'notif-success',
    name: 'Notification: success',
    description: 'Icon for ✓ success toasts',
    current: '✓',
    mdiCandidates: [
      { label: 'CheckCircle',        importName: 'mdiCheckCircle',        path: mdiCheckCircle },
      { label: 'CheckCircleOutline', importName: 'mdiCheckCircleOutline', path: mdiCheckCircleOutline },
    ],
  },
  {
    id: 'notif-error',
    name: 'Notification: error',
    description: 'Icon for ✕ error toasts (also used as the notification dismiss button)',
    current: '✕',
    mdiCandidates: [
      { label: 'CloseCircle',        importName: 'mdiCloseCircle',        path: mdiCloseCircle },
      { label: 'CloseCircleOutline', importName: 'mdiCloseCircleOutline', path: mdiCloseCircleOutline },
      { label: 'AlertCircle',        importName: 'mdiAlertCircle',        path: mdiAlertCircle },
      { label: 'AlertCircleOutline', importName: 'mdiAlertCircleOutline', path: mdiAlertCircleOutline },
    ],
  },
  {
    id: 'notif-warning',
    name: 'Notification: warning',
    description: 'Icon for ⚠ warning toasts',
    current: '⚠',
    mdiCandidates: [
      { label: 'AlertCircle',        importName: 'mdiAlertCircle',        path: mdiAlertCircle },
      { label: 'AlertCircleOutline', importName: 'mdiAlertCircleOutline', path: mdiAlertCircleOutline },
      { label: 'AlertOutline',       importName: 'mdiAlertOutline',       path: mdiAlertOutline },
    ],
  },
  {
    id: 'notif-info',
    name: 'Notification: info',
    description: 'Icon for ℹ info toasts',
    current: 'ℹ',
    mdiCandidates: [
      { label: 'Information',                   importName: 'mdiInformation',                   path: mdiInformation },
      { label: 'InformationOutline',             importName: 'mdiInformationOutline',             path: mdiInformationOutline },
      { label: 'InformationSlabCircleOutline',   importName: 'mdiInformationSlabCircleOutline',   path: mdiInformationSlabCircleOutline },
    ],
  },

  // ── Export panel ────────────────────────────────────────────────
  {
    id: 'export-md',
    name: 'Export: Markdown',
    description: 'The 📄 icon on the Markdown export buttons in the Export panel',
    current: '📄',
    mdiCandidates: [
      { label: 'LanguageMarkdown',        importName: 'mdiLanguageMarkdown',        path: mdiLanguageMarkdown },
      { label: 'LanguageMarkdownOutline', importName: 'mdiLanguageMarkdownOutline', path: mdiLanguageMarkdownOutline },
      { label: 'CodeBrackets',            importName: 'mdiCodeBrackets',            path: mdiCodeBrackets },
    ],
  },
  {
    id: 'export-html',
    name: 'Export: HTML',
    description: 'The 🌐 icon on the HTML export button in the Export panel',
    current: '🌐',
    mdiCandidates: [
      { label: 'LanguageHtml5', importName: 'mdiLanguageHtml5', path: mdiLanguageHtml5 },
      { label: 'FilePdfBox',    importName: 'mdiFilePdfBox',    path: mdiFilePdfBox },
    ],
  },
  {
    id: 'export-docx',
    name: 'Export: DOCX',
    description: 'The 📝 icon on the Word (.docx) export button in the Export panel',
    current: '📝',
    mdiCandidates: [
      { label: 'FileWordOutline', importName: 'mdiFileWordOutline', path: mdiFileWordOutline },
    ],
  },
  {
    id: 'export-backup',
    name: 'Export: full backup',
    description: 'The 💾 icon on the "Export backup" button (saves full .json)',
    current: '💾',
    mdiCandidates: [
      { label: 'ContentSaveAllOutline', importName: 'mdiContentSaveAllOutline', path: mdiContentSaveAllOutline },
      { label: 'DatabaseExportOutline', importName: 'mdiDatabaseExportOutline', path: mdiDatabaseExportOutline },
      { label: 'BackupRestore',         importName: 'mdiBackupRestore',         path: mdiBackupRestore },
    ],
  },
  {
    id: 'restore-backup',
    name: 'Restore: load backup',
    description: 'The 📂 icon on the "Restore backup" button (loads a .json backup file)',
    current: '📂',
    mdiCandidates: [
      { label: 'FolderArrowDownOutline', importName: 'mdiFolderArrowDownOutline', path: mdiFolderArrowDownOutline },
      { label: 'FolderOpenOutline',      importName: 'mdiFolderOpenOutline',      path: mdiFolderOpenOutline },
      { label: 'DatabaseImportOutline',  importName: 'mdiDatabaseImportOutline',  path: mdiDatabaseImportOutline },
      { label: 'BackupRestore',          importName: 'mdiBackupRestore',          path: mdiBackupRestore },
    ],
  },
]
</script>

<style scoped>
/* ── Backdrop & Modal ─────────────────────────────────────────── */
.ig-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  overflow: hidden;
}

.ig-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  width: min(96vw, 1100px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,.35);
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────── */
.ig-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 12px;
  flex-wrap: wrap;
}

.ig-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.ig-header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.ig-weight-row,
.ig-size-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ig-weight-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: 4px;
  white-space: nowrap;
}

.ig-weight-btn {
  padding: 2px 8px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all .15s;
}
.ig-weight-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.ig-weight-btn.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }

.ig-close-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: color .15s;
  line-height: 1;
}
.ig-close-btn:hover { color: var(--error-color); }

/* ── Legend ───────────────────────────────────────────────────── */
.ig-legend {
  padding: 6px 18px;
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.ig-link {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}
.ig-hint { font-style: italic; opacity: 0.7; }

/* ── Badges ───────────────────────────────────────────────────── */
.ig-badge {
  font-size: 9px;
  font-weight: 700;
  border-radius: 3px;
  padding: 1px 5px;
  text-transform: uppercase;
  letter-spacing: .04em;
  line-height: 1.6;
  display: inline-block;
}
.ig-badge--now  { background: color-mix(in srgb, var(--text-secondary) 20%, transparent); color: var(--text-secondary); }
.ig-badge--mdi  { background: color-mix(in srgb, var(--success-color) 25%, transparent); color: var(--success-color); }

/* ── Body (scrollable) ────────────────────────────────────────── */
.ig-body {
  overflow-y: auto;
  padding: 12px 18px 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── One slot ─────────────────────────────────────────────────── */
.ig-slot {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ig-slot-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.ig-slot-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.ig-slot-selection {
  font-size: 11px;
  font-weight: 600;
  color: var(--success-color);
  background: color-mix(in srgb, var(--success-color) 12%, transparent);
  border-radius: 3px;
  padding: 1px 6px;
  white-space: nowrap;
}

.ig-slot-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ── Card row ─────────────────────────────────────────────────── */
.ig-card-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ── Individual icon card ─────────────────────────────────────── */
.ig-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 10px 8px 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  min-width: 70px;
  position: relative;
  cursor: default;
  transition: background .15s, border-color .15s;
  user-select: none;
  background: var(--bg-primary);
}

.ig-card--mdi {
  cursor: pointer;
}
.ig-card--mdi:hover    { background: color-mix(in srgb, var(--success-color) 10%, transparent); border-color: var(--success-color); }
.ig-card--now          { opacity: .65; background: var(--bg-secondary); cursor: default; }
.ig-card--selected     { background: color-mix(in srgb, var(--success-color) 18%, transparent) !important; border-color: var(--success-color) !important; }
.ig-card--selected:hover { background: color-mix(in srgb, var(--success-color) 26%, transparent) !important; }

.ig-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.ig-card-name {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Badge sits at top-right of the card */
.ig-card > .ig-badge {
  position: absolute;
  top: 3px;
  right: 3px;
}

/* Selected checkmark */
.ig-selected-check {
  position: absolute;
  top: 3px;
  left: 3px;
  font-size: 10px;
  font-weight: 700;
  color: var(--success-color);
  line-height: 1;
  pointer-events: none;
}

/* ── JSON Export panel ───────────────────────────────────── */
.ig-json-panel {
  border-top: 1px solid var(--border-color);
  padding: 10px 18px 12px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-secondary);
}

.ig-json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ig-json-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ig-json-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
}

.ig-json-actions {
  display: flex;
  gap: 6px;
}

.ig-json-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background .15s;
}
.ig-json-btn:hover:not(:disabled) { background: var(--bg-tertiary); }
.ig-json-btn:disabled { opacity: 0.4; cursor: default; }
.ig-json-btn--primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}
.ig-json-btn--primary:hover:not(:disabled) { opacity: 0.88; background: var(--accent-color); }

.ig-json-output {
  width: 100%;
  min-height: 80px;
  max-height: 160px;
  resize: vertical;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.5;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  box-sizing: border-box;
}

/* ── Footer ───────────────────────────────────────────────────── */
.ig-footer {
  padding: 10px 18px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.ig-close-footer-btn {
  padding: 6px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  transition: background .15s;
}
.ig-close-footer-btn:hover { background: var(--bg-secondary); }
</style>
