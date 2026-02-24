<template>
  <EditorSeamless
    ref="seamlessRef"
    :content="content"
    :cursorPos="cursorPos"
    forceMode="markdown"
    :isReadOnly="isReadOnly"
    :suggestion-text="suggestionText"
    :suggestion-count="suggestionCount"
    :suggestion-index="suggestionIndex"
    :suggestion-generating="suggestionGenerating"
    @update:content="emit('update:content', $event)"
    @update:cursorPos="emit('update:cursorPos', $event)"
    @trigger-ai="emit('trigger-ai')"
    @accept-suggestion="emit('accept-suggestion')"
    @dismiss-suggestion="emit('dismiss-suggestion')"
    @next-suggestion="emit('next-suggestion')"
    @prev-suggestion="emit('prev-suggestion')"
    @type-char="emit('type-char', $event)"
    @undo="emit('undo')"
    @redo="emit('redo')"
    @snapshot="emit('snapshot')"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EditorSeamless from './EditorSeamless.vue'

interface Props {
  content: string
  isReadOnly?: boolean
  suggestionText?: string
  suggestionCount?: number
  suggestionIndex?: number
  suggestionGenerating?: boolean
}

interface Emits {
  'update:content':    [value: string]
  'update:cursorPos':  [value: number]
  'trigger-ai':        []
  'accept-suggestion': []
  'dismiss-suggestion':[]
  'next-suggestion':   []
  'prev-suggestion':   []
  'type-char':         [char: string]
  'undo':              []
  'redo':              []
  'snapshot':          []
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const cursorPos = ref(0)

const seamlessRef = ref<InstanceType<typeof EditorSeamless> | null>(null)
// Pass through the inner scroll container so Editor.vue can sync scroll across mode switches
defineExpose({
  get scrollEl() { return seamlessRef.value?.scrollEl ?? null },
})
</script>
