# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Glyph Astra is a desktop AI-assisted creative writing app: Vue 3 (Composition API) + Pinia + TypeScript frontend, Tauri 2 (Rust) shell.

## Commands

```bash
npm run dev            # Vite dev server only (browser, port 1420 strict) — Tauri APIs unavailable
npm run dev:tauri      # Full desktop app
npm run build          # vue-tsc --noEmit + vite build (this is the type check)
npm run tauri build    # Packaged app -> src-tauri/target/release/bundle/

npm test                                        # Unit tests (Vitest, jsdom); excludes *.integration.test.ts
npx vitest run src/__tests__/diffEngine.test.ts # Single file
npx vitest run -t "name pattern"                # Single test by name
npm run test:bundle     # Build, then bundleSafety.test.ts against dist/
npm run test:integration  # Requires a live Ollama at localhost:11434; node env, sequential, 360s timeout
```

No ESLint/Prettier config and no Rust tests. CI (`.github/workflows/ci.yml`) runs `npm test` and `npm run test:bundle` on push/PR to `master`; `release.yml` builds Windows/macOS (x64 + arm64)/Linux installers on `v*` tags into a draft release.

## Architecture

**Frontend does almost everything.** The Rust side (`src-tauri/src/lib.rs`) only registers plugins (fs, dialog, updater, process, log, opener) and three commands: `check_ollama_connection`, `list_ollama_models`, and `fetch_url_bytes` (CORS-free image download used by image packing). Story file I/O is done from TypeScript via `@tauri-apps/plugin-fs`, scoped to the app data dir in `src-tauri/capabilities/default.json`.

**Persistence** (`src/utils/storage/`): `persistenceService.ts` is the facade — it writes each story to the filesystem (primary, via `fileStorage.ts`/`filesystem.ts`) and to localStorage (backup, via `storage.ts`) in parallel, succeeding if either works. On startup `App.vue` reconciles filesystem story folders with the localStorage index, then loads the last-open story. On-disk layout per story: `story.json`, `chapters/{id}.md`, `history/{id}.json`, optional `images.pack.json`. Settings and AI config live only in localStorage.

**Stores** (`src/stores/`): `storyStore` (stories/chapters/characters), `editorStore`, `settingsStore`, `aiStore` (writing profiles, active provider, model, API keys — obfuscated, not encrypted, in localStorage), `uiStore`.

**AI providers** (`src/api/providers/`): all implement `ModelProvider` in `types.ts` (`isAvailable`, `listModels`, `streamCompletion`); `makeProvider(providerId, keys, ollamaBaseUrl?)` in `index.ts` is the factory. Provider ids: `ollama | openai | anthropic | google`. Cloud providers stream via `fetch` directly from the webview; Ollama uses Rust `invoke` for non-streaming calls when running under Tauri. Shared SSE/helpers are in `shared.ts`.

**AI pipeline** (`src/utils/ai/`): `contextBuilder.ts` assembles the token-budgeted prompt (story metadata, writing profile, plot outline, chapter summaries, surrounding prose); `summaryManager.ts` generates/caches chapter summaries in the background; `useAISuggestion.ts` drives inline ghost-text suggestions.

**Editor** (`src/utils/editor/`): `seamlessRenderer.ts` is the hybrid WYSIWYG mode; `markdownRenderer.ts` for preview; `diffEngine.ts` for version-history diffs; `undoManager.ts` for the session-persistent undo stack. Rendered HTML goes through `src/utils/sanitize.ts` (DOMPurify).

## Constraints

- **CSP** in `src-tauri/tauri.conf.json` is `script-src 'self'` — no `eval`/`new Function` in shipped code, including from dependencies. `bundleSafety.test.ts` enforces this on the built bundle; run `npm run test:bundle` after adding dependencies.
- **Version bumps** must update both `package.json` and `src-tauri/Cargo.toml` (`tauri.conf.json` reads from `package.json`). Full release process: `docs/VERSION_BUMP.md`.
- Planning docs live in `docs/` (`IMPLEMENTATION_PLAN.md` indexes phase files in `docs/phases/`; `CODE_REVIEW.md` lists known issues). The root-level files of the same names are just redirects. `test.md` at the root is a markdown rendering fixture, not docs.
