import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { logger } from "@/utils/logger";

export const CUSTOMIZABLE_VARS = [
  // Surfaces
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  // Text
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  // UI chrome
  '--border-color',
  '--accent-color',
  '--accent-hover',
  // Semantic
  '--success-color',
  '--error-color',
  '--warning-color',
  // Status badges
  '--status-draft-bg',
  '--status-draft-fg',
  '--status-progress-bg',
  '--status-progress-fg',
  '--status-complete-bg',
  '--status-complete-fg',
] as const

export type CustomizableVar = typeof CUSTOMIZABLE_VARS[number]

export type ThemeColorOverrides = {
  dark:  Partial<Record<CustomizableVar, string>>
  light: Partial<Record<CustomizableVar, string>>
}

export interface UserSettings {
  theme: "dark" | "light";
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabWidth: number;
  spellCheck: boolean;
  autoSaveInterval: number;
  defaultCompletionStyle: string;
  defaultCompletionLength: string;
  defaultCompletionCount: number;
  defaultModel: string;
  contextWindowSize: number;
  responseTemperature: number;
  includeFutureChapters: boolean;
  keyboardShortcuts: Record<string, string>;
  themeColors: ThemeColorOverrides;
}

const STORAGE_KEY = 'blockbreaker_settings'

/** Detect OS preference; fall back to 'dark' if API unavailable. */
function detectOSTheme(): 'dark' | 'light' {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch { return 'dark' }
}

const defaultSettings: UserSettings = {
  theme: detectOSTheme(),
  fontSize: 14,
  fontFamily: "Fira Code, monospace",
  lineHeight: 1.6,
  tabWidth: 2,
  spellCheck: true,
  autoSaveInterval: 10000,
  defaultCompletionStyle: "mystical",
  defaultCompletionLength: "paragraph",
  defaultCompletionCount: 3,
  defaultModel: "llama2",
  contextWindowSize: 4096,
  responseTemperature: 0.7,
  includeFutureChapters: true,
  keyboardShortcuts: {
    "new-chapter": "ctrl+n",
    save: "ctrl+s",
    search: "ctrl+f",
    settings: "ctrl+,",
    "toggle-mode": "tab",
  },
  themeColors: { dark: {}, light: {} },
};

function loadFromStorage(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Basic shape check: must be a non-null object with a string theme
      if (typeof parsed === 'object' && parsed !== null && typeof parsed.theme === 'string') {
        return { ...defaultSettings, ...parsed }
      }
      logger.warn('Settings', 'Stored settings failed validation — using defaults')
    }
  } catch {}
  return { ...defaultSettings }
}

/**
 * Apply editor-related settings as CSS variables on :root so the editor
 * picks them up without needing props drilling.
 */
function applyCSSVars(s: UserSettings) {
  const root = document.documentElement
  root.style.setProperty('--editor-font-size', `${s.fontSize}px`)
  root.style.setProperty('--editor-line-height', String(s.lineHeight))
  root.style.setProperty('--editor-font-family', s.fontFamily)
  // Apply per-theme color overrides; remove property to fall back to stylesheet when not set
  const overrides = s.themeColors?.[s.theme] ?? {}
  for (const v of CUSTOMIZABLE_VARS) {
    const val = overrides[v]
    if (val) {
      root.style.setProperty(v, val)
    } else {
      root.style.removeProperty(v)
    }
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<UserSettings>(loadFromStorage());

  // Apply CSS vars immediately on any change (cheap), but debounce localStorage writes
  let _persistTimer: ReturnType<typeof setTimeout> | undefined
  watch(settings, (val) => {
    applyCSSVars(val)
    if (_persistTimer !== undefined) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }, 300)
  }, { deep: true, immediate: true })

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    settings.value[key] = value;
  };

  const updateKeyboardShortcut = (action: string, shortcut: string) => {
    settings.value.keyboardShortcuts[action] = shortcut;
  };

  const updateThemeColor = (theme: 'dark' | 'light', varName: CustomizableVar, value: string) => {
    settings.value.themeColors[theme][varName] = value
  }

  const resetThemeColors = (theme: 'dark' | 'light') => {
    settings.value.themeColors[theme] = {}
  }

  const resetToDefaults = () => {
    settings.value = { ...defaultSettings, themeColors: { dark: {}, light: {} } };
  };

  const getSetting = <K extends keyof UserSettings>(key: K): UserSettings[K] => {
    return settings.value[key];
  };

  return {
    settings,
    updateSetting,
    updateKeyboardShortcut,
    updateThemeColor,
    resetThemeColors,
    resetToDefaults,
    getSetting,
  };
});
