<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="props.show" class="wpe-overlay" @click.self="cancel">
        <div class="wpe-modal modal-card" ref="modalEl" @keydown.escape="cancel">

        <div class="wpe-header">
          <span class="wpe-title">{{ isNew ? 'New Writing Profile' : editingCustom ? 'Edit Profile' : 'View Profile' }}</span>
          <button class="wpe-close" @click="cancel" title="Close"><AppIcon :path="mdiClose" :size="16" /></button>
        </div>

        <div class="wpe-body">

          <!-- Name -->
          <div class="wpe-field">
            <label class="wpe-label">Profile name</label>
            <input
              v-if="canEdit"
              v-model="form.name"
              class="wpe-input"
              placeholder="e.g. My Noir Style"
              maxlength="48"
              @input="nameTouched = true"
            />
            <div v-else class="wpe-readonly-value wpe-name-display">{{ form.name }}</div>
          </div>

          <!-- Description -->
          <div class="wpe-field">
            <label class="wpe-label">Short description <span class="wpe-hint">(shown in pill tooltip)</span></label>
            <input
              v-if="canEdit"
              v-model="form.description"
              class="wpe-input"
              placeholder="e.g. Dark, clipped prose with atmospheric tension"
              maxlength="80"
            />
            <div v-else class="wpe-readonly-value">{{ form.description }}</div>
          </div>

          <!-- Prompt block -->
          <div class="wpe-field wpe-field-grow">
            <label class="wpe-label">
              Writing style instructions
              <span class="wpe-hint">(injected verbatim into the AI prompt)</span>
            </label>
            <textarea
              v-if="canEdit"
              v-model="form.prompt"
              class="wpe-textarea"
              placeholder="Describe the prose style in plain English. For example:&#10;Use short declarative sentences and occasional fragments for impact. Avoid adverbs — show action and emotion through concrete detail. Let subtext do the heavy lifting."
              spellcheck="false"
            ></textarea>
            <pre v-else class="wpe-readonly-pre">{{ form.prompt }}</pre>

            <div class="wpe-char-count">
              {{ form.prompt.length }} chars ·
              ~{{ Math.round(form.prompt.length / 4) }} tokens
            </div>
          </div>

          <!-- Guided starters (only when editing) -->
          <div v-if="canEdit" class="wpe-field">
            <label class="wpe-label">Quick starters <span class="wpe-hint">(click to append)</span></label>
            <div class="wpe-starters">
              <button
                v-for="s in starters"
                :key="s.label"
                class="wpe-starter-btn"
                @click="appendStarter(s.text)"
                :title="s.text"
              >{{ s.label }}</button>
            </div>
          </div>

          <!-- Validation error -->
          <div v-if="validationError" class="wpe-error">{{ validationError }}</div>

        </div><!-- /body -->

        <div class="wpe-footer">
          <button
            v-if="editingCustom && !isNew"
            class="wpe-btn wpe-btn-danger"
            @click="deleteProfile"
          >Delete</button>
          <span class="wpe-spacer"></span>
          <button class="wpe-btn wpe-btn-ghost" @click="cancel">{{ canEdit ? 'Cancel' : 'Close' }}</button>
          <button
            v-if="canEdit"
            class="wpe-btn wpe-btn-primary"
            @click="save"
          >{{ isNew ? 'Create' : 'Save' }}</button>
        </div>

      </div>

    <!-- Inline delete confirmation (replaces native confirm) -->
    <div v-if="showDeleteConfirm" class="wpe-confirm-overlay" @click.self="cancelDelete">
      <div class="wpe-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm deletion">
        <p>Delete the profile "{{ props.profileName }}"? This cannot be undone.</p>
        <div class="wpe-confirm-actions">
          <button class="wpe-btn wpe-btn-ghost" @click="cancelDelete">Cancel</button>
          <button class="wpe-btn wpe-btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
  </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { mdiClose } from '@mdi/js'
import { useAIStore, type WritingProfile } from '@/stores/aiStore'
import { useFocusTrap } from '@/utils/useFocusTrap'

const props = defineProps<{
  show: boolean
  /** If provided, opens in edit mode for that profile. If null, opens as new. */
  profileName: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: [name: string]
}>()

const aiStore = useAIStore()
const modalEl = ref<HTMLElement | null>(null)
useFocusTrap(modalEl, computed(() => props.show))
const nameTouched = ref(false)
const validationError = ref('')

const form = ref<{ name: string; description: string; prompt: string }>({
  name: '',
  description: '',
  prompt: '',
})

// ── Derived state ──────────────────────────────────────────────────────────────

const existingProfile = computed<WritingProfile | undefined>(() =>
  props.profileName ? aiStore.getStyle(props.profileName) : undefined
)

const isNew = computed(() => !props.profileName)
const editingCustom = computed(() => existingProfile.value?.isCustom ?? false)
/** Built-in profiles are read-only; new or custom profiles are editable. */
const canEdit = computed(() => isNew.value || editingCustom.value)

// ── Quick starters ─────────────────────────────────────────────────────────────

const starters = [
  { label: 'Short sentences', text: 'Use short, declarative sentences.' },
  { label: 'Long sentences', text: 'Favour long, syntactically complex sentences that wind through subordinate clauses.' },
  { label: 'Sensory detail', text: 'Anchor every scene in at least two physical senses (touch, sound, smell, taste).' },
  { label: 'No adverbs', text: 'Avoid adverbs — show emotion and action through concrete physical detail.' },
  { label: 'Deep interiority', text: 'Stay close to the POV character\'s inner voice; thoughts blend with narration.' },
  { label: 'Fast pacing', text: 'Cut any sentence that doesn\'t drive the story forward.' },
  { label: 'Rich metaphor', text: 'Use vivid metaphor and simile when they illuminate rather than decorate.' },
  { label: 'YA audience', text: 'Write for a young adult audience; accessible vocabulary, relatable voice.' },
  { label: 'Literary audience', text: 'Write for an adult literary audience comfortable with complexity and ambiguity.' },
  { label: 'Subtext dialogue', text: 'Characters rarely say exactly what they mean; let subtext do the work.' },
]

function appendStarter(text: string) {
  form.value.prompt = form.value.prompt
    ? form.value.prompt.trimEnd() + ' ' + text
    : text
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    nameTouched.value = false
    validationError.value = ''
    if (existingProfile.value) {
      form.value = {
        name: existingProfile.value.name,
        description: existingProfile.value.description,
        prompt: existingProfile.value.prompt,
      }
    } else {
      form.value = { name: '', description: '', prompt: '' }
    }
    await nextTick()
    modalEl.value?.focus()
  }
)

// ── Actions ────────────────────────────────────────────────────────────────────

function validate(): boolean {
  validationError.value = ''
  if (!form.value.name.trim()) {
    validationError.value = 'Profile name is required.'
    return false
  }
  if (!form.value.prompt.trim()) {
    validationError.value = 'Writing style instructions are required.'
    return false
  }
  // Check name uniqueness for new profiles
  if (isNew.value && aiStore.getStyle(form.value.name.trim())) {
    validationError.value = `A profile named "${form.value.name.trim()}" already exists.`
    return false
  }
  return true
}

function save() {
  if (!validate()) return
  if (isNew.value) {
    aiStore.addCustomProfile({
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      prompt: form.value.prompt.trim(),
    })
  } else {
    aiStore.updateProfile(props.profileName!, {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      prompt: form.value.prompt.trim(),
    })
  }
  emit('saved', form.value.name.trim())
  emit('close')
}

const showDeleteConfirm = ref(false)

function deleteProfile() {
  if (!props.profileName) return
  showDeleteConfirm.value = true
}

function confirmDelete() {
  if (!props.profileName) return
  showDeleteConfirm.value = false
  aiStore.deleteProfile(props.profileName)
  emit('close')
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

function cancel() {
  emit('close')
}
</script>

<style scoped>
/* ─── Overlay ─────────────────────────────────────────── */
.wpe-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* ─── Modal ───────────────────────────────────────────── */
.wpe-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 580px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  outline: none;
}

/* ─── Header ──────────────────────────────────────────── */
.wpe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.wpe-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.wpe-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.wpe-close:hover { color: var(--text-primary); background: var(--bg-hover, var(--bg-primary)); }

/* ─── Body ────────────────────────────────────────────── */
.wpe-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wpe-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wpe-field-grow {
  flex: 1;
}

.wpe-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.wpe-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

.wpe-input {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  padding: 8px 10px;
  outline: none;
  transition: border-color 0.15s;
}
.wpe-input:focus { border-color: var(--accent-color); }

.wpe-textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  padding: 10px;
  outline: none;
  resize: vertical;
  min-height: 120px;
  line-height: 1.6;
  transition: border-color 0.15s;
}
.wpe-textarea:focus { border-color: var(--accent-color); }

.wpe-readonly-value {
  font-size: 13px;
  color: var(--text-primary);
  padding: 6px 0;
  line-height: 1.5;
}

.wpe-name-display {
  font-weight: 600;
  font-size: 15px;
}

.wpe-readonly-pre {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  margin: 0;
}

.wpe-char-count {
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
}

/* ─── Quick starters ──────────────────────────────────── */
.wpe-starters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.wpe-starter-btn {
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.wpe-starter-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* ─── Validation error ────────────────────────────────── */
.wpe-error {
  font-size: 12px;
  color: var(--error-color, #e07070);
  padding: 4px 0;
}

/* ─── Footer ──────────────────────────────────────────── */
.wpe-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.wpe-spacer { flex: 1; }

.wpe-btn {
  padding: 6px 16px;
  font-size: 13px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
  transition: all 0.15s;
}

.wpe-btn-ghost {
  background: none;
  border-color: var(--border-color);
  color: var(--text-muted);
}
.wpe-btn-ghost:hover { color: var(--text-primary); border-color: var(--text-muted); }

.wpe-btn-primary {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
}
.wpe-btn-primary:hover { opacity: 0.88; }

.wpe-btn-danger {
  background: none;
  color: var(--error-color, #e07070);
  border-color: var(--error-color, #e07070);
}
.wpe-btn-danger:hover { background: color-mix(in srgb, var(--error-color, #e07070) 15%, transparent); }

/* ── Inline confirm dialog ── */
.wpe-confirm-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1300;
}
.wpe-confirm {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.wpe-confirm p { margin: 0 0 14px; color: var(--text-primary); }
.wpe-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
