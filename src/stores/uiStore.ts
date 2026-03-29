import { defineStore } from "pinia";
import { ref } from "vue";
import { useSettingsStore } from "./settingsStore";

// ─── Context menu types ───────────────────────────────────────────────────────
export type MenuItem =
  | { type: 'action'; label: string; shortcut?: string; danger?: boolean; callback: () => void }
  | { type: 'separator' }
  | { type: 'disabled'; label: string }

export interface UIState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  theme: "dark" | "light";
  showSettings: boolean;
  showSearchPanel: boolean;
  activePanel: "editor" | "preview" | "overview" | "ai" | "export";
  sidebarSearchQuery: string;
  notificationMessage: string;
  notificationType: "success" | "error" | "info" | "warning";
  isNotificationVisible: boolean;
}

export const useUIStore = defineStore("ui", () => {
  const sidebarOpen = ref<boolean>(true);
  const sidebarWidth = ref<number>(250);
  const theme = ref<"dark" | "light">("dark");
  const showSettings = ref<boolean>(false);
  const showSearchPanel = ref<boolean>(false);
  const activePanel = ref<"editor" | "preview" | "overview" | "ai" | "export">("editor");
  const sidebarSearchQuery = ref<string>("");
  const notificationMessage = ref<string>("");
  const notificationType = ref<"success" | "error" | "info" | "warning">(
    "info"
  );
  const isNotificationVisible = ref<boolean>(false);
  const notificationAction = ref<{ label: string; callback: () => void } | null>(null);
  let _notificationTimer: number | undefined;

  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value;
  };

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width;
  };

  const setTheme = (newTheme: "dark" | "light") => {
    theme.value = newTheme;
    document.documentElement.setAttribute("data-theme", newTheme);
    // Keep settingsStore in sync so the persisted theme matches
    const settingsStore = useSettingsStore();
    if (settingsStore.settings.theme !== newTheme) {
      settingsStore.updateSetting('theme', newTheme);
    }
  };

  const toggleSettings = () => {
    showSettings.value = !showSettings.value;
  };

  const toggleSearchPanel = () => {
    showSearchPanel.value = !showSearchPanel.value;
  };

  const setActivePanel = (panel: "editor" | "preview" | "overview" | "ai" | "export") => {
    activePanel.value = panel;
  };

  const setSidebarSearchQuery = (query: string) => {
    sidebarSearchQuery.value = query;
  };

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "info",
    duration: number = 3000,
    action?: { label: string; callback: () => void }
  ) => {
    notificationMessage.value = message;
    notificationType.value = type;
    notificationAction.value = action ?? null;
    isNotificationVisible.value = true;

    if (_notificationTimer !== undefined) clearTimeout(_notificationTimer);
    if (duration > 0) {
      _notificationTimer = window.setTimeout(() => {
        isNotificationVisible.value = false;
        _notificationTimer = undefined;
      }, duration);
    }
  };

  const hideNotification = () => {
    isNotificationVisible.value = false;
    notificationAction.value = null;
  };

  // ─── Context menu ─────────────────────────────────────────────────────
  const contextMenuVisible = ref(false)
  const contextMenuX       = ref(0)
  const contextMenuY       = ref(0)
  const contextMenuItems   = ref<MenuItem[]>([])

  const showContextMenu = (x: number, y: number, items: MenuItem[]) => {
    contextMenuItems.value  = items
    contextMenuX.value      = x
    contextMenuY.value      = y
    contextMenuVisible.value = true
  }

  const hideContextMenu = () => {
    contextMenuVisible.value = false
  }

  // ─── Chapter action triggers (set by context menu, consumed by Sidebar / ChapterItem) ──
  const renamingChapterId      = ref<string | null>(null)
  const pendingDeleteChapterId = ref<string | null>(null)
  const pendingMetaChapterId   = ref<string | null>(null)

  const triggerChapterRename = (id: string) => { renamingChapterId.value = id }
  const triggerChapterDelete = (id: string) => { pendingDeleteChapterId.value = id }
  const triggerChapterMeta   = (id: string) => { pendingMetaChapterId.value = id }
  const clearChapterRename   = () => { renamingChapterId.value = null }
  const clearChapterDelete   = () => { pendingDeleteChapterId.value = null }
  const clearChapterMeta     = () => { pendingMetaChapterId.value = null }

  // ─── Onboarding tour ─────────────────────────────────────────────────
  const tourActive = ref(false)
  const tourStep   = ref(0)

  const startTour = () => {
    tourStep.value  = 0
    tourActive.value = true
  }

  const endTour = () => {
    tourActive.value = false
  }

  const nextTourStep = (totalSteps: number) => {
    if (tourStep.value < totalSteps - 1) {
      tourStep.value++
    } else {
      endTour()
    }
  }

  const prevTourStep = () => {
    if (tourStep.value > 0) tourStep.value--
  }

  return {
    // State
    sidebarOpen,
    sidebarWidth,
    theme,
    showSettings,
    showSearchPanel,
    activePanel,
    sidebarSearchQuery,
    notificationMessage,
    notificationType,
    isNotificationVisible,
    notificationAction,
    // Methods
    toggleSidebar,
    setSidebarWidth,
    setTheme,
    toggleSettings,
    toggleSearchPanel,
    setActivePanel,
    setSidebarSearchQuery,
    showNotification,
    hideNotification,
    // Context menu
    contextMenuVisible,
    contextMenuX,
    contextMenuY,
    contextMenuItems,
    showContextMenu,
    hideContextMenu,
    // Chapter action triggers
    renamingChapterId,
    pendingDeleteChapterId,
    pendingMetaChapterId,
    triggerChapterRename,
    triggerChapterDelete,
    triggerChapterMeta,
    clearChapterRename,
    clearChapterDelete,
    clearChapterMeta,
    // Onboarding tour
    tourActive,
    tourStep,
    startTour,
    endTour,
    nextTourStep,
    prevTourStep,
  };
});
