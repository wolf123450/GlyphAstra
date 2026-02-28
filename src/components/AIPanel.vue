<template>
  <aside class="ai-panel" v-if="isVisible">
    <div class="ai-header">
      <h3>AI Settings</h3>
      <button class="close-btn" @click="closePanel" title="Close">&#x2715;</button>
    </div>

    <div class="ai-content">

      <!-- Provider selection -->
      <section class="ai-section">
        <div class="sec-label">AI Provider</div>
        <div class="provider-pills">
          <button
            v-for="pid in ALL_PROVIDER_IDS"
            :key="pid"
            class="pill"
            :class="{ active: aiStore.activeProviderId === pid }"
            @click="selectProvider(pid)"
          >{{ PROVIDER_META[pid].name }}</button>
        </div>

        <!-- Ollama subsection -->
        <template v-if="aiStore.activeProviderId === 'ollama'">
          <div class="connection-row">
            <span class="dot" :class="isConnected ? 'dot-on' : 'dot-off'"></span>
            <span class="conn-label">{{ isConnected ? 'Connected' : 'Offline' }}</span>
            <button class="btn-sm" @click="checkConn" :disabled="checking">
              {{ checking ? '…' : '⟳' }}
            </button>
          </div>
          <div v-if="!isConnected" class="hint">Run <code>ollama serve</code> to start</div>
          <div v-if="isConnected" class="field-row">
            <span class="field-label">Model</span>
            <select v-model="selectedModel" class="field-select" @change="aiStore.setProviderModel('ollama', selectedModel)">
              <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div v-if="isConnected && modelList.length" class="field-row">
            <span class="field-label">Summary</span>
            <select v-model="selectedSummaryModel" class="field-select" @change="aiStore.setSummaryModel('ollama', selectedSummaryModel)">
              <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </template>

        <!-- Cloud provider subsection -->
        <template v-else>
          <!-- Status row: connection dot + key config toggle -->
          <div class="connection-row">
            <span class="dot" :class="hasKey ? (testResult === false ? 'dot-off' : 'dot-dim') : 'dot-off'"></span>
            <span class="conn-label">
              {{ hasKey ? (testResult === true ? 'Connected' : testResult === false ? 'Error' : 'Key set') : 'No API key' }}
            </span>
            <button
              class="btn-icon key-toggle-btn"
              :class="{ active: keyExpanded }"
              @click="keyExpanded = !keyExpanded"
              :title="keyExpanded ? 'Hide API key settings' : 'Configure API key'"
            >
              <svg class="mdi-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="mdiTune" />
              </svg>
            </button>
          </div>

          <!-- Collapsible API key drawer -->
          <Transition name="key-expand">
            <div v-if="keyExpanded" class="key-drawer">
              <div class="field-row">
                <span class="field-label">API Key</span>
                <input
                  type="password"
                  class="field-input"
                  :placeholder="PROVIDER_META[aiStore.activeProviderId as ProviderId].hint"
                  :value="aiStore.providerApiKeys[aiStore.activeProviderId] ?? ''"
                  @change="(e) => onApiKeyChange((e.target as HTMLInputElement).value)"
                  autocomplete="off"
                />
              </div>
              <div class="key-actions">
                <button class="btn-sm" @click="testCloudConn" :disabled="testing || !hasKey">
                  {{ testing ? '…' : 'Test' }}
                </button>
                <span
                  v-if="testResult !== null"
                  class="dot"
                  :class="testResult ? 'dot-on' : 'dot-off'"
                  :title="testResult ? 'Connected' : 'Connection failed'"
                ></span>
                <a
                  :href="PROVIDER_META[aiStore.activeProviderId as ProviderId].docsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="docs-link"
                >Get API key →</a>
              </div>
            </div>
          </Transition>

          <!-- Model selector -->
          <div v-if="modelsLoading" class="hint">Loading models…</div>
          <template v-else-if="cloudModelList.length > 0">
            <div class="field-row">
              <span class="field-label">Model</span>
              <select
                v-model="selectedModel"
                class="field-select"
                @change="aiStore.setProviderModel(aiStore.activeProviderId as ProviderId, selectedModel)"
              >
                <option v-for="m in cloudModelList" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <div v-if="selectedModelInfo?.pricing" class="pricing-badge"
                 data-tooltip="Pricing sourced from public documentation — not guaranteed to be current.">
              <span class="pricing-in">{{ formatPrice(selectedModelInfo.pricing.inputPer1M) }} in</span>
              <span class="pricing-sep">/</span>
              <span class="pricing-out">{{ formatPrice(selectedModelInfo.pricing.outputPer1M) }} out</span>
              <span class="pricing-unit">per 1M tokens ⓘ</span>
            </div>
            <!-- Summary model -->
            <div class="field-row">
              <span class="field-label">Summary</span>
              <select v-model="selectedSummaryModel" class="field-select"
                      @change="aiStore.setSummaryModel(aiStore.activeProviderId as ProviderId, selectedSummaryModel)">
                <option v-for="m in cloudModelList" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </div>
            <div v-if="selectedSummaryModelInfo?.pricing" class="pricing-badge"
                 data-tooltip="Pricing sourced from public documentation — not guaranteed to be current.">
              <span class="pricing-in">{{ formatPrice(selectedSummaryModelInfo.pricing.inputPer1M) }} in</span>
              <span class="pricing-sep">/</span>
              <span class="pricing-out">{{ formatPrice(selectedSummaryModelInfo.pricing.outputPer1M) }} out</span>
              <span class="pricing-unit">per 1M tokens ⓘ</span>
            </div>
          </template>
          <div v-else-if="!hasKey" class="hint muted">Enter an API key above to load models.</div>
        </template>
      </section>

      <!-- Writing Profiles -->
      <section class="ai-section">
        <div class="sec-label-row">
          <span class="sec-label">Writing profile</span>
          <div class="sec-label-actions">
            <button class="btn-icon" @click="showPromptPreview = true" title="View current AI prompt">⊙</button>
            <button class="btn-icon" @click="openNewProfile" title="New custom profile">＋</button>
          </div>
        </div>

        <div class="profile-pills">
          <div
            v-for="p in styles"
            :key="p.name"
            class="profile-pill-row"
            :class="{ active: selectedStyle === p.name }"
          >
            <button
              class="pill"
              :class="{ active: selectedStyle === p.name, custom: p.isCustom }"
              @click="selectProfile(p.name)"
              :title="p.description"
            >{{ p.name }}</button>
            <button
              class="pill-action-btn"
              @click="openEditProfile(p.name)"
              :title="p.isCustom ? 'Edit profile' : 'View profile instructions'"
            >{{ p.isCustom ? '✎' : '⊙' }}</button>
          </div>
        </div>

        <div v-if="activeProfile" class="profile-description">
          {{ activeProfile.description }}
        </div>
      </section>

      <!-- Suggestion length -->
      <section class="ai-section">
        <div class="sec-label">Suggestion length</div>
        <div class="length-options">
          <button
            v-for="opt in lengthOptions"
            :key="opt.label"
            class="pill"
            :class="{ active: aiStore.suggestionTokens === opt.tokens }"
            @click="aiStore.setSuggestionTokens(opt.tokens)"
            :title="`~${opt.label}`"
          >{{ opt.label }}</button>
        </div>
      </section>

      <!-- Active context tags (only shown when tags exist in the story) -->
      <section class="ai-section" v-if="allContextTags.length > 0">
        <div class="sec-label">Active context</div>
        <div class="context-tag-pills">
          <button
            class="pill"
            :class="{ active: activeContextTags.length === 0 }"
            @click="setContextTags([])"
            title="Include all chapters in AI context"
          >All</button>
          <button
            v-for="tag in allContextTags"
            :key="tag"
            class="pill"
            :class="{ active: activeContextTags.includes(tag) }"
            @click="toggleContextTag(tag)"
            :title="`Toggle context tag: ${tag}`"
          >{{ tag }}</button>
        </div>
        <div class="hint muted">
          {{ activeContextTags.length === 0 ? 'All chapters included' : `${activeContextTags.length} tag(s) active` }}
        </div>
      </section>

      <!-- Keyboard hint -->
      <section class="ai-section hint-section">
        <div class="sec-label">Inline suggestions</div>
        <div class="kbd-row"><kbd>Ctrl+Space</kbd> Generate</div>
        <div class="kbd-row"><kbd>Tab</kbd> Accept suggestion</div>
        <div class="kbd-row"><kbd>↑</kbd><kbd>↓</kbd> Switch suggestion</div>
        <div class="kbd-row"><kbd>Esc</kbd> Dismiss</div>
        <div class="kbd-row muted">Typing matching chars advances through the suggestion letter by letter</div>
      </section>

    </div>

    <!-- Modals -->
    <WritingProfileEditor
      :show="showProfileEditor"
      :profile-name="editingProfileName"
      @close="showProfileEditor = false"
      @saved="onProfileSaved"
    />
    <PromptPreview
      :show="showPromptPreview"
      @close="showPromptPreview = false"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useAIStore } from '@/stores/aiStore'
import { useStoryStore } from '@/stores/storyStore'
import { ollamaClient } from '@/api/ollama'
import { makeProvider, PROVIDER_META, ALL_PROVIDER_IDS } from '@/api/providers'
import type { ProviderId, ModelInfo } from '@/api/providers'
import { mdiTune } from '@mdi/js'
import WritingProfileEditor from './WritingProfileEditor.vue'
import PromptPreview from './PromptPreview.vue'

const uiStore    = useUIStore()
const aiStore    = useAIStore()
const storyStore = useStoryStore()

const isVisible   = computed(() => uiStore.activePanel === 'ai')
const styles      = computed(() => aiStore.styles)
const isConnected = computed(() => aiStore.isConnected)

const allContextTags  = computed(() => storyStore.allContextTags)
const activeContextTags = computed(() => storyStore.activeContextTags)

const setContextTags = (tags: string[]) => {
  storyStore.activeContextTags = tags
}

const toggleContextTag = (tag: string) => {
  const current = storyStore.activeContextTags
  const idx = current.indexOf(tag)
  if (idx === -1) {
    storyStore.activeContextTags = [...current, tag]
  } else {
    storyStore.activeContextTags = current.filter(t => t !== tag)
  }
}

const checking        = ref(false)
const modelList       = ref<string[]>([])
const cloudModelList  = ref<ModelInfo[]>([])
const modelsLoading   = ref(false)
// Initialise from per-provider saved selection, falling back to the global currentModel
const selectedModel   = ref(
  aiStore.providerCurrentModel[aiStore.activeProviderId] ?? aiStore.currentModel
)
const selectedSummaryModel = ref(
  aiStore.summaryProviderModel[aiStore.activeProviderId] ??
  aiStore.providerCurrentModel[aiStore.activeProviderId] ??
  aiStore.currentModel
)
const selectedStyle   = ref(aiStore.currentStyle)

// Cloud provider state
const testing      = ref(false)
const testResult   = ref<boolean | null>(null)
const keyExpanded  = ref(false)   // API key drawer: collapsed by default

const hasKey = computed(() => {
  const id = aiStore.activeProviderId
  return id !== 'ollama' && (aiStore.providerApiKeys[id] ?? '').trim().length > 0
})

const selectedModelInfo = computed(() =>
  cloudModelList.value.find(m => m.id === selectedModel.value)
)
const selectedSummaryModelInfo = computed(() =>
  cloudModelList.value.find(m => m.id === selectedSummaryModel.value)
)

function formatPrice(usd: number): string {
  return usd < 0.01 ? `$${(usd * 1000).toFixed(2)}m` : `$${usd.toFixed(usd < 1 ? 3 : 2)}`
}

const showProfileEditor  = ref(false)
const editingProfileName = ref<string | null>(null)
const showPromptPreview  = ref(false)

const activeProfile = computed(() => aiStore.getStyle(selectedStyle.value))

const lengthOptions = [
  { label: 'Phrase',     tokens: 30 },
  { label: 'Sentence',   tokens: 80 },
  { label: 'Paragraph',  tokens: 200 },
]

const checkConn = async () => {
  checking.value = true
  try {
    const ok = await ollamaClient.checkConnection()
    aiStore.setConnected(ok)
    if (ok) {
      modelList.value = await ollamaClient.listModels()
      if (modelList.value.length) {
        const remembered = aiStore.providerCurrentModel['ollama']
        if (remembered && modelList.value.includes(remembered)) {
          selectedModel.value = remembered
        } else if (!modelList.value.includes(selectedModel.value)) {
          selectedModel.value = modelList.value[0]
        }
        aiStore.setProviderModel('ollama', selectedModel.value)        // Summary model
        const remSum = aiStore.summaryProviderModel['ollama']
        if (remSum && modelList.value.includes(remSum)) {
          selectedSummaryModel.value = remSum
        } else if (!selectedSummaryModel.value || !modelList.value.includes(selectedSummaryModel.value)) {
          selectedSummaryModel.value = selectedModel.value
        }
        aiStore.setSummaryModel('ollama', selectedSummaryModel.value)      }
    }
  } finally {
    checking.value = false
  }
}

const loadCloudModels = async (pid: ProviderId) => {
  if (pid === 'ollama') return
  modelsLoading.value = true
  try {
    const provider = makeProvider(pid, aiStore.providerApiKeys)
    cloudModelList.value = await provider.listModels()
    if (cloudModelList.value.length) {
      const ids = cloudModelList.value.map(m => m.id)
      // Prefer the last model used with this specific provider
      const remembered = aiStore.providerCurrentModel[pid]
      if (remembered && ids.includes(remembered)) {
        selectedModel.value = remembered
      } else if (!ids.includes(selectedModel.value)) {
        // Current global model isn't valid for this provider — pick first
        selectedModel.value = cloudModelList.value[0].id
        aiStore.setProviderModel(pid, selectedModel.value)
      }
      // Sync global currentModel to whatever is selected for this provider
      aiStore.setProviderModel(pid, selectedModel.value)
      // Summary model
      const remSum = aiStore.summaryProviderModel[pid]
      if (remSum && ids.includes(remSum)) {
        selectedSummaryModel.value = remSum
      } else if (!selectedSummaryModel.value || !ids.includes(selectedSummaryModel.value)) {
        selectedSummaryModel.value = selectedModel.value
      }
      aiStore.setSummaryModel(pid, selectedSummaryModel.value)
    }
  } finally {
    modelsLoading.value = false
  }
}

const selectProvider = async (pid: ProviderId) => {
  testResult.value = null
  keyExpanded.value = false   // collapse key drawer when switching providers
  aiStore.setActiveProvider(pid)
  if (pid === 'ollama') {
    await checkConn()
  } else {
    await loadCloudModels(pid)
  }
}

const onApiKeyChange = async (key: string) => {
  const pid = aiStore.activeProviderId as ProviderId
  aiStore.setApiKey(pid, key)
  testResult.value = null
  // Refresh model list — providers that can fetch live models (OpenAI, Google) need the key
  if (key.trim()) {
    await loadCloudModels(pid)
  }
}

const testCloudConn = async () => {
  const pid = aiStore.activeProviderId as ProviderId
  testing.value = true
  testResult.value = null
  try {
    const provider = makeProvider(pid, aiStore.providerApiKeys)
    testResult.value = await provider.isAvailable()
  } catch {
    testResult.value = false
  } finally {
    testing.value = false
  }
}

// Reload cloud model list whenever activeProviderId changes (e.g. restored from storage)
watch(
  () => aiStore.activeProviderId,
  (pid) => {
    // Restore per-provider model selection before loading (so loadCloudModels can find it)
    const saved = aiStore.providerCurrentModel[pid]
    if (saved) selectedModel.value = saved
    const savedSum = aiStore.summaryProviderModel[pid]
    if (savedSum) selectedSummaryModel.value = savedSum
    if (pid !== 'ollama') loadCloudModels(pid as ProviderId)
  },
  { immediate: false }
)

const selectProfile = (name: string) => {
  selectedStyle.value = name
  aiStore.setCurrentStyle(name)
}

const openNewProfile = () => {
  editingProfileName.value = null
  showProfileEditor.value = true
}

const openEditProfile = (name: string) => {
  editingProfileName.value = name
  showProfileEditor.value = true
}

const onProfileSaved = (name: string) => {
  // Switch to the newly saved profile
  selectProfile(name)
}

const closePanel = () => uiStore.setActivePanel('editor')

onMounted(async () => {
  if (aiStore.activeProviderId === 'ollama') {
    await checkConn()
  } else {
    await loadCloudModels(aiStore.activeProviderId as ProviderId)
  }
})
</script>

<style scoped>
.ai-panel {
  width: 280px;
  min-width: 260px;
  background-color: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  height: 52px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.ai-header h3 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary); }

.close-btn {
  background: none; border: none; color: var(--text-tertiary);
  cursor: pointer; font-size: 20px; line-height: 1; padding: 4px 8px;
  border-radius: var(--radius-sm);
}
.close-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

.ai-content {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.ai-section {
  background: var(--bg-primary); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); padding: var(--spacing-md);
  display: flex; flex-direction: column; gap: var(--spacing-sm);
}

.sec-label {
  font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-tertiary);
}

/* connection */
.connection-row { display: flex; align-items: center; gap: var(--spacing-sm); }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-on  { background: var(--success-color, #4caf50); }
.dot-off { background: var(--text-tertiary); }
.conn-label { flex: 1; font-size: 13px; color: var(--text-secondary); }
.hint { font-size: 12px; color: var(--text-tertiary); }
.hint code { background: var(--bg-tertiary); padding: 1px 4px; border-radius: 3px; font-family: monospace; }

.field-row { display: flex; align-items: center; gap: var(--spacing-sm); overflow: hidden; }
.field-label { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }
.field-select {
  min-width: 0; flex: 1;
  padding: 4px 6px; background: var(--bg-secondary);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  color: var(--text-primary); font-size: 12px;
}

/* pills */
.length-options { display: flex; flex-wrap: wrap; gap: 4px; }
.pill {
  padding: 3px 10px; font-size: 12px;
  border: 1px solid var(--border-color); border-radius: 20px;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: all var(--transition-fast);
}
.pill:hover { border-color: var(--accent-color); color: var(--accent-color); }
.pill.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
.pill.custom { border-style: dashed; }

/* writing profile list */
.sec-label-row {
  display: flex; align-items: center; justify-content: space-between;
}
.sec-label-actions { display: flex; gap: 2px; }
.btn-icon {
  background: none; border: none; cursor: pointer;
  color: var(--text-tertiary); font-size: 14px;
  padding: 2px 5px; border-radius: 3px; line-height: 1;
  transition: color 0.15s;
}
.btn-icon:hover { color: var(--accent-color); }

.profile-pills { display: flex; flex-direction: column; gap: 3px; }
.profile-pill-row {
  display: flex; align-items: center; gap: 4px;
}
.profile-pill-row .pill { flex: 1; text-align: left; border-radius: 6px; font-size: 12px; }
.pill-action-btn {
  background: none; border: none; cursor: pointer;
  color: var(--text-tertiary); font-size: 12px; padding: 3px 5px;
  border-radius: 4px; line-height: 1; flex-shrink: 0;
  opacity: 0;
  transition: color 0.15s, opacity 0.15s;
}
.profile-pill-row:hover .pill-action-btn,
.profile-pill-row.active .pill-action-btn { opacity: 1; }
.pill-action-btn:hover { color: var(--accent-color); }

.profile-description {
  font-size: 11px; color: var(--text-tertiary);
  font-style: italic; line-height: 1.4;
  padding: 2px 2px 0;
}

/* kbd hint */
.hint-section { gap: 6px; }
.kbd-row { display: flex; align-items: baseline; gap: 8px; font-size: 12px; color: var(--text-secondary); }
.kbd-row.muted { color: var(--text-tertiary); font-size: 11px; }
kbd {
  display: inline-block; padding: 1px 6px; font-size: 11px; font-family: monospace;
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  border-radius: 3px; color: var(--text-primary); white-space: nowrap;
}

.btn-sm {
  padding: 3px 8px; background: transparent;
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  cursor: pointer; font-size: 12px; color: var(--text-secondary);
}
.btn-sm:not(:disabled):hover { border-color: var(--accent-color); color: var(--accent-color); }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }

/* context tags */
.context-tag-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.muted { color: var(--text-tertiary); font-size: 11px; }

/* provider pills */
.provider-pills { display: flex; flex-wrap: wrap; gap: 4px; }

/* key config toggle button */
.key-toggle-btn {
  margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 3px; border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.key-toggle-btn .mdi-icon {
  width: 16px; height: 16px;
  fill: currentColor; display: block;
}
.key-toggle-btn.active { color: var(--accent-color); }

/* key drawer collapse/expand transition */
.key-expand-enter-active,
.key-expand-leave-active {
  transition: max-height 0.22s ease, opacity 0.22s ease;
  overflow: hidden;
  max-height: 120px;
}
.key-expand-enter-from,
.key-expand-leave-to { max-height: 0; opacity: 0; }

/* key drawer inner container */
.key-drawer {
  display: flex; flex-direction: column; gap: var(--spacing-sm);
  padding-top: 2px;
  border-top: 1px solid var(--border-color);
}

/* pricing badge — CSS tooltip (no delay) */
.pricing-badge {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-tertiary);
  position: relative; cursor: help;
}
.pricing-badge[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute; bottom: calc(100% + 4px); left: 0;
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); padding: 4px 8px;
  font-size: 11px; color: var(--text-secondary); white-space: nowrap;
  pointer-events: none; opacity: 0;
  transition: opacity 0.05s 0s;
  z-index: 100;
}
.pricing-badge[data-tooltip]:hover::after { opacity: 1; }
.pricing-in  { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.pricing-out { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.pricing-sep { color: var(--border-color); }
.pricing-unit { font-size: 10px; opacity: 0.7; }

/* dot-dim: key is set but not verified */
.dot-dim { background: var(--text-tertiary); }

/* field input (API key) */
.field-input {
  min-width: 0; flex: 1;
  padding: 4px 6px; background: var(--bg-secondary);
  border: 1px solid var(--border-color); border-radius: var(--radius-sm);
  color: var(--text-primary); font-size: 12px;
  font-family: monospace;
}
.field-input::placeholder { color: var(--text-tertiary); font-family: sans-serif; }

/* API key action row */
.key-actions {
  display: flex; align-items: center; gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.docs-link {
  margin-left: auto;
  font-size: 11px; color: var(--accent-color);
  text-decoration: none;
}
.docs-link:hover { text-decoration: underline; }
</style>
