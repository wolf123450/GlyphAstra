<template>
  <Teleport to="body">
    <div v-if="uiStore.tourActive" class="tour-root" @click.self="skip">

      <!-- Spotlight box -->
      <div
        v-if="currentStep.targetSelector"
        class="tour-spotlight"
        :style="spotlightStyle"
      ></div>

      <!-- Step card -->
      <div class="tour-card" :style="cardStyle">
        <div class="tour-step-label">Step {{ uiStore.tourStep + 1 }} of {{ steps.length }}</div>
        <h3 class="tour-title">{{ currentStep.title }}</h3>
        <p class="tour-desc">{{ currentStep.description }}</p>
        <div class="tour-actions">
          <button class="tour-skip" @click="skip">Skip tour</button>
          <div class="tour-nav">
            <button
              v-if="uiStore.tourStep > 0"
              class="tour-prev"
              @click="uiStore.prevTourStep()"
            >← Back</button>
            <button class="tour-next" @click="advance">
              {{ uiStore.tourStep === steps.length - 1 ? 'Finish ✓' : 'Next →' }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import type { CSSProperties } from 'vue'
import { useUIStore } from '@/stores/uiStore'

const ONBOARDING_KEY = 'glyphastra_onboarding_complete'

const uiStore = useUIStore()

interface TourStep {
  targetSelector: string | null
  title: string
  description: string
  cardAnchor: 'right' | 'below' | 'above' | 'center'
}

const steps: TourStep[] = [
  {
    targetSelector: '.sidebar .sidebar-content',
    cardAnchor: 'right',
    title: 'Your Stories & Chapters',
    description:
      'The sidebar is your project navigator. Click the story title to switch between stories, use ⊕ to add chapters, and drag chapters to reorder them.',
  },
  {
    targetSelector: '.editor-header',
    cardAnchor: 'below',
    title: 'Editor Toolbar',
    description:
      'Switch between Seamless (live markdown), Markdown (raw source), and Preview modes. Save with ⬇, open the AI panel with ✦, export with ⬡.',
  },
  {
    targetSelector: '.editor-body',
    cardAnchor: 'right',
    title: 'The Editor',
    description:
      'Type your story here. Markdown is rendered live as you type in Seamless mode. Press Ctrl+Space at any point to get an AI writing suggestion.',
  },
  {
    targetSelector: '.editor-status',
    cardAnchor: 'above',
    title: 'Status Bar',
    description:
      'Track word count, character count, and save status at a glance. Click the Summary button to open Chapter Properties and manage AI context.',
  },
  {
    targetSelector: '.sidebar-footer',
    cardAnchor: 'above',
    title: 'Settings & Help',
    description:
      '⚙ opens Settings (Ctrl+,) where you can change fonts, theme, AI model, and shortcuts. ? opens this help story any time. ◐/☀ toggles dark/light mode.',
  },
  {
    targetSelector: null,
    cardAnchor: 'center',
    title: "You're all set! 🎉",
    description:
      'Start by clicking ⊕ to create your first chapter, or explore the Sandbox chapters in this help story to practise. You can re-launch this tour from Settings → Help.',
  },
]

// ─── Bounding rect for spotlight ───────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number }
const targetRect = ref<Rect | null>(null)

const PADDING = 8   // px of extra space around the highlighted element

function measureTarget() {
  const sel = currentStep.value.targetSelector
  if (!sel) { targetRect.value = null; return }
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) { targetRect.value = null; return }
  const r = el.getBoundingClientRect()
  targetRect.value = {
    top:    r.top    - PADDING,
    left:   r.left   - PADDING,
    width:  r.width  + PADDING * 2,
    height: r.height + PADDING * 2,
  }
}

watch(() => uiStore.tourStep, () => nextTick(measureTarget), { immediate: true })
watch(() => uiStore.tourActive, (v) => { if (v) nextTick(measureTarget) })

// Re-measure on window resize
function onResize() { if (uiStore.tourActive) measureTarget() }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// ─── Computed styles ────────────────────────────────────────────────────────

const currentStep = computed(() => steps[uiStore.tourStep] ?? steps[0])

const CARD_W = 320
const CARD_H = 200  // approximate

const spotlightStyle = computed(() => {
  if (!targetRect.value) return {}
  return {
    top:    `${targetRect.value.top}px`,
    left:   `${targetRect.value.left}px`,
    width:  `${targetRect.value.width}px`,
    height: `${targetRect.value.height}px`,
  }
})

const cardStyle = computed<CSSProperties>(() => {
  const r = targetRect.value
  const anchor = currentStep.value.cardAnchor
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 16

  if (!r || anchor === 'center') {
    return {
      top:       `50%`,
      left:      `50%`,
      transform: 'translate(-50%, -50%)',
    }
  }

  if (anchor === 'right') {
    const left = Math.min(r.left + r.width + margin, vw - CARD_W - margin)
    const top  = Math.max(margin, Math.min(r.top, vh - CARD_H - margin))
    return { top: `${top}px`, left: `${left}px` }
  }

  if (anchor === 'below') {
    const top  = Math.min(r.top + r.height + margin, vh - CARD_H - margin)
    const left = Math.max(margin, Math.min(r.left, vw - CARD_W - margin))
    return { top: `${top}px`, left: `${left}px` }
  }

  if (anchor === 'above') {
    const top  = Math.max(margin, r.top - CARD_H - margin)
    const left = Math.max(margin, Math.min(r.left, vw - CARD_W - margin))
    return { top: `${top}px`, left: `${left}px` }
  }

  return {}
})

// ─── Actions ────────────────────────────────────────────────────────────────

function advance() {
  uiStore.nextTourStep(steps.length)
  if (!uiStore.tourActive) {
    localStorage.setItem(ONBOARDING_KEY, 'true')
  }
}

function skip() {
  uiStore.endTour()
  localStorage.setItem(ONBOARDING_KEY, 'true')
}
</script>

<style scoped>
.tour-root {
  position: fixed;
  inset: 0;
  z-index: 9000;
  /* No background — the spotlight box handles dimming via box-shadow */
}

/* The spotlight box — box-shadow bleeds out to cover the rest of the screen */
.tour-spotlight {
  position: fixed;
  z-index: 9001;
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.62);
  pointer-events: none;
  transition: top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease;
}

.tour-card {
  position: fixed;
  z-index: 9002;
  width: 320px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  padding: 18px 20px 14px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tour-step-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--accent-color);
  opacity: 0.85;
}

.tour-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.tour-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.tour-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.tour-skip {
  background: none;
  border: none;
  color: var(--text-muted, var(--text-tertiary));
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
}
.tour-skip:hover { opacity: 1; }

.tour-nav {
  display: flex;
  gap: 8px;
}

.tour-prev, .tour-next {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.tour-prev {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.tour-prev:hover { background: var(--bg-hover, var(--bg-tertiary)); }
.tour-next {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}
.tour-next:hover { opacity: 0.9; }
</style>
