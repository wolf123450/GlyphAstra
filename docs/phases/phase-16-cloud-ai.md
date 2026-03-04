# Phase 16: Cloud AI Model Integration 🟡 85%

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

**Context:** Ollama covers local models well, but many users will want to use hosted cloud models (OpenAI, Anthropic, Google) — especially for higher-quality suggestions or when a machine is underpowered for local inference. This is a **BYO API key** integration; Glyph Astra will never proxy or hold user keys server-side.

### 16.1 Architecture ✅ COMPLETE
- [x] Abstract the current Ollama client behind a `ModelProvider` interface (`src/api/providers/types.ts`):
  ```
  interface ModelProvider {
    id: string                                  // 'ollama' | 'openai' | 'anthropic' | 'google'
    name: string
    isAvailable(): Promise<boolean>
    listModels(): Promise<ModelInfo[]>
    streamCompletion(prompt, opts, onChunk): Promise<void>
  }
  ```
- [x] `aiStore` holds `activeProviderId` + `providerApiKeys` (obfuscated in localStorage)
- [x] AI panel model selector uses provider pill buttons; `makeProvider()` factory in `src/api/providers/index.ts`
- [x] `PROVIDER_META` registry with display names, hints, and docs URLs

### 16.2 Provider Implementations ✅ COMPLETE
- [x] **OpenAI** (`src/api/providers/openai.ts`) — SSE streaming via `POST /v1/chat/completions`; dynamic model list from API with 5-min cache; hardcoded pricing for GPT-5, GPT-4.1, GPT-4o, o-series, and legacy models
- [x] **Anthropic** (`src/api/providers/anthropic.ts`) — Messages API with SSE streaming; static curated model list (Claude Opus 4.6, Sonnet 4.6, Haiku 4.5); `anthropic-dangerous-direct-browser-access` header for WebView usage
- [x] **Google Gemini** (`src/api/providers/google.ts`) — `generateContentStream` via Generative Language API; dynamic model list with 5-min cache; hardcoded pricing for Gemini 2.5/2.0/1.5 family
- [x] Each provider lives in `src/api/providers/{name}.ts`; shared SSE parser + prompt splitter in `shared.ts`

### 16.3 Settings UI ✅ COMPLETE
- [x] "Cloud AI Providers" section in Settings → AI tab with per-provider rows
- [x] Per-provider: API key input (masked), "Test" button, status dot (green/red)
- [x] 🔒 Privacy banner: *"API keys are stored locally on this device only and are never sent to any Glyph Astra server."*
- [x] Cloud models appear in AI Panel model selector when provider is active and key is set
- [x] Provider pill selector in AI Panel for switching between Ollama / OpenAI / Anthropic / Google

### 16.4 Context & Cost Considerations 🟡 PARTIAL
- [x] Cloud providers use the same `contextBuilder.ts` pipeline as Ollama (char-based budget)
- [x] Per-model pricing data hardcoded in each provider for future cost display
- [ ] Show an estimated **token count** for the assembled prompt in the Prompt Preview modal so users can reason about cost
- [ ] Per-provider token limits enforced (e.g. 128K for GPT-4o, 200K for Claude); `contextBuilder` respects the active model's limit
- [ ] Optional: running session cost estimator in editor status bar (tokens used × known pricing)
