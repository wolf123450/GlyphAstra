import { defineStore } from "pinia";
import { ref } from "vue";

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

  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value;
  };

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = width;
  };

  const setTheme = (newTheme: "dark" | "light") => {
    theme.value = newTheme;
    document.documentElement.setAttribute("data-theme", newTheme);
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
    duration: number = 3000
  ) => {
    notificationMessage.value = message;
    notificationType.value = type;
    isNotificationVisible.value = true;

    if (duration > 0) {
      setTimeout(() => {
        isNotificationVisible.value = false;
      }, duration);
    }
  };

  const hideNotification = () => {
    isNotificationVisible.value = false;
  };

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
    // Onboarding tour
    tourActive,
    tourStep,
    startTour,
    endTour,
    nextTourStep,
    prevTourStep,
  };
});
