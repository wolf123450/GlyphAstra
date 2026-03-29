# Phase 19: Bug Fixes & UI Polish ✅ Complete

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

Tracked issues from the post-code-review pass (2026-03-03).

### 19.1 Preview Mode Paragraph Rendering (Bug) ✅ COMPLETE
- [x] Root cause: plain text paragraphs produced no tokens during the line-by-line scan, so `mergeAndValidateTokens` merged the entire multi-paragraph block into one big `text` token (e.g. `"Para one.\n\nPara two."`). In `renderPreview` that token wasn't whitespace-only so the `\n\n` separator check never triggered — everything ended up in a single `<p>`.
- [x] Fix (`seamlessRenderer.ts` → `renderPreview`): added a new branch handling non-whitespace `text` tokens that contain `\n\n` — splits on `/\n{2,}/`, flushes the current `<p>` between segments, and normalises single newlines within a segment to spaces (standard Markdown behaviour).
- [x] 5 new regression tests added to `seamlessRenderer.test.ts` (330 total, all passing).

### 19.2 Active Model Display in Editor Status Bar ✅ COMPLETE
- [x] Status bar chip shows the active AI model name from `aiStore.currentModel`; org prefix (e.g. `anthropic/`) is stripped for brevity
- [x] Clicking the chip calls `toggleAI()` to open the AI panel for quick model switching
- [x] Uses `mdiRobotOutline` icon; styled as `.status-model-btn` (matches the history/summary button style) with `max-width: 160px` + ellipsis overflow
- [x] Hidden when no model is configured (`v-if="activeModelLabel"`)

### 19.3 Custom Title Bar (Tauri Decorations) ✅ COMPLETE
- [x] `tauri.conf.json` — added `"decorations": false` to the window config
- [x] `capabilities/default.json` — added `core:window:allow-minimize`, `allow-toggle-maximize`, `allow-close`, `allow-is-maximized`, `allow-start-dragging`
- [x] `TitleBar.vue` — thin 32px bar with:
  - Full-width `data-tauri-drag-region` for window movement
  - App name "Glyph Astra" on the left
  - Minimize / maximize-or-restore / close buttons on the right (Windows-style, 46px hit targets)
  - Close button turns red on hover (`#c42b1c`)
  - `isMaximized` state tracked via `appWindow.onResized()` listener
  - Lazy-loaded Tauri API (`import('@tauri-apps/api/window')`) so the component safely no-ops in browser dev mode
  - `visible` guard: only renders when `__TAURI_INTERNALS__` is present in `window`
- [x] `App.vue` — `<TitleBar />` added as first element; `app-container` changed from `height: 100%` to `flex: 1; min-height: 0` (filling the remaining column height under `#app` flex column)
- [x] `global.css` — `--titlebar-height: 32px` CSS variable added for use by other layout components

### 19.4 Resizable Panes (Sidebar / Editor / Side Panels) ✅ COMPLETE
- [x] `usePaneResize.ts` composable — wraps mousedown → mousemove → mouseup; updates a CSS custom property on `:root` and persists to localStorage on mouseup; disables text selection during drag
- [x] Two drag handles added to `App.vue` between Sidebar/Editor and Editor/right-panel
  - Left handle: visible when sidebar is expanded; resizes `--sidebar-width` (min 160px, max 400px)
  - Right handle: visible when any right panel (Overview/AI/Export) is open; resizes `--right-panel-width` (min 220px, max 520px)
  - Handles are 5px transparent strips that turn accent-colored on hover/drag
- [x] Overview, AIPanel, ExportPanel all converted to use unified `--right-panel-width` CSS variable (was three separate vars)
- [x] `global.css` — added `--right-panel-width: 300px` default
- [x] Widths restored from localStorage on `App.vue` mount via `restoreWidth()`
- [x] Sidebar constraints: min 160px, max 400px; right panel: min 220px, max 520px

### 19.5 Drop Cap (Multi-Line Capital First Letter) ✅ COMPLETE
- [x] Added `dropCap: boolean` (default `false`) to `UserSettings` interface and `defaultSettings` in `settingsStore.ts`
- [x] `applyCSSVars()` toggles `body.drop-cap` class on every settings change
- [x] CSS in `global.css`: `body.drop-cap .editor-preview > p:first-child::first-letter` — `float: left`, `font-size: 3.6em`, `line-height: 0.85`, bold, `var(--accent-color)`
- [x] Toggle added to **Settings → Editor** tab: "Drop cap" On/Off pill-group with a hint line
- [x] Applies in preview mode and the preview side of split view; seamless/markdown editing modes are intentionally excluded (float breaks cursor positioning in contenteditable)

### 19.6 Minimal Border / Divider Restyle ✅ COMPLETE
- [x] Removed `border-right: 1px solid var(--border-color)` from `.sidebar` (Sidebar.vue) and `.editor-panel` (Editor.vue)
- [x] Removed `border-left: 1px solid var(--border-color)` from `.ai-panel`, `.export-panel`, `.overview-panel`
- [x] Added `.pane-divider::after` pseudo-element in App.vue — `width: 1px; height: 50%; background: var(--border-color)` centred on the boundary — replaces all five removed full-height border lines with a single short decorative line per pane boundary
- [x] The decorative line only appears when the divider is rendered (sidebar open for left divider; right panel open for right divider), so no orphan borders when panes are collapsed
- [x] The drag-handle pill (`.divider-handle::before`) sits in front of the accent line via natural stacking; on hover it grows and turns accent-colored as before

### 19.7 Active Sidebar Icon Highlighting ✅ COMPLETE
- [x] **Editor header — Overview / AI / Export buttons**: buttons already had `:class="{ active: isOverviewOpen/isAIOpen/isExportOpen }"` bindings; added `.action-btn.active` CSS rule (accent background, white icon, matching `.mode-btn.active`) so the active state is now visible
- [x] **Sidebar footer — Settings button**: added `:class="{ active: uiStore.showSettings }"` binding; added `.btn-icon.active` CSS rule (same accent-fill treatment as hover) so the cog icon lights up while the Settings panel is open
- [x] Theme-toggle and Help buttons intentionally left without active state — they are actions, not panel toggles

### 19.8 Seamless Mode Inline Source Leak on Lists ✅ COMPLETE
- [x] When the cursor enters a list item (ordered or unordered) in seamless mode, the **entire** list item's raw source was revealed. Now only the specific element at the cursor position toggles to source:
  - Cursor in the **marker region** (`- `, `1. `, etc.) → outer span shows source (marker visible, list bullet suppressed); text content renders fully
  - Cursor **on an inline span** (bold, italic, etc.) in the text → only that inner span shows source; outer span stays rendered with its bullet
  - Cursor on **plain text** in the content → nothing shows as source; everything renders
  - Same behaviour for headers (`## `, styled as source only when cursor on the `#` prefix) and blockquotes (`> `)
- [x] Root cause: `updateTokenVisibility` in `editorCursor.ts` toggled the entire outer block span to `.source` whenever cursor was anywhere in `[data-start, data-end]`. Inline spans inside block content (produced by `renderInlineContent`) had no `data-start`/`data-end` attrs so they couldn't be toggled individually.
- [x] Fix (all in `editorCursor.ts`):
  1. **`renderInlineContent(rawText, offset)`** — refactored from regex-split to scanning loop; now emits `data-start`/`data-end` on every inline token span so `querySelectorAll('[data-start]')` finds them
  2. **`buildStructuredHTML`** — adds `data-text-start` attribute to `listItem`, `orderedList`, `header`, and `blockquote` spans (= absolute position where the text content begins, after the marker); passes the correct offset to `renderInlineContent`
  3. **`updateTokenVisibility`** — for spans with `data-text-start`: shows `.source` on outer span only if `cursorPos < textStart` (marker region); otherwise keeps outer as `.rendered` and lets inner inline spans toggle themselves

### 19.9 Formatting Toolbar (Expandable Styling Bar) ✅
- [x] Add a collapsible/expandable toolbar above the editor area with quick-insert buttons for common Markdown formatting:
  - **Bold** (`**…**`), *Italic* (`*…*`), ~~Strikethrough~~ (`~~…~~`), `Code` (`` `…` ``), [Link] (`[text](url)`), Heading (`# `, `## `, `### `), Blockquote (`> `), Unordered list (`- `), Ordered list (`1. `), Horizontal rule (`---`), Image (`![alt](url)`)
- [x] Behaviour should be **cursor- and selection-aware**:
  - With a selection: wrap the selected text in the appropriate syntax (e.g. select "hello" → click Bold → `**hello**`)
  - Without a selection: insert a placeholder snippet (e.g. `**bold text**`) with the inner text pre-selected for immediate typing
  - For block-level items (heading, quote, list): insert at the start of the current line, or wrap selected lines
- [x] Toolbar is collapsed by default; toggle via a toolbar button in the editor header (highlights when open, same pattern as sidebar panels)
- [x] Persist collapsed/expanded state in `settingsStore`
- [x] Toolbar should be visible in seamless and markdown modes; hidden in preview mode
- [x] Use the same keyboard shortcut bindings already registered (Ctrl+B, Ctrl+I, etc.) — toolbar buttons are a visual companion to those shortcuts, with tooltips showing the shortcut

### 19.10 VS Code Extension Feasibility (Long-Term / Research)
- [ ] **Research phase only** — evaluate whether the seamless Markdown editor can be extracted into a standalone VS Code extension
- [ ] Key questions to answer:
  - VS Code extensions use the VS Code API (TypeScript); the editor itself is Monaco-based. Our seamless renderer is Vue.js + contenteditable — can it run inside a VS Code WebviewPanel?
  - A Webview extension *can* embed arbitrary HTML/CSS/JS (including Vue), so framework isn't a blocker — but it would be a separate build target, not a rewrite
  - What subset of functionality makes sense? (Just the seamless WYSIWYG rendering, or also AI suggestions, story management, etc.?)
  - Are there existing VS Code Markdown WYSIWYG extensions we'd compete with? (Markdown All in One, Foam, etc.)
- [ ] **Decision gate:** only proceed if the Webview approach works and there's clear user demand; otherwise park this idea
- [ ] If pursued: create a `vscode-extension/` workspace folder with its own `package.json`, build pipeline, and a shared import of `seamlessRenderer.ts` + rendering utilities

### 19.11 Context Menu Rework ✅ COMPLETE

#### 19.11.1 Suppress Default Context Menu ✅
- [x] Global `contextmenu` listener in `App.vue` `onMounted`; always calls `preventDefault()` in `import.meta.env.PROD && isTauri` builds
- [x] Custom menu also suppresses default when it has items (dev mode included)
- [x] Guard: does not suppress when `__TAURI_INTERNALS__` is absent (browser dev mode keeps inspect)

#### 19.11.2 Reset Pane Widths via Handle Right-Click ✅
- [x] `usePaneResize` now exports `resetWidth()` — removes localStorage entry + removes CSS var (reverts to `:root` default)
- [x] Handle divs in `App.vue` have `data-divider="sidebar"` / `data-divider="panel"` attributes
- [x] Resolver detects `.divider-handle` target and returns "Reset to default width" item

#### 19.11.3 Custom Context Menu Component ✅
- [x] `src/components/ContextMenu.vue` — teleported, absolutely-positioned, themed
- [x] Item types: **Action** (label + optional shortcut + callback + optional danger flag), **Separator**, **Disabled** (header label)
- [x] Closes on click outside (pointerdown capture) or Escape
- [x] Position snaps away from screen edges using `getBoundingClientRect()` after nextTick
- [x] z-index 1000; CSS vars for all colours
- [x] State managed via `uiStore.showContextMenu` / `hideContextMenu`
- [x] `MenuItem` type exported from `uiStore.ts`

#### 19.11.4 Spellcheck Suggestions ⏳ Deferred
- WebView2 does not expose spelling suggestions through any accessible JS API at this level. Skipped as best-effort; no degraded UX — editor still has native spellcheck underlines.

#### 19.11.5 Standard Edit Operations ✅
- [x] Right-clicking a `[contenteditable]` shows Cut + Copy (only when text selected) + Paste always
- [x] Uses `document.execCommand` (works natively in WebView2 without extra capabilities)
- [x] Paste goes through the contenteditable's `input` event, so undo history is preserved

#### 19.11.6 Context-Sensitive Items by Target ✅

| Target | Items |
|---|---|
| Pane drag handle | Reset to default width |
| Chapter item (`[data-chapter-id]`) | Chapter name header, Rename, Edit properties, Delete (danger) |
| External link in preview pane | Open in browser, Copy link |
| Image in preview pane | Copy image path (only for non-data-URL srcs) |
| Contenteditable (editor) | Cut (if selection), Copy (if selection), Paste |
| Anything else | Nothing (default suppressed in prod only) |

- [x] Resolver in `src/utils/contextMenuResolver.ts` — factory pattern, stores captured in closure
- [x] Chapter Rename trigger: `uiStore.renamingChapterId` watched by `ChapterItem.vue`
- [x] Chapter Delete trigger: `uiStore.pendingDeleteChapterId` watched by `Sidebar.vue` → fires existing confirmation modal
- [x] Chapter Meta trigger: `uiStore.pendingMetaChapterId` watched by `Sidebar.vue` → opens `ChapterMeta` modal
- [x] Duplicate not implemented (no storyStore action exists; deferred)
