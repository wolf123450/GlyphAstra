import { defineStore } from "pinia";
import { ref } from "vue";

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

const defaultSettings: UserSettings = {
  theme: "dark",
  fontSize: 14,
  fontFamily: "Fira Code, monospace",
  lineHeight: 1.6,
  tabWidth: 2,
  autoSaveInterval: 10000, // 10 seconds
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

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<UserSettings>({ ...defaultSettings });

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
    // State
    settings,
    // Methods
    updateSetting,
    updateKeyboardShortcut,
    resetToDefaults,
    getSetting,
  };
});
