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

            <div class="setting-row">
              <label class="setting-label">Include future chapters in context</label>
              <div class="setting-control">
                <div class="pill-group">
                  <button
                    class="pill"
                    :class="{ active: settings.includeFutureChapters === true }"
                    @click="update('includeFutureChapters', true)"
                  >On</button>
                  <button
                    class="pill"
                    :class="{ active: settings.includeFutureChapters === false }"
                    @click="update('includeFutureChapters', false)"
                  >Off</button>
                </div>
              </div>
              <p class="setting-hint inline-hint">When on, AI sees summaries of chapters written after the current one</p>
            </div>

            <!-- ── Cloud AI Providers ───────────────────────────────────── -->
            <div class="setting-group-separator"></div>
            <div class="setting-group-label">Cloud AI Providers</div>
            <div class="setting-row">
              <p class="setting-hint api-key-notice">
                &#128274; API keys are stored locally on this device only and are never sent to any BlockBreaker server.
              </p>
            </div>

            <div
              v-for="pid in CLOUD_PROVIDER_IDS"
              :key="pid"
              class="setting-row"
            >
              <label class="setting-label">{{ PROVIDER_META[pid].name }}</label>
              <div class="setting-control provider-key-control">
                <input
                  type="password"
                  class="setting-input"
                  :placeholder="PROVIDER_META[pid].hint"
                  :value="aiStore.providerApiKeys[pid] ?? ''"
                  @change="(e) => onSettingsApiKeyChange(pid, (e.target as HTMLInputElement).value)"
                  autocomplete="off"
                />
                <div class="provider-row-actions">
                  <button
                    class="pill pill-sm"
                    :disabled="providerTesting[pid] || !(aiStore.providerApiKeys[pid] ?? '').trim()"
                    @click="testProvider(pid)"
                  >{{ providerTesting[pid] ? '…' : 'Test' }}</button>
                  <span
                    v-if="providerTestResults[pid] !== undefined"
                    class="dot"
                    :class="providerTestResults[pid] ? 'dot-on' : 'dot-off'"
                    :title="providerTestResults[pid] ? 'Connected' : 'Connection failed'"
                  ></span>
                  <a
                    :href="PROVIDER_META[pid].docsUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="docs-link-sm"
                  >Get key →</a>
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
              <div v-for="grp in colorGroups" :key="grp.group" class="color-group">
                <div class="color-group-label">{{ grp.group }}</div>
                <div class="color-grid">
                  <div v-for="c in grp.items" :key="c.varName" class="color-row">
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

          <!-- ── Help ────────────────────────────────────────── -->
          <div v-if="activeTab === 'help'" class="tab-content help-tab">

            <div v-if="IconGallery" class="help-section">
              <h3 class="help-section-title">Icons</h3>
              <p class="setting-hint">Compare Phosphor and Material Design icon candidates for the UI overhaul (Phase 11.x).</p>
              <button class="btn-sm help-btn" @click="showIconGallery = true">&#9783; Browse icon gallery</button>
            </div>

            <div class="help-section">
              <h3 class="help-section-title">Onboarding</h3>
              <p class="setting-hint">Take the guided tour to learn the key areas of the app.</p>
              <button class="btn-sm help-btn" @click="startTour">&#9654; Take the tour</button>
            </div>

            <div class="help-section">
              <h3 class="help-section-title">Help Story</h3>
              <p class="setting-hint">The built-in help story contains reference material and sandbox chapters.</p>
              <div class="help-btn-row">
                <button class="btn-sm help-btn" @click="openHelpStory">Open help story</button>
                <button class="btn-sm help-btn" @click="resetHelpContent">Reset help content</button>
              </div>
            </div>

            <div class="help-section">
              <h3 class="help-section-title">About</h3>
              <p class="setting-hint">BlockBreaker v{{ appVersion }}</p>
            </div>

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

  <component :is="IconGallery" v-if="IconGallery && showIconGallery" :show="showIconGallery" @close="showIconGallery = false" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore, CUSTOMIZABLE_VARS, type CustomizableVar } from '@/stores/settingsStore'
import { useStoryStore } from '@/stores/storyStore'
import { useAIStore } from '@/stores/aiStore'
import { loadOrCreateHelpStory, resetHelpStory } from '@/utils/story/helpStoryService'
import { makeProvider, PROVIDER_META, ALL_PROVIDER_IDS } from '@/api/providers'
import type { ProviderId } from '@/api/providers'
import { version as appVersion } from '../../package.json'
// Dev-only: lazy-load IconGallery so it is tree-shaken in production builds
const IconGallery = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./export/IconGallery.vue'))
  : null

const uiStore = useUIStore()
const settingsStore = useSettingsStore()
const settings = settingsStore.settings
const storyStore = useStoryStore()
const aiStore = useAIStore()

// Cloud providers (everything except ollama)
const CLOUD_PROVIDER_IDS = ALL_PROVIDER_IDS.filter(p => p !== 'ollama') as Exclude<ProviderId, 'ollama'>[]

const providerTesting     = ref<Record<string, boolean>>({})
const providerTestResults = ref<Record<string, boolean | undefined>>({})

function onSettingsApiKeyChange(pid: ProviderId, key: string) {
  aiStore.setApiKey(pid, key)
  delete providerTestResults.value[pid]
}

async function testProvider(pid: ProviderId) {
  providerTesting.value[pid] = true
  delete providerTestResults.value[pid]
  try {
    const provider = makeProvider(pid, aiStore.providerApiKeys)
    providerTestResults.value[pid] = await provider.isAvailable()
  } catch {
    providerTestResults.value[pid] = false
  } finally {
    providerTesting.value[pid] = false
  }
}

const activeTab = ref<'editor' | 'autosave' | 'ai' | 'appearance' | 'shortcuts' | 'help'>('editor')
const showIconGallery = ref(false)

const tabs = [
  { key: 'editor',      label: 'Editor' },
  { key: 'autosave',    label: 'Auto-save' },
  { key: 'ai',          label: 'AI' },
  { key: 'appearance',  label: 'Appearance' },
  { key: 'shortcuts',   label: 'Shortcuts' },
  { key: 'help',        label: 'Help' },
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
const colorGroups: { group: string; items: { varName: CustomizableVar; label: string }[] }[] = [
  {
    group: 'Surfaces',
    items: [
      { varName: '--bg-primary',   label: 'Editor BG' },
      { varName: '--bg-secondary', label: 'Panel BG' },
      { varName: '--bg-tertiary',  label: 'Hover BG' },
    ],
  },
  {
    group: 'Text',
    items: [
      { varName: '--text-primary',   label: 'Primary' },
      { varName: '--text-secondary', label: 'Muted' },
      { varName: '--text-tertiary',  label: 'Faint' },
    ],
  },
  {
    group: 'UI Chrome',
    items: [
      { varName: '--border-color',  label: 'Border' },
      { varName: '--accent-color',  label: 'Accent' },
      { varName: '--accent-hover',  label: 'Accent hover' },
    ],
  },
  {
    group: 'Semantic',
    items: [
      { varName: '--success-color', label: 'Success' },
      { varName: '--error-color',   label: 'Error' },
      { varName: '--warning-color', label: 'Warning' },
    ],
  },
  {
    group: 'Status badges',
    items: [
      { varName: '--status-draft-bg',    label: 'Draft BG' },
      { varName: '--status-draft-fg',    label: 'Draft text' },
      { varName: '--status-progress-bg', label: 'Progress BG' },
      { varName: '--status-progress-fg', label: 'Progress text' },
      { varName: '--status-complete-bg', label: 'Done BG' },
      { varName: '--status-complete-fg', label: 'Done text' },
    ],
  },
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

// ─── Help tab handlers ─────────────────────────────────────────────────────

async function openHelpStory() {
  close()
  await loadOrCreateHelpStory()
  const chapters = storyStore.chapters
  if (chapters.length > 0) {
    storyStore.setCurrentChapter(chapters[0].id)
  }
}

async function resetHelpContent() {
  await resetHelpStory()
  uiStore.showNotification('Help story reference chapters have been reset.', 'success')
}

function startTour() {
  close()
  // Tour is wired in App.vue via uiStore.startTour()
  uiStore.startTour()
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
  color: var(--text-secondary);
  font-size: 14px;
  padding: 4px 6px;
}

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
  border-radius: 12px;
}
.pill:hover { color: var(--text-primary); border-color: var(--text-secondary); }

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

/* ── Help tab ───────────────────────────────────────── */
.help-tab { display: flex; flex-direction: column; gap: var(--spacing-xl); }
.help-section { display: flex; flex-direction: column; gap: 8px; }
.help-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}
.help-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.help-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.help-btn:hover { background: var(--bg-hover); border-color: var(--accent-color); }

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
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 8px;
}
.color-group {
  margin-bottom: 10px;
}
.color-group:last-child { margin-bottom: 0; }
.color-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: 6px;
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

/* ── Cloud AI Providers ────────────────────────────── */
.setting-group-separator {
  height: 1px;
  background: var(--border-color);
  margin: var(--spacing-sm) 0;
}
.setting-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}
.api-key-notice {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
.provider-key-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.setting-input {
  width: 100%;
  box-sizing: border-box;
  padding: 5px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  font-family: monospace;
}
.setting-input::placeholder { color: var(--text-tertiary); font-family: sans-serif; }
.provider-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.pill-sm {
  padding: 2px 8px;
  font-size: 11px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}
.dot-on  { background: var(--success-color, #4caf50); }
.dot-off { background: var(--error-color, #f44336); }
.docs-link-sm {
  font-size: 11px;
  color: var(--accent-color);
  text-decoration: none;
  margin-left: auto;
}
.docs-link-sm:hover { text-decoration: underline; }
</style>
