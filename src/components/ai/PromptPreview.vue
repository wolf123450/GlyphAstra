<template>
  <Teleport to="body">
    <div v-if="show" class="pp-overlay" @click.self="$emit('close')">
      <div class="pp-modal" ref="modalEl" @keydown.escape="$emit('close')">

        <div class="pp-header">
          <span class="pp-title">AI Prompt Preview</span>
          <div class="pp-header-actions">
            <button class="pp-icon-btn" @click="copyPrompt" :title="copied ? 'Copied!' : 'Copy to clipboard'">
              {{ copied ? '✓' : '⎘' }}
            </button>
            <button class="pp-close" @click="$emit('close')" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose"/></svg></button>
          </div>
        </div>

        <div class="pp-subheader">
          <span class="pp-sub-note">
            This is the exact prompt that will be sent to
            <strong>{{ model }}</strong> when you press
            <kbd>Ctrl+Space</kbd>.
          </span>
          <button class="pp-refresh-btn" @click="refresh" title="Re-generate from current cursor position">⟳ Refresh</button>
        </div>

        <div class="pp-body">
          <!-- Annotated prompt sections -->
          <template v-for="block in parsedBlocks" :key="block.tag + block.text.slice(0, 12)">
            <div class="pp-block" :class="`pp-block-${block.type}`">
              <span class="pp-block-tag">{{ block.tag }}</span>
              <pre class="pp-block-text">{{ block.text }}</pre>
            </div>
          </template>

          <div v-if="!prompt" class="pp-empty">
            No prompt yet — trigger a suggestion with <kbd>Ctrl+Space</kbd> first, or click ⟳ Refresh.
          </div>
        </div>

        <div class="pp-footer">
          <span class="pp-stats" v-if="prompt">
            {{ prompt.length }} chars · ~{{ Math.round(prompt.length / 4) }} tokens
          </span>
          <span class="pp-spacer"></span>
          <button class="pp-btn" @click="$emit('close')">Close</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { mdiClose } from '@mdi/js'
import { useAIStore } from '@/stores/aiStore'
import { useEditorStore } from '@/stores/editorStore'
import { useAISuggestion } from '@/utils/ai/useAISuggestion'

const props = defineProps<{ show: boolean }>()
defineEmits<{ close: [] }>()

const aiStore = useAIStore()
const editorStore = useEditorStore()
const ai = useAISuggestion()

const modalEl = ref<HTMLElement | null>(null)
const prompt = ref('')
const copied = ref(false)

const model = computed(() => aiStore.currentModel)

// ── Parse prompt into annotated sections for display ──────────────────────────

interface PromptBlock {
  type: 'system' | 'meta' | 'style' | 'context' | 'marker'
  tag: string
  text: string
}

const parsedBlocks = computed((): PromptBlock[] => {
  if (!prompt.value) return []

  const lines = prompt.value.split('\n')
  const blocks: PromptBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('You are')) {
      blocks.push({ type: 'system', tag: 'System', text: line })
      i++
    } else if (line.startsWith('Continue with') || line.startsWith('Write only')) {
      blocks.push({ type: 'system', tag: 'Length instruction', text: line })
      i++
    } else if (
      line.startsWith('Story title:') ||
      line.startsWith('Genre:') ||
      line.startsWith('Tone:')
    ) {
      blocks.push({ type: 'meta', tag: 'Story metadata', text: line })
      i++
    } else if (line.startsWith('Writing style instructions:')) {
      blocks.push({ type: 'style', tag: 'Writing profile', text: line })
      i++
    } else if (line === '=== TEXT ALREADY WRITTEN (do NOT repeat any of this) ===') {
      // Collect everything up to the closing marker
      i++
      const contextLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('=== WRITE ONLY')) {
        contextLines.push(lines[i])
        i++
      }
      blocks.push({
        type: 'context',
        tag: 'Context (last ~1500 chars)',
        text: contextLines.join('\n'),
      })
    } else if (line.startsWith('=== WRITE ONLY')) {
      blocks.push({ type: 'marker', tag: 'Continuation marker', text: line })
      i++
    } else {
      // Skip blank lines between sections silently
      i++
    }
  }

  return blocks
})

// ── Actions ───────────────────────────────────────────────────────────────────

function refresh() {
  // Build a fresh prompt from the current editor content
  const text = editorStore.content
  prompt.value = ai.buildPrompt(text)
}

async function copyPrompt() {
  if (!prompt.value) return
  try {
    await navigator.clipboard.writeText(prompt.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // ignore
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    // Show last prompt if one exists, otherwise build fresh
    const last = ai.getLastPrompt()
    prompt.value = last || ai.buildPrompt(editorStore.content)
    await nextTick()
    modalEl.value?.focus()
  }
)
</script>

<style scoped>
/* ─── Overlay ─────────────────────────────────────────── */
.pp-overlay {
  position: fixed;
  inset: 0;
  z-index: 1150;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* ─── Modal ───────────────────────────────────────────── */
.pp-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 680px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  outline: none;
}

/* ─── Header ──────────────────────────────────────────── */
.pp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.pp-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.pp-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pp-icon-btn, .pp-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 7px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  font-family: inherit;
}
.pp-icon-btn:hover, .pp-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover, var(--bg-primary));
}

/* ─── Sub-header ──────────────────────────────────────── */
.pp-subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--bg-primary) 40%, var(--bg-secondary));
  flex-shrink: 0;
}

.pp-sub-note {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.pp-refresh-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 3px 10px;
  white-space: nowrap;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.pp-refresh-btn:hover { color: var(--accent-color); border-color: var(--accent-color); }

/* ─── Body ────────────────────────────────────────────── */
.pp-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pp-empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

/* ─── Prompt blocks ───────────────────────────────────── */
.pp-block {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.pp-block-tag {
  display: block;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-color);
}

.pp-block-text {
  margin: 0;
  padding: 8px 10px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-primary);
}

/* Colour-coded block types */
.pp-block-system .pp-block-tag  { background: color-mix(in srgb, #5b8dee 12%, transparent); color: #5b8dee; }
.pp-block-meta .pp-block-tag    { background: color-mix(in srgb, #7fc97f 12%, transparent); color: #7fc97f; }
.pp-block-style .pp-block-tag   { background: color-mix(in srgb, var(--accent-color) 12%, transparent); color: var(--accent-color); }
.pp-block-context .pp-block-tag { background: color-mix(in srgb, #e0a070 12%, transparent); color: #e0a070; }
.pp-block-marker .pp-block-tag  { background: color-mix(in srgb, #c090e0 12%, transparent); color: #c090e0; }

.pp-block-context .pp-block-text {
  color: var(--text-muted);
  max-height: 180px;
  overflow-y: auto;
}

/* ─── Footer ──────────────────────────────────────────── */
.pp-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.pp-stats {
  font-size: 12px;
  color: var(--text-muted);
}

.pp-spacer { flex: 1; }

.pp-btn {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}
.pp-btn:hover { color: var(--text-primary); border-color: var(--text-muted); }

kbd {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--text-primary);
}
</style>
