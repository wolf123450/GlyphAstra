// Module augmentation for globally registered components.
// This file must stay a TypeScript MODULE (i.e. it has at least one import/export)
// so that 'declare module' below is treated as augmentation, not a replacement.
import type { DefineComponent } from 'vue'

declare module 'vue' {
  interface GlobalComponents {
    AppIcon: typeof import('./components/AppIcon.vue')['default']
  }
}
