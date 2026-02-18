import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface OllamaModel {
  name: string;
  size: string;
  modifiedAt: string;
  digest: string;
}

export interface Completion {
  id: string;
  text: string;
  style: string;
  model: string;
  timestamp: string;
  accepted: boolean;
}

export interface AIStyle {
  name: string;
  description: string;
  prompt: string;
  tone: string;
}

export const useAIStore = defineStore("ai", () => {
  const models = ref<OllamaModel[]>([]);
  const currentModel = ref<string>("llama2");
  const isConnected = ref<boolean>(false);
  const isGenerating = ref<boolean>(false);
  const completionHistory = ref<Completion[]>([]);
  const currentCompletions = ref<string[]>([]);

  const styles = ref<AIStyle[]>([
    {
      name: "mystical",
      description: "Enchanting and magical language",
      prompt: "Write in a mystical, enchanting style with magical themes",
      tone: "whimsical",
    },
    {
      name: "sci-fi",
      description: "Futuristic and technical",
      prompt:
        "Write in a sci-fi style with advanced technology and futuristic concepts",
      tone: "technical",
    },
    {
      name: "romance",
      description: "Emotional and romantic",
      prompt: "Write in a romantic style with emotional depth and chemistry",
      tone: "passionate",
    },
    {
      name: "noir",
      description: "Dark and mysterious",
      prompt: "Write in a noir style with dark, mysterious atmosphere",
      tone: "dark",
    },
    {
      name: "fantasy",
      description: "Epic fantasy adventure",
      prompt: "Write in an epic fantasy style with adventure and wonder",
      tone: "epic",
    },
  ]);

  const connectionStatus = computed(() => {
    return isConnected.value ? "Connected" : "Disconnected";
  });

  const setConnected = (connected: boolean) => {
    isConnected.value = connected;
  };

  const setModels = (newModels: OllamaModel[]) => {
    models.value = newModels;
  };

  const setCurrentModel = (model: string) => {
    currentModel.value = model;
  };

  const setGenerating = (generating: boolean) => {
    isGenerating.value = generating;
  };

  const addCompletion = (completion: Completion) => {
    completionHistory.value.push(completion);
  };

  const setCurrentCompletions = (completions: string[]) => {
    currentCompletions.value = completions;
  };

  const acceptCompletion = (index: number) => {
    if (index < completionHistory.value.length) {
      completionHistory.value[index].accepted = true;
    }
  };

  const rejectCompletion = (index: number) => {
    if (index < completionHistory.value.length) {
      completionHistory.value.splice(index, 1);
    }
  };

  const getStyle = (styleName: string) => {
    return styles.value.find((s) => s.name === styleName);
  };

  const clearCompletions = () => {
    currentCompletions.value = [];
  };

  return {
    // State
    models,
    currentModel,
    isConnected,
    isGenerating,
    completionHistory,
    currentCompletions,
    styles,
    // Computed
    connectionStatus,
    // Methods
    setConnected,
    setModels,
    setCurrentModel,
    setGenerating,
    addCompletion,
    setCurrentCompletions,
    acceptCompletion,
    rejectCompletion,
    getStyle,
    clearCompletions,
  };
});
