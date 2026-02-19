<template>
  <aside class="ai-panel" v-if="isVisible">
    <div class="ai-header">
      <h3>AI Settings</h3>
      <button class="close-btn" @click="closePanel" title="Close">&#x2715;</button>
    </div>

    <div class="ai-content">

      <!-- Connection -->
      <section class="ai-section">
        <div class="sec-label">Ollama</div>
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
          <select v-model="selectedModel" class="field-select" @change="aiStore.setCurrentModel(selectedModel)">
            <option v-for="m in modelList" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </section>

      <!-- Style -->
      <section class="ai-section">
        <div class="sec-label">Writing style</div>
        <div class="style-pills">
          <button
            v-for="s in styles"
            :key="s.name"
            class="pill"
            :class="{ active: selectedStyle === s.name }"
            @click="selectedStyle = s.name; aiStore.setCurrentStyle(s.name)"
            :title="s.description"
          >{{ s.name }}</button>
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
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { useAIStore } from '@/stores/aiStore'
import { ollamaClient } from '@/api/ollama'

const uiStore = useUIStore()
const aiStore = useAIStore()

const isVisible   = computed(() => uiStore.activePanel === 'ai')
const styles      = computed(() => aiStore.styles)
const isConnected = computed(() => aiStore.isConnected)

const checking      = ref(false)
const modelList     = ref<string[]>([])
const selectedModel = ref(aiStore.currentModel)
const selectedStyle = ref(aiStore.currentStyle)

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
      if (modelList.value.length && !modelList.value.includes(selectedModel.value)) {
        selectedModel.value = modelList.value[0]
        aiStore.setCurrentModel(selectedModel.value)
      }
    }
  } finally {
    checking.value = false
  }
}

const closePanel = () => uiStore.setActivePanel('editor')

onMounted(() => { checkConn() })
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
.style-pills, .length-options { display: flex; flex-wrap: wrap; gap: 4px; }
.pill {
  padding: 3px 10px; font-size: 12px;
  border: 1px solid var(--border-color); border-radius: 20px;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: all var(--transition-fast);
}
.pill:hover { border-color: var(--accent-color); color: var(--accent-color); }
.pill.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }

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
</style>
