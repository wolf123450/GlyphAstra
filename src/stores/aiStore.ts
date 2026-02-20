import { defineStore } from "pinia";
import { ref, computed } from "vue";

const PROFILES_STORAGE_KEY = "blockbreaker_writing_profiles";

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

/** Formerly AIStyle — now describes prose voice, not genre. */
export interface WritingProfile {
  name: string;
  /** One-line subtitle shown in pills / tooltips. */
  description: string;
  /** The full instruction block injected into the generation prompt. */
  prompt: string;
  /** Whether this was created by the user (can be edited / deleted). */
  isCustom?: boolean;
}

// Keep the old name as an alias so existing imports don't break
export type AIStyle = WritingProfile;

const BUILTIN_PROFILES: WritingProfile[] = [
  {
    name: "Lean & Direct",
    description: "Spare sentences, no adverbs, iceberg subtext",
    prompt: [
      "Write in a lean, direct style inspired by spare literary minimalism.",
      "Use short declarative sentences and occasional fragments for impact.",
      "Avoid adverbs — show action and emotion through concrete detail instead.",
      "Let subtext do the heavy lifting; characters rarely say exactly what they mean.",
      "Ground every scene in physical action and dialogue.",
    ].join(" "),
  },
  {
    name: "Lush & Lyrical",
    description: "Rich sensory prose, metaphor-heavy",
    prompt: [
      "Write in a lush, lyrical style with rich sensory description.",
      "Slow down for emotionally significant moments; linger on texture, colour, and sound.",
      "Use varied sentence length — short sentences for emphasis, longer flowing ones for atmosphere.",
      "Metaphor and simile are welcome when they illuminate rather than decorate.",
      "Every paragraph should appeal to at least two physical senses.",
    ].join(" "),
  },
  {
    name: "Deep POV",
    description: "Tight third-person intimacy, free indirect discourse",
    prompt: [
      "Write in deep third-person point of view.",
      "Stay tight inside the POV character's consciousness; thoughts and narration blend seamlessly.",
      "Use free indirect discourse: the narrator's voice carries the character's emotional coloring.",
      "What the POV character notices reveals their psychology — choose sensory details accordingly.",
      "Avoid head-hopping; every perception is filtered through the POV character's mind.",
    ].join(" "),
  },
  {
    name: "Commercial Thriller",
    description: "Forward momentum, short sentences under tension",
    prompt: [
      "Write for forward momentum above all else.",
      "Keep sentences short, especially during action or tension.",
      "Every paragraph should end with a reason to read the next one.",
      "Cause-and-effect is explicit: action leads directly to consequence.",
      "Cut anything that slows the pace unless it pays off tension later.",
    ].join(" "),
  },
  {
    name: "Literary",
    description: "Ambiguity valued, language carries meaning",
    prompt: [
      "Write in a literary style where language itself is part of the subject.",
      "Ambiguity is a feature, not a bug; resist the urge to over-explain.",
      "Image and symbol carry emotional weight alongside plot.",
      "Sentence structure can mirror the psychological state of the prose moment.",
      "Trust the reader to inhabit silence and negative space.",
    ].join(" "),
  },
];

function loadProfiles(): WritingProfile[] {
  try {
    const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (saved) {
      const custom: WritingProfile[] = JSON.parse(saved);
      return [...BUILTIN_PROFILES, ...custom.map((p) => ({ ...p, isCustom: true }))];
    }
  } catch {
    // ignore
  }
  return [...BUILTIN_PROFILES];
}

function saveCustomProfiles(profiles: WritingProfile[]) {
  const custom = profiles.filter((p) => p.isCustom);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(custom));
}

export const useAIStore = defineStore("ai", () => {
  const models = ref<OllamaModel[]>([]);
  const currentModel = ref<string>("llama2");
  const currentStyle = ref<string>("Lean & Direct");
  const suggestionTokens = ref<number>(80); // ~sentence length
  const isConnected = ref<boolean>(false);
  const isGenerating = ref<boolean>(false);
  const completionHistory = ref<Completion[]>([]);
  const currentCompletions = ref<string[]>([]);

  const styles = ref<WritingProfile[]>(loadProfiles());

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

  const setCurrentStyle = (style: string) => {
    currentStyle.value = style;
  };

  const setSuggestionTokens = (tokens: number) => {
    suggestionTokens.value = tokens;
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

  const addCustomProfile = (profile: Omit<WritingProfile, "isCustom">) => {
    styles.value.push({ ...profile, isCustom: true });
    saveCustomProfiles(styles.value);
  };

  const updateProfile = (name: string, updates: Partial<Omit<WritingProfile, "isCustom">>) => {
    const p = styles.value.find((s) => s.name === name);
    if (p && p.isCustom) {
      Object.assign(p, updates);
      saveCustomProfiles(styles.value);
    }
  };

  const deleteProfile = (name: string) => {
    const idx = styles.value.findIndex((s) => s.name === name && s.isCustom);
    if (idx > -1) {
      styles.value.splice(idx, 1);
      if (currentStyle.value === name) currentStyle.value = styles.value[0]?.name ?? "";
      saveCustomProfiles(styles.value);
    }
  };

  const clearCompletions = () => {
    currentCompletions.value = [];
  };

  return {
    // State
    models,
    currentModel,
    currentStyle,
    suggestionTokens,
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
    setCurrentStyle,
    setSuggestionTokens,
    setGenerating,
    addCompletion,
    setCurrentCompletions,
    acceptCompletion,
    rejectCompletion,
    getStyle,
    addCustomProfile,
    updateProfile,
    deleteProfile,
    clearCompletions,
  };
});
