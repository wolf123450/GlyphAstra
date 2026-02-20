import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface UserSettings {
  theme: "dark" | "light";
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  tabWidth: number;
  autoSaveInterval: number;
  defaultCompletionStyle: string;
  defaultCompletionLength: string;
  defaultCompletionCount: number;
  defaultModel: string;
  contextWindowSize: number;
  responseTemperature: number;
  keyboardShortcuts: Record<string, string>;
}

const STORAGE_KEY = 'blockbreaker_settings'

const defaultSettings: UserSettings = {
  theme: "dark",
  fontSize: 14,
  fontFamily: "Fira Code, monospace",
  lineHeight: 1.6,
  tabWidth: 2,
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

  const resetToDefaults = () => {
    settings.value = { ...defaultSettings };
  };

  const getSetting = <K extends keyof UserSettings>(key: K): UserSettings[K] => {
    return settings.value[key];
  };

  return {
    settings,
    updateSetting,
    updateKeyboardShortcut,
    resetToDefaults,
    getSetting,
  };
});
