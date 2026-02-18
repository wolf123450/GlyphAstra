<template>
  <EditorSeamless
    :content="content"
    :cursorPos="cursorPos"
    forceMode="markdown"
    @update:content="emit('update:content', $event)"
    @update:cursorPos="emit('update:cursorPos', $event)"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EditorSeamless from './EditorSeamless.vue'

interface Props {
  content: string
}

interface Emits {
  'update:content': [value: string]
  'update:cursorPos': [value: number]
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Markdown editor needs to track cursor position too
const cursorPos = ref(0)
</script>

