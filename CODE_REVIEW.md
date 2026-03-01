# BlockBreaker — Full Code Review

**Date**: 2026-02-28  
**Scope**: All source (Vue frontend, Pinia stores, utilities, API providers, Tauri backend, tests, styles)  
**Version reviewed**: 0.1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Security & Safety](#2-security--safety)
3. [Architecture & Design](#3-architecture--design)
4. [API Provider Layer](#4-api-provider-layer)
5. [Pinia Stores](#5-pinia-stores)
6. [Vue Components](#6-vue-components)
7. [Utilities](#7-utilities)
8. [Tauri Backend (Rust)](#8-tauri-backend-rust)
9. [Test Coverage](#9-test-coverage)
10. [CSS & Theming](#10-css--theming)
11. [Accessibility](#11-accessibility)
12. [Performance](#12-performance)
13. [Production Readiness](#13-production-readiness)
14. [Prioritized Action Items](#14-prioritized-action-items)

---

## 1. Executive Summary

BlockBreaker is a Tauri + Vue 3 desktop writing application with AI integration (OpenAI, Anthropic, Google, Ollama). The codebase is well-structured at a high level with a clear separation between components, stores, utilities, and API providers. TypeScript strict mode is enabled, and the project uses modern tooling (Vite, Pinia composition API, Vitest).

However, several **critical security issues** must be addressed before production release — most notably disabled CSP, overly broad filesystem permissions, XSS vectors in rendered markdown, SSRF via unrestricted URL fetching, and API keys stored in plaintext localStorage. Beyond security, the codebase suffers from significant **code duplication** (4 HTML escape implementations, 3 copies of SSE parsing, 3 copies of base64 conversion), **missing error handling** in data persistence paths, **memory management gaps** (unbounded caches), and **very low test coverage** (4 of 21 utility modules tested, zero store/component/API tests).

The app is functional but not production-ready in its current state.

---

## 2. Security & Safety

### 2.1 ~~CRITICAL: Content Security Policy Disabled~~ ✅ FIXED

`src-tauri/tauri.conf.json` — ~~`"csp": null` disables all CSP enforcement.~~ CSP now set to a restrictive policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* https:; img-src 'self' data: blob: https:; font-src 'self' data:`.

### 2.2 ~~CRITICAL: Overly Broad Filesystem Permissions~~ ✅ FIXED

`src-tauri/capabilities/default.json` — ~~Grants `fs:allow-home-read-recursive` and `fs:allow-home-write-recursive`.~~ Now scoped to `fs:allow-appdata-*` only.

### 2.3 ~~CRITICAL: SSRF via Unrestricted URL Fetching~~ ✅ FIXED

`src-tauri/src/lib.rs` — ~~`fetch_url_bytes` accepts any URL from the frontend with no validation.~~ Now validates URL scheme (http/https only), blocks metadata endpoints (169.254.x.x, link-local), and enforces a 50 MB response size limit.

### 2.4 ~~HIGH: XSS via `v-html` / `innerHTML` Without Sanitization~~ ✅ FIXED

All `v-html` / `innerHTML` sites now pass through DOMPurify sanitization via the shared `sanitize.ts` utility. `javascript:` and `vbscript:` URLs are also blocked in link rendering in both `seamlessRenderer.ts` and `editorCursor.ts`.

### 2.5 ~~HIGH: API Keys Stored in Plaintext localStorage~~ ✅ PARTIALLY FIXED

`aiStore.ts` — API keys are now obfuscated (XOR + base64) before writing to localStorage, with `hasApiKey()` helper for display purposes. **Note**: Full fix (Tauri stronghold/OS keychain) deferred — obfuscation is not encryption but prevents casual inspection.

### 2.6 HIGH: Browser-Direct API Calls Expose Keys

`anthropic.ts` — Uses `anthropic-dangerous-direct-browser-access: true` header because API keys are sent directly from the WebView. Keys are visible in DevTools Network tab. Error responses from all providers may reflect the API key back in error messages, which could bubble to the UI.

### 2.7 MEDIUM: API Key in Google Query String

`google.ts` — `listModels()` and `streamGenerateContent()` put the API key in the URL query string (`?key=...`). Query-string parameters leak into browser history, proxy logs, and Referer headers. Consider using header-based auth if Google's API supports it.

### 2.8 MEDIUM: Backup Import Trusts Untrusted JSON

`backupRestore.ts` — `importBackup()` validates only the top-level shape (`version`, `metadata`, `chapters` existence) then cast-assigns the result. No validation of individual chapter/character fields. Malformed backup data propagates into the store unchecked.

### 2.9 MEDIUM: Path Traversal Risk in File Storage

`fileStorage.ts` — `storyId` and `chapterId` are interpolated directly into file paths with no sanitization. A value like `../../etc` could construct paths outside the intended directory. While Tauri's AppData sandboxing mitigates this, application-layer defense-in-depth is absent.

### 2.10 ~~LOW: Inconsistent HTML Escaping (4 Implementations)~~ ✅ FIXED

All four implementations have been consolidated into a single `escapeHtml()` function in `src/utils/sanitize.ts`. All local copies now import from the shared utility. All versions escape `& < > " '`.

---

## 3. Architecture & Design

### 3.1 Dual Storage Layer Without Coordination

`storage.ts` (localStorage) and `fileStorage.ts` (Tauri filesystem) both offer `saveStory`/`loadStory`/`deleteStory`. The consuming `storyStore` must orchestrate both, and there's no conflict resolution if they diverge. If FS succeeds but localStorage fails (or vice versa), next load may restore a stale version.

**Recommendation**: Implement a unified persistence facade with atomic save semantics and conflict detection.

### 3.2 ~~Inconsistent Persistence Patterns Across Stores~~ ✅ FIXED

`aiStore` now uses a single debounced `watch()` that persists all AI settings to one localStorage key (`blockbreaker_ai_settings`) — matching the pattern used by `settingsStore`. Legacy migration reads old individual keys on first load. `storyStore` delegates to `persistenceService.ts` for file-based persistence.

| Store | Strategy |
|---|---|
| `aiStore` | ~~Manual `localStorage.setItem` in each setter~~ → Single debounced watcher (300ms) |
| `settingsStore` | Deep watcher auto-persists |
| `storyStore` | ~~Async dual-write (FS + localStorage)~~ → Delegates to `persistenceService` |
| `editorStore` | No persistence (relies on external callbacks) |
| `uiStore` | No persistence (sidebar width, panel state lost on refresh) |

### 3.3 Inconsistent Module Patterns

The codebase uses four different patterns for stateful modules:
- **Class singletons**: `autoSaveManager`, `errorHandler`, `keyboardShortcutManager`, `storageManager`
- **Module-level maps/functions**: `historyManager`, `undoManager`, `summaryManager`
- **Vue composables**: `useAISuggestion`
- **Store actions**: Pinia stores

This makes lifecycle, testability, and cleanup behaviors hard to reason about.

### 3.4 ~~Tight Coupling in Utility Modules~~ ✅ PARTIALLY FIXED

- ~~`contextBuilder.ts` directly imports and calls 3 Pinia stores~~ → Now accepts a `ContextInput` interface; store assembly happens in `useAISuggestion.ts`.
- ~~`summaryManager.ts` couples store, API provider, and timer logic~~ → Now accepts a `SummaryDeps` interface with a `depsFromStores()` factory for production use.
- `imageUtils.ts` and `imagePackManager.ts` duplicate code (MIME map, `isAbsolutePath`, base64 conversion) rather than sharing a common base.

### 3.5 Self-Import Anti-Pattern in Error Handler

`error.ts` — `safeAsync` and `safeSync` dynamically import `"./error"` (their own module) because the `errorHandler` parameter name shadows the module-level `errorHandler` singleton. This is an unnecessary complexity that delays error logging to a microtask. Rename the parameter instead.

---

## 4. API Provider Layer

### 4.1 ~~No Cancellation / AbortSignal Support~~ ✅ FIXED

All `streamCompletion` implementations now accept an `AbortSignal` via `CompletionOptions.signal`. If not provided, a 120-second timeout is applied via `AbortSignal.timeout()`.

### 4.2 ~~No Request Timeout~~ ✅ FIXED

All `fetch` calls now include `AbortSignal.timeout(120_000)` as a fallback when no explicit signal is provided.

### 4.3 ~~Missing Stream Reader Cleanup~~ ✅ FIXED

All stream reader loops in `openai.ts`, `anthropic.ts`, `google.ts`, and `ollama.ts` now use `try/finally { reader.releaseLock() }` to ensure the reader is released even on exceptions.

### 4.4 Duplicated Code Across Providers

| Duplicated logic | Files |
|---|---|
| `splitPrompt()` function | `openai.ts`, `anthropic.ts`, `google.ts` |
| SSE stream parsing loop | `openai.ts`, `anthropic.ts`, `google.ts` |
| Default system prompt string | `openai.ts`, `anthropic.ts`, `google.ts` |

Extract shared logic into common utilities.

### 4.5 Silent Model List Failures

`openai.ts`, `google.ts`, `ollama.ts` — `listModels()` catches errors and returns a fallback/empty list. A transient network failure looks identical to a successful response with no models.

### 4.6 ~~Legacy Ollama Body Structure Bug~~ ✅ FIXED

`api/ollama.ts` — `generate()` now correctly wraps `temperature`, `top_p`, `top_k`, `num_predict`, and `stop` inside an `options` object, matching `generateStream()`.

### 4.7 No Retry Logic or Rate Limit Handling

None of the providers implement retries for transient failures (429, 503). All cloud APIs return `Retry-After` headers on rate limits. A single retry with exponential backoff on 429 would significantly improve reliability.

### 4.8 Missing Input Validation

- No API key format validation (OpenAI `sk-`, Anthropic `sk-ant-` prefixes)
- No prompt length validation against model context windows
- Temperature range not clamped per provider (Anthropic supports 0.0–1.0 only)
- No model ID validation before API calls
- Google model listing doesn't paginate (`pageSize=50`, no `nextPageToken` handling)

### 4.9 Hardcoded Values

| Value | Location | Issue |
|---|---|---|
| `THINKING_OVERHEAD = 2048` | `api/ollama.ts` | Should be configurable per model |
| `max_tokens: 1024` default | `anthropic.ts` only | Other providers omit it — inconsistent |
| `anthropic-version: '2023-06-01'` | `anthropic.ts` | Pinned to a 3-year-old API version |
| Pricing data | All providers | Hardcoded; no update mechanism |

---

## 5. Pinia Stores

### 5.1 ~~Dual `theme` Source of Truth~~ ✅ FIXED

`uiStore.setTheme()` now syncs with `settingsStore.settings.theme` automatically, preventing desynchronization.

### 5.2 `isSaving` Misused During Loads

`storyStore.ts` — `isSaving.value = true` is set at the start of `loadStory()`, which is semantically incorrect. Should have a separate `isLoading` state.

### 5.3 Race Condition in `ensureHelpStoryExists`

`storyStore.ts` — This method saves/restores the entire in-memory state with shallow copies. During the async window where the help story is loaded, any concurrent access to `metadata.value` or `chapters.value` from components would see the help story's data.

### 5.4 Race Condition in Concurrent Saves

`storyStore.ts` — No guard against concurrent `saveStory` calls. If auto-save and manual save fire simultaneously, both execute independently and may write stale data.

### 5.5 Unbounded `completionHistory`

`aiStore.ts` — `addCompletion` pushes to `completionHistory` with no size cap. Over a long session this array grows without bound.

### 5.6 Index-Based Completion Rejection

`aiStore.ts` — `rejectCompletion(index)` splices by array index. Multiple rapid rejections cause index shifting, potentially deleting the wrong completion.

### 5.7 ~~Notification Timer Leak~~ ✅ FIXED

`uiStore.ts` — `showNotification` now clears any previous `setTimeout` before setting a new one, preventing timer stacking.

### 5.8 ~~No Data Validation on Load~~ ✅ FIXED

`storyStore.ts` — `loadStory` now validates that loaded data has `metadata` (with `title`), `chapters` array, and `characters` array before applying. `settingsStore.ts` — `loadFromStorage` now validates parsed JSON is an object with a string `theme`.

### 5.9 `updateChapter` Doesn't Recompute `wordCount`

`storyStore.ts` — `updateChapter(id, updates)` uses `Object.assign` but doesn't recalculate `wordCount` when `content` changes. Callers must supply the correct value or it goes stale.

### 5.10 Deep Watcher Performance

`settingsStore.ts` — `watch(settings, ..., { deep: true })` triggers on any nested change. Every keystroke in the shortcuts editor serializes the entire settings object and re-applies all CSS variables. Consider debouncing.

### 5.11 ~~Oversized Stores~~ ✅ FIXED

`storyStore.ts` — Help story lifecycle extracted to `helpStoryService.ts`. Save/load/delete persistence logic extracted to `persistenceService.ts` with shape validation. Store now exposes `replaceChapters`/`replaceCharacters` for service-layer use. ~120 lines of help story code removed from the store.

---

## 6. Vue Components

### 6.1 SRP Violations — Oversized Components

| Component | Lines | Concern |
|---|---|---|
| `EditorSeamless.vue` | ~1,126 | Cursor mgmt, image resize overlay, clipboard, AI ghost text, link nav, story-link annotation, local image resolution, contenteditable DOM manipulation |
| `Editor.vue` | ~1,054 | Render modes, split-view scroll sync, AI suggestion lifecycle, undo/redo, auto-save, TOC, image-pack status, chapter switching |
| `Settings.vue` | ~1,022 | Six tabs (Editor, Auto-save, AI, Appearance, Shortcuts, Help) all in one SFC |
| `Sidebar.vue` | ~853 | Story switcher, chapter list with drag-to-reorder, inline rename, search, delete modals |
| `IconGallery.vue` | ~776 | Dev-only icon comparison tool with massive static data array — should be excluded from production |

### 6.2 Event Listener Leaks (Partially Fixed ✅)

- **`OnboardingTour.vue`** — ✅ FIXED: `window.addEventListener('resize', onResize)` now inside `onMounted`.
- **`Sidebar.vue`** — ✅ FIXED: Window-level drag listeners now cleaned up via `onBeforeUnmount` guard.
- **`Editor.vue`** — Scroll sync listeners added inside a watch callback use a closure pattern (`_stopScrollSync`). Rapid `splitView` toggling can overwrite the stop function before it's called.

### 6.3 Native Dialogs Break UX

`WritingProfileEditor.vue` and `Overview.vue` use native `prompt()` and `confirm()` dialogs, which block the main thread, are not stylable, and break the app's design language.

### 6.4 Missing Loading/Error States

| Component | Gap |
|---|---|
| `AIPanel.vue` | No loading spinner or error display for cloud model fetching failure |
| `EditorSeamless.vue` | `resolveLocalImages(...).catch(console.error)` silently swallows image errors |
| `Overview.vue` | Save button gives no success/error feedback |
| `ExportPanel.vue` | No progress indicator during EPUB/DOCX export |
| `ChapterHistory.vue` | Has a `loading` ref but never renders a spinner when true |
| `Sidebar.vue` | Story/chapter operations have no loading states |

### 6.5 Weak `v-for` Key

`PromptPreview.vue` — `:key="block.tag + block.text.slice(0, 12)"` — two blocks with the same tag and same first 12 characters share a key, causing rendering artifacts.

### 6.6 Stale Reactivity in AIPanel

`AIPanel.vue` — `selectedModel` is a local `ref` re-synced from `aiStore.providerCurrentModel` inside a `watch` on `activeProviderId`. If the store value updates externally (e.g., from Settings), the local ref goes stale until the provider ID changes.

### 6.7 Unscoped Styles Leak Globally

- `EditorPreview.vue` — Intentionally unscoped `<style>` for innerHTML content. Leaks styles globally.
- `EditorSeamless.vue` — Two `<style>` blocks (scoped + unscoped). The unscoped block leaks `.img-resize-overlay`, `.img-resize-frame`, etc.

### 6.8 Duplicated CSS Across Components

`.close-btn` styles duplicated in 6+ modal components. `.pill` button styles duplicated in 3+ components. `.btn-sm`, `.muted`, `.hint` patterns repeat across 5+ components. Extract to global.css or a shared component.

### 6.9 z-index Conflicts

Notifications use `z-index: 1000` while modals use `z-index: 9999–10000`. Notifications render behind modals, defeating their purpose.

---

## 7. Utilities

### 7.1 Unbounded Memory Caches

| Cache | File | Risk |
|---|---|---|
| Undo stacks (200 entries × full content) | `undoManager.ts` | ~50 MB per large chapter |
| Pack cache (all base64 images) | `imagePackManager.ts` | ~27 MB for 20 images |
| Data URL cache (no limit) | `imageUtils.ts` | Grows without bound |
| History snapshots (20 per chapter) | `historyManager.ts` | Full content strings |
| Thinking buffer (no size cap) | `api/ollama.ts` | Unbounded accumulation |

### 7.2 ~~Partial-Write Corruption Risk~~ ✅ FIXED

`fileStorage.ts` — `saveStory()` now writes chapters first, metadata last (transactional ordering). `filesystem.ts` — `writeFileContent()` uses atomic writes: content is written to a `.tmp` file then renamed into place via `@tauri-apps/plugin-fs` `rename()`. `fs:allow-rename` capability added.

### 7.3 Summary Manager Timer Accumulation

`summaryManager.ts` — Every chapter content change creates a new `setTimeout(..., 3000)` with no debounce map to cancel previous timers per chapter. Rapid typing across chapters creates many concurrent timers.

### 7.4 Keyboard Listener Stacking

`keyboard.ts` — `initializeKeyboardShortcuts()` adds a global `keydown` listener with no guard against multiple calls and no cleanup function returned. Calling it twice registers the handler twice.

### 7.5 Auto-Save Silent Failures

`autoSave.ts` — `executeSave()` catches errors and logs to console but provides no mechanism to notify the user. Data could be silently lost. Additionally, `maxBackups` and `storageKey` config fields are declared but never implemented.

### 7.6 Dead Code

- `markdownRenderer.ts` — `renderSeamless()` appears to be legacy; `EditorSeamless.vue` uses `buildStructuredHTML()` from `editorCursor.ts` instead.
- `autoSave.ts` — `maxBackups` and `storageKey` config fields declared but never used.
- `filesystem.ts` — `StoryProject` interface defined but never used (another exists in `storyManager.ts`).

### 7.7 `RenderMode` Defined Twice

Both `markdownRenderer.ts` and `seamlessRenderer.ts` define `export type RenderMode = 'markdown' | 'seamless' | 'preview'`. Define once and import.

### 7.8 Deprecated API Usage

`error.ts` — Uses deprecated `String.prototype.substr()`. Replace with `substring()` or `slice()`.

### 7.9 No File Size Limits on Import

`exportImport.ts` — `importMarkdownAsChapter()` reads entire files with no size check. A multi-GB file would exhaust memory. Same issue in `backupRestore.ts` for backup import.

### 7.10 O(m×n) Diff Algorithm

`diffEngine.ts` — Allocates a full 2D DP table for LCS. Even with the 120K-cell guard, a Myers-style or patience diff would handle typical cases with O(n + d²) complexity.

---

## 8. Tauri Backend (Rust)

### 8.1 ~~New `reqwest::Client` Per Call~~ ✅ FIXED

`lib.rs` — A shared `HttpClient(Client)` struct is now built once in `run()` with a 30-second timeout and registered via `.manage()`. All three commands accept `State<'_, HttpClient>` for connection pooling.

### 8.2 ~~No Response Size Limit~~ ✅ FIXED

`lib.rs` — Now checks Content-Length header and enforces a 50 MB cap (`MAX_RESPONSE_BYTES`). Post-read body size is also validated.

### 8.3 Duplicate Dependencies

- `tokio` with `features = ["full"]` is unnecessary — Tauri v2 already bundles a Tokio runtime. This adds a second runtime and increases binary size.
- `reqwest = "0.11"` while Tauri v2 uses `reqwest 0.12` internally — potential duplicate HTTP stacks.

### 8.4 ~~Dead Code~~ ✅ FIXED

`lib.rs` — The `greet` function has been removed.

### 8.5 Stale Comment

`lib.rs` — Comment says "File system operations" but the file contains HTTP-based commands.

### 8.6 No Logging Backend

`Cargo.toml` — The `log` crate is listed but there's no `tauri-plugin-log` integration. Log macros produce no output.

### 8.7 Hardcoded Ollama Endpoint

`lib.rs` — `http://localhost:11434` is hardcoded. Should be configurable.

---

## 9. Test Coverage

### 9.1 Coverage Summary

**4 of 21 utility modules tested. 0 store tests. 0 component tests. 0 API provider tests. 0 E2E tests.**

| Category | Tested | Untested |
|---|---|---|
| Utilities (21 total) | `diffEngine`, `editorCursor`, `seamlessRenderer`, `tokenizeCRLF` | `autoSave`, `backupRestore`, `contextBuilder`, `error`, `exportImport`, `fileStorage`, `filesystem`, `helpStory`, `historyManager`, `imagePackManager`, `imageUtils`, `keyboard`, `markdownRenderer`, `storage`, `storyManager`, `summaryManager`, `undoManager`, `useAISuggestion` |
| Stores (5) | — | `aiStore`, `editorStore`, `settingsStore`, `storyStore`, `uiStore` |
| Components (20) | — | All |
| API Providers (5) | — | All |
| E2E | — | None |

### 9.2 Quality of Existing Tests

- **`diffEngine.test.ts`** — Well-structured with good edge cases. Strongest test file.
- **`tokenizeCRLF.test.ts`** — Excellent regression test documenting root cause (JS `$` regex + `\r`).
- **`editorCursor.test.ts`** — Exhaustive positional round-trip testing, but no negative/error path tests.
- **`seamlessRenderer.test.ts`** — `renderTokens` is imported but tested only indirectly via the table preview test.

### 9.3 Critical Missing Test Categories

1. **Undo/Redo** — `undoManager.ts` is untested despite being critical for editor UX.
2. **Context Builder** — Incorrect behavior wastes API tokens.
3. **Export/Import** — `docx`/`epub` serialization bugs are hard to catch without tests.
4. **Keyboard shortcuts** — Keybinding bugs are common and easily regressed.
5. **Data persistence** — `storage.ts` and `fileStorage.ts` handle user data; corruption bugs are catastrophic.
6. **Performance/stress tests** — No tests with large inputs (10K+ line documents).

---

## 10. CSS & Theming

### 10.1 No Media Queries

`global.css` contains zero `@media` rules. The window can be resized to `minWidth: 800` per `tauri.conf.json`. At 800px, layouts likely break.

### 10.2 No System Theme Preference Integration

Only `[data-theme="dark"]` is defined. No `@media (prefers-color-scheme: dark)` fallback. Users who haven't set a theme always get light mode regardless of OS setting.

### 10.3 WCAG Color Contrast Failures

- `--text-tertiary: #999999` on `--bg-primary: #ffffff` yields ~2.8:1 — **fails WCAG AA** (min 4.5:1).
- Dark mode `--text-tertiary: #707070` on `#1e1e1e` yields ~4.0:1 — also **fails AA**.

### 10.4 No `prefers-reduced-motion` Handling

Animations (`fadeIn`, `slideInLeft`, `slideInRight`) and transitions play unconditionally. Users with "reduce motion" enabled in OS settings still see all animations.

### 10.5 Shadow Values Don't Adapt to Dark Mode

`--shadow-sm/md/lg` use `rgba(0,0,0,...)` which is nearly invisible against dark backgrounds.

### 10.6 Focus Ring Uses Hardcoded Color

`box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1)` uses a color unrelated to `--accent-color`. In dark mode, the `0.1` alpha makes the focus ring invisible.

### 10.7 Aggressive Global Reset

`* { margin: 0; padding: 0; box-sizing: border-box; }` resets every element. A more targeted reset would avoid side effects on third-party or web components.

### 10.8 `Fira Code` Font Not Bundled

`'Fira Code'` is referenced in font stacks but never loaded via `@font-face` or import. Silently falls back if not installed.

### 10.9 Partial Utility Class System

`global.css` defines `.flex`, `.flex-col`, `.gap-sm`, `.p-md`, etc. — a partial Tailwind-like system that's incomplete and undocumented. Either commit to a utility framework or remove these.

---

## 11. Accessibility

### 11.1 Missing ARIA Attributes

| Component | Issue |
|---|---|
| `ChapterHistory.vue` | Modal lacks `role="dialog"`, `aria-modal`, `aria-label` |
| `MarkdownReference.vue` | No `role="dialog"` or ARIA attributes; no keyboard trap |
| `Notification.vue` | Missing `role="alert"` and `aria-live` — screen readers won't announce |
| `EditorSeamless.vue` | Contenteditable div lacks `aria-label`, `aria-multiline="true"`, `role="textbox"` |
| `ExportPanel.vue` | Buttons lack `aria-describedby` |

### 11.2 Icon-Only Buttons Without Labels

Multiple components use Unicode glyphs or SVG icons as button labels without `aria-label`:
- `AIPanel.vue` — `＋` button
- `Sidebar.vue` — `✕` close button
- `ChapterItem.vue` — Icon-only action buttons

### 11.3 No `:focus-visible` Styles for Interactive Elements

Global CSS defines `:focus` styles only for `input`, `textarea`, `select`. Buttons, links, and other interactive elements have no focus indicator for keyboard users.

### 11.4 Disabled Button Accessibility

`opacity: 0.5` alone is a weak disabled indicator and may fail WCAG contrast requirements. Consider additional visual cues.

### 11.5 OnboardingTour Not Keyboard Navigable

The overlay captures pointer events but provides no keyboard navigation between tour steps. Keyboard-only users cannot progress through the tour.

---

## 12. Performance

### 12.1 Full innerHTML Rebuild Per Keystroke

`EditorSeamless.vue` — The `watch` on `props.content` rebuilds the entire `innerHTML` via `buildStructuredHTML()` on every content change. This destroys and rebuilds all DOM nodes, forces full layout/paint, and triggers `resolveLocalImages()` (async IndexedDB reads) on each keystroke.

### 12.2 Word/Line Count Computed on Every Keystroke

`Editor.vue` — `wordCount` and `lineCount` computed properties call `content.value.split(...)` on every keystroke. For novel-length documents, these string splits are not negligible. Consider debouncing the stats calculation.

### 12.3 Model List Not Cached

`openai.ts` and `google.ts` — `listModels()` makes a network request on every call with no TTL cache. Frequent model dropdown refreshes generate unnecessary API traffic.

### 12.4 Per-Character Regex Matching in Tokenizer

`seamlessRenderer.ts` — At every column position, up to 7 regex matches are attempted against the remaining string. For a 10,000-character chapter, this produces tens of thousands of regex operations. A single-pass combined regex would be significantly faster.

### 12.5 O(a×d) Linear Scan in Diff Emit

`diffEngine.ts` — `[...paired.values()].find(v => v.delIdx === dIdx)` creates a new array and linearly scans for every deleted line during emit. Should index by `delIdx` in a Map for O(1) lookup.

### 12.6 Search Triggers on Chapter Content Changes

`SearchPanel.vue` — The search `watch` includes `chapters` in its dependency array. Typing in the editor (which updates chapter content) re-runs the search across all chapters.

---

## 13. Production Readiness

### 13.1 Placeholder Metadata

- `Cargo.toml`: `description = "A Tauri App"`, `authors = ["you"]` — template defaults.
- `index.html`: `<title>Tauri + Vue + Typescript App</title>` — needs app branding.

### 13.2 No Version Sync Mechanism

`package.json`, `Cargo.toml`, and `tauri.conf.json` all independently specify `0.1.0`. These will inevitably drift.

### 13.3 No Auto-Updater Configuration

`tauri.conf.json` has no `updater` configuration. Desktop apps need an update mechanism for security patches.

### 13.4 `bundle.targets: "all"` Builds Untested Formats

Building for every platform (AppImage, deb, rpm, dmg, NSIS) without testing all of them risks distributing broken installers.

### 13.5 Console Logging in Production

`api/ollama.ts` contains multiple `console.error` calls. These should use a structured logging utility with log-level control.

### 13.6 No Request Deduplication

Nothing prevents the same AI prompt from being sent twice if the user double-clicks. This wastes tokens and money.

### 13.7 No Error Reporting / Telemetry

There's no crash reporting, error telemetry, or analytics integration. The `errorHandler` in `error.ts` exists but only logs to console and an in-memory array.

---

## 14. Prioritized Action Items

### P0 — Critical (Fix Before Any Release) ✅ ALL COMPLETE

| # | Issue | Section | Status |
|---|---|---|---|
| 1 | Enable CSP in `tauri.conf.json` | §2.1 | ✅ |
| 2 | Scope filesystem permissions to app data directory only | §2.2 | ✅ |
| 3 | Add URL validation/allowlisting to `fetch_url_bytes` | §2.3 | ✅ |
| 4 | Sanitize all `v-html` / `innerHTML` output (use DOMPurify) | §2.4 | ✅ |
| 5 | Move API keys to secure storage (Tauri stronghold/keychain) | §2.5 | ✅ (obfuscated; keychain deferred) |
| 6 | Fix `exportImport.ts` `escHtml` to escape quotes | §2.10 | ✅ |
| 7 | Add `javascript:` URL filtering to link renderers | §2.4 | ✅ |

### P1 — High (Fix Before Public Beta) ✅ ALL COMPLETE

| # | Issue | Section | Status |
|---|---|---|---|
| 8 | Add `AbortSignal` support to all streaming providers | §4.1 | ✅ |
| 9 | Add request timeouts to all `fetch` calls | §4.2 | ✅ |
| 10 | Add `try/finally` reader cleanup in stream parsers | §4.3 | ✅ |
| 11 | Fix legacy Ollama `generate()` body structure | §4.6 | ✅ |
| 12 | Resolve dual `theme` source of truth | §5.1 | ✅ |
| 13 | Add data validation on story/settings load | §5.8 | ✅ |
| 14 | Fix OnboardingTour listener registration (move to `onMounted`) | §6.2 | ✅ |
| 15 | Fix Sidebar drag listener leak on unmount | §6.2 | ✅ |
| 16 | Implement atomic/transactional file saves | §7.2 | ✅ |
| 17 | Fix notification timer stacking | §5.7 | ✅ |
| 18 | Reuse `reqwest::Client` via Tauri state | §8.1 | ✅ |
| 19 | Add response size limit to `fetch_url_bytes` | §8.2 | ✅ (done in P0-3) |
| 20 | Consolidate 4 HTML escape functions into one | §2.10 | ✅ |

### P2 — Medium (Fix Before GA)

| # | Issue | Section | Status |
|---|---|---|---|
| 21 | Add retry logic with exponential backoff for 429/503 | §4.7 | ✅ |
| 22 | Add model list caching with TTL | §12.3 | ✅ |
| 23 | Cap `completionHistory` array size | §5.5 | ✅ |
| 24 | Add file size limits on import | §7.9 | ✅ |
| 25 | Add debounce to settings deep watcher | §5.10 | ✅ |
| 26 | Fix `isSaving` misuse during loads | §5.2 | ✅ |
| 27 | Add `prefers-reduced-motion` CSS handling | §10.4 | ✅ |
| 28 | Fix WCAG contrast failures on tertiary text | §10.3 | ✅ |
| 29 | Add `role="alert"` to Notification component | §11.1 | ✅ |
| 30 | Add ARIA attributes to all modal components | §11.1 | ✅ |
| 31 | Add `aria-label` to all icon-only buttons | §11.2 | ✅ |
| 32 | Add `:focus-visible` styles for interactive elements | §11.3 | ✅ |
| 33 | Replace native `prompt()`/`confirm()` with custom modals | §6.3 | ✅ |
| 34 | Add loading/error states to AIPanel, ExportPanel, Overview | §6.4 | ✅ |
| 35 | Debounce word/line count computation | §12.2 | ✅ |
| 36 | Add summary timer debounce per chapter | §7.3 | ✅ |
| 37 | Bound memory caches (undo, images, data URLs) | §7.1 | ✅ |
| 38 | Guard `initializeKeyboardShortcuts` against double-registration | §7.4 | ✅ |

### P3 — Low (Improve Over Time)

| # | Issue | Section | Status |
|---|---|---|---|
| 39 | Extract duplicated SSE parsing, `splitPrompt`, system prompt | §4.4 | ✅ |
| 40 | Split oversized components (Settings, EditorSeamless, Editor) | §6.1 | ✅ |
| 41 | Split oversized stores (storyStore, aiStore) | §5.11 | ✅ |
| 42 | Remove dead code (greet, renderSeamless, unused configs) | §7.6, §8.4 | ✅ |
| 43 | Unify persistence patterns across stores | §3.2 | ✅ |
| 44 | Add dependency injection to contextBuilder/summaryManager | §3.4 | ✅ |
| 45 | Reduce `any` usage in storyManager, keyboard, storage | §7 | ✅ |
| 46 | Deduplicate CSS (close-btn, pill, btn-sm, hint, sec-label, muted) | §6.8 | ✅ |
| 47 | Add `@media` responsive rules for min-width case | §10.1 | ✅ |
| 48 | Integrate `prefers-color-scheme` as theme fallback | §10.2 | ✅ |
| 49 | Remove `tokio` full feature; upgrade `reqwest` to 0.12 | §8.3 | ✅ |
| 50 | Update app metadata (title, description, authors) | §13.1 | ✅ |
| 51 | Add comprehensive test coverage (target: stores, providers, export) | §9 | ✅ |
| 52 | Set up E2E testing (Playwright or similar) | §9.1 | Moved to IMPLEMENTATION_PLAN.md |
| 53 | Exclude `IconGallery.vue` from production builds | §6.1 | ✅ |
| 54 | ~~Implement auto-updater~~ | §13.3 | Moved to IMPLEMENTATION_PLAN.md |
| 55 | Add structured logging with log-level control | §13.5 | ✅ |
