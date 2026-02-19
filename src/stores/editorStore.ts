import { defineStore } from "pinia";
import { ref } from "vue";
import { autoSaveManager } from "@/utils/autoSave";

export interface EditorState {
  content: string;
  cursorPosition: number;
  isDirty: boolean;
  lastSaved: string;
  unsavedChanges: boolean;
  autoSaveEnabled: boolean;
  isSaving: boolean;
}

export const useEditorStore = defineStore("editor", () => {
  const content = ref<string>("");
  const cursorPosition = ref<number>(0);
  const isDirty = ref<boolean>(false);
  const lastSaved = ref<string>(new Date().toISOString());
  const unsavedChanges = ref<boolean>(false);
  const autoSaveEnabled = ref<boolean>(true);
  const isSaving = ref<boolean>(false);

  const setContent = (newContent: string) => {
    content.value = newContent
    isDirty.value = true
    unsavedChanges.value = true

    // Trigger auto-save if enabled
    if (autoSaveEnabled.value) {
      autoSaveManager.triggerAutoSave("current-chapter")
    }
  }

  const setCursorPosition = (position: number) => {
    cursorPosition.value = position;
  };

  const markAsSaved = () => {
    isDirty.value = false;
    unsavedChanges.value = false;
    lastSaved.value = new Date().toISOString();
    autoSaveManager.cancelAutoSave("current-chapter");
  };

  /**
   * Load content from outside (e.g. when switching chapters) without
   * marking the editor dirty or triggering auto-save.
   */
  const loadContent = (text: string) => {
    content.value = text;
    isDirty.value = false;
    unsavedChanges.value = false;
    autoSaveManager.cancelAutoSave("current-chapter");
  };

  /**
   * Insert text at the current cursor position (used by AI completions).
   */
  const insertAtCursor = (text: string) => {
    const pos = cursorPosition.value;
    content.value = content.value.slice(0, pos) + text + content.value.slice(pos);
    cursorPosition.value = pos + text.length;
    isDirty.value = true;
    unsavedChanges.value = true;
    if (autoSaveEnabled.value) {
      autoSaveManager.triggerAutoSave("current-chapter");
    }
  };

  const clearEditor = () => {
    content.value = "";
    cursorPosition.value = 0;
    isDirty.value = false;
    unsavedChanges.value = false;
  };

  const setAutoSaveEnabled = (enabled: boolean) => {
    autoSaveEnabled.value = enabled;
  };

  const setIsSaving = (saving: boolean) => {
    isSaving.value = saving;
  };

  return {
    // State
    content,
    cursorPosition,
    isDirty,
    lastSaved,
    unsavedChanges,
    autoSaveEnabled,
    isSaving,
    // Methods
    setContent,
    loadContent,
    insertAtCursor,
    setCursorPosition,
    markAsSaved,
    clearEditor,
    setAutoSaveEnabled,
    setIsSaving,
  };
});
