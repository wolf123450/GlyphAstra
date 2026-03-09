<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    v-bind="ariaAttrs"
  >
    <title v-if="title">{{ title }}</title>
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** MDI path string from '@mdi/js', e.g. mdiClose */
  path: string
  /** Icon width/height in pixels. Defaults to 16. */
  size?: number | string
  /** Accessible label. When provided, adds role="img" and a <title> element.
   *  Omit for decorative icons — aria-hidden="true" is set automatically. */
  title?: string
}>(), {
  size: 16,
})

const ariaAttrs = computed(() =>
  props.title
    ? { role: 'img' as const }
    : { 'aria-hidden': true as const }
)
</script>
