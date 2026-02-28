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

const MODEL_STORAGE_KEY          = 'blockbreaker_current_model'
const ACTIVE_PROVIDER_KEY        = 'blockbreaker_active_provider'
const PROVIDER_KEYS_STORAGE_KEY  = 'blockbreaker_provider_keys'
const PROVIDER_ENABLED_KEY       = 'blockbreaker_provider_enabled'
const PROVIDER_MODEL_KEY         = 'blockbreaker_provider_models'
const SUMMARY_MODEL_KEY          = 'blockbreaker_summary_models'

type ProviderId = 'ollama' | 'openai' | 'anthropic' | 'google'

// ── Basic obfuscation for API keys at rest in localStorage ─────────────────
// This is NOT encryption — it prevents casual plaintext exposure in DevTools
// and protects against naive scraping. For true security, use Tauri stronghold.
const KEY_SALT = 'bb_k3y_0bfu5c'
function obfuscate(plaintext: string): string {
  const encoded = btoa(unescape(encodeURIComponent(plaintext)))
  return encoded.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ KEY_SALT.charCodeAt(i % KEY_SALT.length))
  ).join('')
}
function deobfuscate(obfuscated: string): string {
  const decoded = obfuscated.split('').map((c, i) =>
    String.fromCharCode(c.charCodeAt(0) ^ KEY_SALT.charCodeAt(i % KEY_SALT.length))
  ).join('')
  try { return decodeURIComponent(escape(atob(decoded))) } catch { return '' }
}

function loadProviderKeys(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PROVIDER_KEYS_STORAGE_KEY) ?? '{}'
    const stored = JSON.parse(raw)
    // Deobfuscate values; handles both legacy plaintext and obfuscated keys
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(stored)) {
      const val = v as string
      // Legacy plaintext keys start with known prefixes; obfuscated ones don't
      if (val.startsWith('sk-') || val.startsWith('AI') || val.length === 0) {
        result[k] = val // legacy plaintext — will be re-saved as obfuscated on next setApiKey
      } else {
        result[k] = deobfuscate(val)
      }
    }
    return result
  } catch { return {} }
}
function loadProviderEnabled(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(PROVIDER_ENABLED_KEY) ?? '{"ollama":true}') } catch { return { ollama: true } }
}
function loadProviderModels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PROVIDER_MODEL_KEY) ?? '{}') } catch { return {} }
}
function loadSummaryModels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SUMMARY_MODEL_KEY) ?? '{}') } catch { return {} }
}

export const useAIStore = defineStore("ai", () => {
  const models = ref<OllamaModel[]>([]);
  const currentModel = ref<string>(localStorage.getItem(MODEL_STORAGE_KEY) ?? 'llama2');
  const currentStyle = ref<string>("Lean & Direct");
  const suggestionTokens = ref<number>(80); // ~sentence length
  const isConnected = ref<boolean>(false);
  const isGenerating = ref<boolean>(false);

  // ── Provider state (Phase 16) ────────────────────────────────────────────
  const activeProviderId = ref<ProviderId>(
    (localStorage.getItem(ACTIVE_PROVIDER_KEY) ?? 'ollama') as ProviderId
  )
  const providerApiKeys       = ref<Record<string, string>>(loadProviderKeys())
  const providerEnabled       = ref<Record<string, boolean>>(loadProviderEnabled())
  const providerCurrentModel  = ref<Record<string, string>>(loadProviderModels())
  const summaryProviderModel  = ref<Record<string, string>>(loadSummaryModels())
  const completionHistory = ref<Completion[]>([]);
  const currentCompletions = ref<string[]>([]);

  const styles = ref<WritingProfile[]>(loadProfiles());

  const connectionStatus = computed(() => {
    return isConnected.value ? "Connected" : "Disconnected";
  });

  /** True when the active provider is ready to accept generation requests. */
  const canGenerate = computed(() => {
    const id = activeProviderId.value
    const enabled = providerEnabled.value[id] !== false
    if (!enabled) return false
    if (id === 'ollama') return isConnected.value
    const key = providerApiKeys.value[id]
    return !!(key && key.trim())
  })

  const setConnected = (connected: boolean) => {
    isConnected.value = connected;
  };

  const setModels = (newModels: OllamaModel[]) => {
    models.value = newModels;
  };

  const setCurrentModel = (model: string) => {
    currentModel.value = model;
    localStorage.setItem(MODEL_STORAGE_KEY, model);
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
    if (completionHistory.value.length > 100) {
      completionHistory.value = completionHistory.value.slice(-100)
    }
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

  // ── Provider actions (Phase 16) ────────────────────────────────────────────
  const setActiveProvider = (id: ProviderId) => {
    activeProviderId.value = id
    localStorage.setItem(ACTIVE_PROVIDER_KEY, id)
  }

  const setApiKey = (providerId: string, key: string) => {
    providerApiKeys.value = { ...providerApiKeys.value, [providerId]: key }
    // Store obfuscated keys in localStorage
    const obfuscated: Record<string, string> = {}
    for (const [k, v] of Object.entries(providerApiKeys.value)) {
      obfuscated[k] = v ? obfuscate(v) : ''
    }
    localStorage.setItem(PROVIDER_KEYS_STORAGE_KEY, JSON.stringify(obfuscated))
  }

  const setProviderEnabled = (providerId: string, enabled: boolean) => {
    providerEnabled.value = { ...providerEnabled.value, [providerId]: enabled }
    localStorage.setItem(PROVIDER_ENABLED_KEY, JSON.stringify(providerEnabled.value))
  }

  /** Save the last-used model for a given provider, and also set it as the global current model. */
  const setProviderModel = (providerId: string, model: string) => {
    providerCurrentModel.value = { ...providerCurrentModel.value, [providerId]: model }
    localStorage.setItem(PROVIDER_MODEL_KEY, JSON.stringify(providerCurrentModel.value))
    setCurrentModel(model)
  }

  /** Save the last-used summary model for a given provider (independent of the completions model). */
  const setSummaryModel = (providerId: string, model: string) => {
    summaryProviderModel.value = { ...summaryProviderModel.value, [providerId]: model }
    localStorage.setItem(SUMMARY_MODEL_KEY, JSON.stringify(summaryProviderModel.value))
  }

  /** Check if a provider has an API key set (without exposing the key value). */
  const hasApiKey = (providerId: string): boolean => {
    const key = providerApiKeys.value[providerId]
    return !!(key && key.trim())
  }

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
    // Provider state
    activeProviderId,
    providerApiKeys,
    providerEnabled,
    providerCurrentModel,
    summaryProviderModel,
    // Computed
    connectionStatus,
    canGenerate,
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
    // Provider actions
    setActiveProvider,
    setApiKey,
    setProviderEnabled,
    setProviderModel,
    setSummaryModel,
    hasApiKey,
  };
});
