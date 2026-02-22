import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const CUSTOMIZABLE_VARS = [
  '--accent-color',
  '--bg-primary',
  '--bg-secondary',
  '--text-primary',
  '--border-color',
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
  keyboardShortcuts: Record<string, string>;
  themeColors: ThemeColorOverrides;
}

const STORAGE_KEY = 'blockbreaker_settings'

const defaultSettings: UserSettings = {
  theme: "dark",
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
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) }
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

  // Persist + apply on every change
  watch(settings, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    applyCSSVars(val)
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
