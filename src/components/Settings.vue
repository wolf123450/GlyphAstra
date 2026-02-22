<template>
  <Teleport to="body">
    <div v-if="uiStore.showSettings" class="settings-overlay" @click.self="close" @keydown.esc="close">
      <div class="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">

        <!-- Header -->
        <div class="settings-header">
          <h2>Settings</h2>
          <button class="close-btn" @click="close" title="Close (Esc)">&#x2715;</button>
        </div>

        <!-- Tabs -->
        <div class="settings-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <!-- Content -->
        <div class="settings-body">

          <!-- ── Editor ─────────────────────────────────────────── -->
          <div v-if="activeTab === 'editor'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">
                Font size
                <span class="setting-value">{{ settings.fontSize }}px</span>
              </label>
              <div class="setting-control range-row">
                <span class="range-min">10</span>
                <input
                  type="range" min="10" max="24" step="1"
                  :value="settings.fontSize"
                  @input="update('fontSize', Number(($event.target as HTMLInputElement).value))"
                />
                <span class="range-max">24</span>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">Font family</label>
              <div class="setting-control">
                <select
                  :value="settings.fontFamily"
                  @change="update('fontFamily', ($event.target as HTMLSelectElement).value)"
                  class="setting-select"
                >
                  <option v-for="f in fontFamilies" :key="f.value" :value="f.value">{{ f.label }}</option>
                </select>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">
                Line height
                <span class="setting-value">{{ settings.lineHeight }}</span>
              </label>
              <div class="setting-control range-row">
                <span class="range-min">1.2</span>
                <input
                  type="range" min="1.2" max="2.4" step="0.1"
                  :value="settings.lineHeight"
                  @input="update('lineHeight', Number(($event.target as HTMLInputElement).value))"
                />
                <span class="range-max">2.4</span>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">Tab width</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    v-for="w in [2, 4]"
                    :key="w"
                    class="pill"
                    :class="{ active: settings.tabWidth === w }"
                    @click="update('tabWidth', w)"
                  >{{ w }} spaces</button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">Spell check</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button class="pill" :class="{ active: settings.spellCheck }" @click="update('spellCheck', true)">On</button>
                  <button class="pill" :class="{ active: !settings.spellCheck }" @click="update('spellCheck', false)">Off</button>
                </div>
              </div>
              <p class="setting-hint inline-hint">When on, right-click any underlined word to add it to your system dictionary.</p>
            </div>

            <div class="setting-preview">
              <span class="preview-label">Preview</span>
              <div
                class="editor-preview-sample"
                :style="{ fontFamily: settings.fontFamily, fontSize: settings.fontSize + 'px', lineHeight: settings.lineHeight }"
              >The quick brown fox jumps over the lazy dog.</div>
            </div>
          </div>

          <!-- ── Auto-save ──────────────────────────────────────── -->
          <div v-if="activeTab === 'autosave'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">Auto-save interval</label>
              <div class="setting-control">
                <select
                  :value="settings.autoSaveInterval"
                  @change="update('autoSaveInterval', Number(($event.target as HTMLSelectElement).value))"
                  class="setting-select"
                >
                  <option :value="0">Off</option>
                  <option :value="5000">5 seconds</option>
                  <option :value="10000">10 seconds</option>
                  <option :value="30000">30 seconds</option>
                  <option :value="60000">1 minute</option>
                  <option :value="300000">5 minutes</option>
                </select>
              </div>
            </div>
            <p class="setting-hint">
              Unsaved changes are shown as "● Unsaved changes" in the status bar.
              Use <kbd>Ctrl+S</kbd> to save manually at any time.
            </p>
          </div>

          <!-- ── AI ─────────────────────────────────────────────── -->
          <div v-if="activeTab === 'ai'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">Default writing style</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    v-for="s in styles"
                    :key="s"
                    class="pill"
                    :class="{ active: settings.defaultCompletionStyle === s }"
                    @click="update('defaultCompletionStyle', s)"
                  >{{ s }}</button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">Default suggestion length</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    v-for="opt in lengthOptions"
                    :key="opt.label"
                    class="pill"
                    :class="{ active: settings.defaultCompletionLength === opt.label.toLowerCase() }"
                    @click="update('defaultCompletionLength', opt.label.toLowerCase())"
                  >{{ opt.label }}</button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <label class="setting-label">
                Response temperature
                <span class="setting-value">{{ settings.responseTemperature.toFixed(1) }}</span>
              </label>
              <div class="setting-control range-row">
                <span class="range-min">0.0</span>
                <input
                  type="range" min="0" max="1.5" step="0.1"
                  :value="settings.responseTemperature"
                  @input="update('responseTemperature', Number(($event.target as HTMLInputElement).value))"
                />
                <span class="range-max">1.5</span>
              </div>
              <p class="setting-hint inline-hint">Lower = more focused, Higher = more creative</p>
            </div>

            <div class="setting-row">
              <label class="setting-label">
                Context window size
                <span class="setting-value">{{ settings.contextWindowSize.toLocaleString() }} tokens</span>
              </label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    v-for="n in [2048, 4096, 8192]"
                    :key="n"
                    class="pill"
                    :class="{ active: settings.contextWindowSize === n }"
                    @click="update('contextWindowSize', n)"
                  >{{ (n / 1024).toFixed(0) }}K</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Appearance ─────────────────────────────────────── -->
          <div v-if="activeTab === 'appearance'" class="tab-content">
            <div class="setting-row">
              <label class="setting-label">Theme</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    class="pill"
                    :class="{ active: settings.theme === 'dark' }"
                    @click="setTheme('dark')"
                  >&#x25D0; Dark</button>
                  <button
                    class="pill"
                    :class="{ active: settings.theme === 'light' }"
                    @click="setTheme('light')"
                  >&#x2600; Light</button>
                </div>
              </div>
            </div>
            <!-- Color overrides -->
            <div class="color-section">
              <div class="color-section-header">
                <span class="color-section-title">Custom colors <span class="color-theme-badge">{{ settings.theme }}</span></span>
                <button
                  v-if="hasColorOverrides()"
                  class="reset-colors-btn"
                  @click="resetColors"
                  title="Reset to theme defaults"
                >Reset</button>
              </div>
              <div class="color-grid">
                <div v-for="c in colorMeta" :key="c.varName" class="color-row">
                  <label class="color-label">{{ c.label }}</label>
                  <div class="color-swatch-wrap">
                    <input
                      type="color"
                      class="color-swatch"
                      :value="getColorValue(c.varName)"
                      @input="setColorValue(c.varName, ($event.target as HTMLInputElement).value)"
                      :title="c.varName"
                    />
                    <span
                      v-if="settings.themeColors?.[settings.theme]?.[c.varName]"
                      class="color-override-dot"
                      title="Customised"
                    ></span>
                  </div>
                </div>
              </div>
              <p class="setting-hint">Overrides apply to the currently selected theme only.</p>
            </div>          </div>

          <!-- ── Keyboard Shortcuts ─────────────────────────────── -->
          <div v-if="activeTab === 'shortcuts'" class="tab-content">
            <div class="shortcuts-table">
              <div class="shortcut-row header-row">
                <span>Action</span><span>Shortcut</span>
              </div>
              <div class="shortcut-row" v-for="(shortcut, action) in settings.keyboardShortcuts" :key="action">
                <span class="action-label">{{ shortcutLabel(action) }}</span>
                <kbd>{{ shortcut }}</kbd>
              </div>
            </div>
            <p class="setting-hint">Keyboard shortcut customisation coming soon.</p>
          </div>

        </div>

        <!-- Footer -->
        <div class="settings-footer">
          <button class="footer-btn danger" @click="resetDefaults">Reset to defaults</button>
          <button class="footer-btn primary" @click="close">Done</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore, CUSTOMIZABLE_VARS, type CustomizableVar } from '@/stores/settingsStore'

const uiStore = useUIStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.settings

const activeTab = ref<'editor' | 'autosave' | 'ai' | 'appearance' | 'shortcuts'>('editor')

const tabs = [
  { key: 'editor',      label: 'Editor' },
  { key: 'autosave',    label: 'Auto-save' },
  { key: 'ai',          label: 'AI' },
  { key: 'appearance',  label: 'Appearance' },
  { key: 'shortcuts',   label: 'Shortcuts' },
] as const

const fontFamilies = [
  { label: 'Fira Code (default)', value: 'Fira Code, monospace' },
  { label: 'Courier New',         value: "'Courier New', monospace" },
  { label: 'JetBrains Mono',      value: "'JetBrains Mono', monospace" },
  { label: 'Consolas',            value: 'Consolas, monospace' },
  { label: 'Georgia (serif)',     value: 'Georgia, serif' },
  { label: 'System sans-serif',   value: 'system-ui, sans-serif' },
]

const styles = ['mystical', 'sci-fi', 'romance', 'fantasy', 'noir']

const lengthOptions = [
  { label: 'Phrase',    tokens: 30 },
  { label: 'Sentence',  tokens: 80 },
  { label: 'Paragraph', tokens: 200 },
]

function update<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
  settingsStore.updateSetting(key, value)
}

function setTheme(theme: 'dark' | 'light') {
  settingsStore.updateSetting('theme', theme)
  uiStore.setTheme(theme)
}

// ── Color overrides ─────────────────────────────────────────────────────────
const colorMeta: { varName: CustomizableVar; label: string }[] = [
  { varName: '--accent-color', label: 'Accent' },
  { varName: '--bg-primary',   label: 'Background' },
  { varName: '--bg-secondary', label: 'Panel BG' },
  { varName: '--text-primary', label: 'Text' },
  { varName: '--border-color', label: 'Border' },
]

function getColorValue(varName: CustomizableVar): string {
  const override = settings.themeColors?.[settings.theme]?.[varName]
  if (override) return override
  // Fall back to the computed value from the stylesheet
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
}

function setColorValue(varName: CustomizableVar, value: string) {
  settingsStore.updateThemeColor(settings.theme, varName, value)
}

function hasColorOverrides(): boolean {
  const overrides = settings.themeColors?.[settings.theme] ?? {}
  return CUSTOMIZABLE_VARS.some((v) => !!overrides[v])
}

function resetColors() {
  settingsStore.resetThemeColors(settings.theme)
}

function resetDefaults() {
  settingsStore.resetToDefaults()
  uiStore.setTheme(settingsStore.settings.theme)
}

function close() {
  uiStore.showSettings = false
}

function shortcutLabel(action: string): string {
  const map: Record<string, string> = {
    'new-chapter':   'New chapter',
    'save':          'Save',
    'search':        'Search',
    'settings':      'Open settings',
    'toggle-mode':   'Toggle panel mode',
  }
  return map[action] ?? action
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && uiStore.showSettings) {
    close()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* ── Overlay ───────────────────────────────────────── */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Modal card ────────────────────────────────────── */
.settings-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 560px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Header ────────────────────────────────────────── */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.settings-header h2 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
}
.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  line-height: 1;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.close-btn:hover { color: var(--text-primary); background: var(--bg-tertiary); }

/* ── Tabs ──────────────────────────────────────────── */
.settings-tabs {
  display: flex;
  gap: 2px;
  padding: var(--spacing-sm) var(--spacing-xl) 0;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow-x: auto;
}
.tab-btn {
  background: none;
  border: none;
  padding: 6px var(--spacing-md);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.tab-btn:hover { color: var(--text-primary); }
.tab-btn.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }

/* ── Body ──────────────────────────────────────────── */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xl);
}
.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* ── Setting rows ──────────────────────────────────── */
.setting-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.setting-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.setting-value {
  color: var(--accent-color);
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.setting-control { display: flex; align-items: center; }
.range-row { gap: var(--spacing-sm); align-items: center; }
.range-min, .range-max {
  font-size: 11px;
  color: var(--text-tertiary);
  min-width: 30px;
}
.range-max { text-align: right; }
input[type="range"] {
  flex: 1;
  accent-color: var(--accent-color);
  cursor: pointer;
}

/* ── Select ────────────────────────────────────────── */
.setting-select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  max-width: 260px;
}

/* ── Pills ─────────────────────────────────────────── */
.pill-group { display: flex; flex-wrap: wrap; gap: var(--spacing-xs); }
.pill {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.pill:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.pill.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}

/* ── Hint text ─────────────────────────────────────── */
.setting-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
  margin-top: 2px;
}
.inline-hint { margin-top: 4px; }
.setting-hint kbd {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 10px;
}

/* ── Font preview ──────────────────────────────────── */
.setting-preview {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}
.preview-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  display: block;
  margin-bottom: var(--spacing-sm);
}
.editor-preview-sample {
  color: var(--text-primary);
  word-break: break-word;
}

/* ── Shortcuts table ───────────────────────────────── */
.shortcuts-table { display: flex; flex-direction: column; gap: 2px; }
.shortcut-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--spacing-lg);
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.shortcut-row.header-row {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.shortcut-row:not(.header-row) { background: var(--bg-tertiary); }
.action-label { color: var(--text-primary); }
.shortcut-row kbd {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── Footer ────────────────────────────────────────── */
.settings-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-xl);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}
.footer-btn {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.footer-btn.danger {
  background: transparent;
  color: var(--error-color);
  border-color: var(--error-color);
}
.footer-btn.danger:hover { background: var(--error-color); color: #fff; }
.footer-btn.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}
.footer-btn.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }

/* ── Color overrides section ───────────────────────── */
.color-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
}
.color-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.color-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.color-theme-badge {
  font-size: 10px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  background: color-mix(in srgb, var(--accent-color) 15%, transparent);
  color: var(--accent-color);
  border-radius: 3px;
  padding: 1px 5px;
}
.reset-colors-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-muted, var(--text-secondary));
  font-size: 11px;
  cursor: pointer;
  padding: 2px 8px;
  transition: color 0.15s, border-color 0.15s;
}
.reset-colors-btn:hover { color: var(--error-color); border-color: var(--error-color); }
.color-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}
.color-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.color-label {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
}
.color-swatch-wrap {
  position: relative;
  display: inline-flex;
}
.color-swatch {
  width: 36px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  cursor: pointer;
  padding: 2px;
  background: none;
}
.color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
.color-swatch::-webkit-color-swatch { border-radius: 3px; border: none; }
.color-override-dot {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 7px;
  height: 7px;
  background: var(--accent-color);
  border-radius: 50%;
  pointer-events: none;
}
</style>
