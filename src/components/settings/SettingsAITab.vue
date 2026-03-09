<template>
  <div class="tab-content">
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

    <!-- Cloud AI Providers -->
    <div class="setting-group-separator"></div>
    <div class="setting-group-label">Cloud AI Providers</div>
    <div class="setting-row">
      <p class="setting-hint api-key-notice">
        <AppIcon :path="mdiLockOutline" :size="13" style="vertical-align:middle;margin-right:5px" />API keys are stored locally on this device only and are never sent to any Glyph Astra server.
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
          @change="(e) => onApiKeyChange(pid, (e.target as HTMLInputElement).value)"
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { mdiLockOutline } from '@mdi/js'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAIStore } from '@/stores/aiStore'
import { makeProvider, PROVIDER_META, ALL_PROVIDER_IDS } from '@/api/providers'
import type { ProviderId } from '@/api/providers'

const settingsStore = useSettingsStore()
const settings = settingsStore.settings
const aiStore = useAIStore()

const styles = ['mystical', 'sci-fi', 'romance', 'fantasy', 'noir']

const lengthOptions = [
  { label: 'Phrase',    tokens: 30 },
  { label: 'Sentence',  tokens: 80 },
  { label: 'Paragraph', tokens: 200 },
]

const CLOUD_PROVIDER_IDS = ALL_PROVIDER_IDS.filter(p => p !== 'ollama') as Exclude<ProviderId, 'ollama'>[]

const providerTesting     = ref<Record<string, boolean>>({})
const providerTestResults = ref<Record<string, boolean | undefined>>({})

function update<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) {
  settingsStore.updateSetting(key, value)
}

function onApiKeyChange(pid: ProviderId, key: string) {
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
</script>

<style scoped>
@import './settingsStyles.css';

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
