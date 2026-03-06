# Phase 19: Bug Fixes & UI Polish ⏳ NOT STARTED

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

### 19.6 Minimal Border / Divider Restyle
- [ ] Rework border styles across the app to be more minimal — adjacent background sections touch directly with only a subtle, short center-aligned divider line rather than full-width borders
- [ ] Design approach: replace `border-right` / `border-left` on pane edges with a pseudo-element (`::after`) that draws a short vertical line (e.g. 40–60% of the container height, centered, 1px, low-opacity accent or text color)
- [ ] Apply consistently to: sidebar ↔ editor divider, editor ↔ right panel divider, sidebar section dividers
- [ ] **Iterate on design** — this will likely need visual experimentation before finalising; prototype with CSS variables for divider length, opacity, and color so it can be tuned easily
- [ ] Ensure the style works well in both dark and light themes

### 19.7 Active Sidebar Icon Highlighting
- [ ] When a sidebar panel is open (AI, Export, Overview, Search, Settings), its corresponding icon/button in the sidebar or editor header should appear highlighted (active state)
- [ ] Match the styling used for active editor mode icons (e.g. accent-colored background pill or underline)
- [ ] Read from `uiStore.activePanel` / `uiStore.showSettings` / `uiStore.showSearchPanel` to determine which icon should be active
- [ ] Apply to all toggle-able panel buttons: ✦ (AI), ⬡ (Export), ◨ (Overview), 🔍 (Search), ⚙ (Settings)

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

### 19.9 Formatting Toolbar (Expandable Styling Bar)
- [ ] Add a collapsible/expandable toolbar above the editor area with quick-insert buttons for common Markdown formatting:
  - **Bold** (`**…**`), *Italic* (`*…*`), ~~Strikethrough~~ (`~~…~~`), `Code` (`` `…` ``), [Link] (`[text](url)`), Heading (`# `, `## `, `### `), Blockquote (`> `), Unordered list (`- `), Ordered list (`1. `), Horizontal rule (`---`), Image (`![alt](url)`)
- [ ] Behaviour should be **cursor- and selection-aware**:
  - With a selection: wrap the selected text in the appropriate syntax (e.g. select "hello" → click Bold → `**hello**`)
  - Without a selection: insert a placeholder snippet (e.g. `**bold text**`) with the inner text pre-selected for immediate typing
  - For block-level items (heading, quote, list): insert at the start of the current line, or wrap selected lines
- [ ] Toolbar is collapsed by default; toggle via a small chevron/arrow button at the edge
- [ ] Persist collapsed/expanded state in `settingsStore`
- [ ] Toolbar should be visible in seamless and markdown modes; hidden in preview mode
- [ ] Use the same keyboard shortcut bindings already registered (Ctrl+B, Ctrl+I, etc.) — toolbar buttons are a visual companion to those shortcuts, with tooltips showing the shortcut

### 19.10 VS Code Extension Feasibility (Long-Term / Research)
- [ ] **Research phase only** — evaluate whether the seamless Markdown editor can be extracted into a standalone VS Code extension
- [ ] Key questions to answer:
  - VS Code extensions use the VS Code API (TypeScript); the editor itself is Monaco-based. Our seamless renderer is Vue.js + contenteditable — can it run inside a VS Code WebviewPanel?
  - A Webview extension *can* embed arbitrary HTML/CSS/JS (including Vue), so framework isn't a blocker — but it would be a separate build target, not a rewrite
  - What subset of functionality makes sense? (Just the seamless WYSIWYG rendering, or also AI suggestions, story management, etc.?)
  - Are there existing VS Code Markdown WYSIWYG extensions we'd compete with? (Markdown All in One, Foam, etc.)
- [ ] **Decision gate:** only proceed if the Webview approach works and there's clear user demand; otherwise park this idea
- [ ] If pursued: create a `vscode-extension/` workspace folder with its own `package.json`, build pipeline, and a shared import of `seamlessRenderer.ts` + rendering utilities

### 19.11 Context Menu Rework

The default WebView2 context menu exposes browser developer tools and other entries that are inappropriate in a release build. This item replaces it with a purpose-built context menu that is both safer and more useful.

#### 19.11.1 Suppress the Default Context Menu in Release Builds
- [ ] In development builds the native WebView2 context menu is fine (Inspect, View Source, etc. are useful). In release builds it must be hidden entirely so that a custom menu can be shown instead.
- [ ] **Approach A (JS — simple)** — attach a global `contextmenu` event listener in `main.ts` (or `App.vue` `onMounted`) that calls `event.preventDefault()`. Conditionally register it only when `import.meta.env.PROD` is `true`. This suppresses the default browser-level menu everywhere.
- [ ] **Approach B (Tauri — thorough)** — Tauri 2 exposes `webview.on_context_menu` or the `prevent_default_all` window option in `WindowBuilder`. Investigate whether `tauri.conf.json` supports a `contextMenu: false` flag; if so, set it for release and leave dev untouched.
- [ ] The custom Vue context menu (see 19.11.3 below) must be shown instead — so `preventDefault()` is required regardless of approach.
- [ ] Guard: never suppress the menu when running under `__TAURI_INTERNALS__` is absent (browser dev mode needs inspect).

#### 19.11.2 Reset Pane Widths via Handle Right-Click
- [ ] Right-clicking a pane drag handle (`.divider-handle`) should open a small context menu with a single item: **"Reset to default width"**.
- [ ] Action: call `document.documentElement.style.removeProperty(cssVar)` and `localStorage.removeItem(storageKey)` — both values are already available inside the `usePaneResize` composable, so a `resetWidth()` function should be exported alongside `onDividerMousedown` and `restoreWidth`.
- [ ] Wire up: add `@contextmenu.prevent="sidebarResize.showResetMenu($event)"` / `rightPanelResize.showResetMenu($event)` on the handle `<div>` in `App.vue`. The composable can emit a `{ x, y, reset }` event that the menu system renders.
- [ ] After reset, the CSS variable reverts to its `:root` default (sidebar: 250px, right panel: 300px).

#### 19.11.3 Custom Context Menu Component
- [ ] Create `src/components/ContextMenu.vue` — a teleported (`<Teleport to="body">`) absolutely-positioned menu that accepts a list of items and a screen position.
- [ ] Item types:
  - **Action** — label + optional keyboard shortcut hint + callback
  - **Separator** — `<hr>` visual divider
  - **Disabled** — greyed-out non-interactive label (for informational headers)
- [ ] Behaviour:
  - Click outside or press `Escape` → close
  - Position snaps away from screen edges to stay fully visible
  - z-index above all panels (suggest `z-index: 1000`)
- [ ] Wire up via a composable `useContextMenu` (or a `uiStore` action) that exposes `showMenu({ x, y, items })` and `hideMenu()`.
- [ ] Style: matches the app theme (CSS variables for background, border, text, hover accent).

#### 19.11.4 Spellcheck Suggestions on Misspelled Words
- [ ] When the user right-clicks a word that the browser spellchecker has underlined, the context menu should offer the browser's suggested corrections at the top of the menu.
- [ ] **Browser API**: The `beforeinput` / `textInput` events don't expose spellcheck suggestions. Instead, listen for `contextmenu` on the editor element; check if `event.target` or its ancestors carry the browser's spellcheck marker.
  - Chrome/WebView2 fires a `contextmenu` event with `InputEvent` spelling suggestions accessible via the (non-standard but WebView2-supported) `getSpellingSuggestions()` API on the event — investigate availability in Tauri's WebView2 version.
  - Fallback: use the `spellcheck` attribute on the contenteditable and intercept the `contextmenu` event; read `window.getSelection()` to detect the clicked word, then check it against a dictionary via `navigator.language` if no native API is available.
- [ ] Show suggestions as the first group of menu items, each with a callback that replaces the misspelled word range in the editor's plain-text content via `editorStore`.
- [ ] If no suggestions are available (word not flagged or API unavailable), omit this section silently.

#### 19.11.5 Standard Edit Operations (Copy / Cut / Paste)
- [ ] The context menu for text selection areas (editor, chapter titles, input fields) should include:
  - **Cut** — `document.execCommand('cut')` or `navigator.clipboard.writeText` + delete selection
  - **Copy** — `navigator.clipboard.writeText(selection.toString())`
  - **Paste** — `navigator.clipboard.readText()` then insert at cursor
- [ ] Show **Cut** and **Copy** only when there is an active non-empty text selection; **Paste** when the clipboard is non-empty (check `navigator.clipboard.readText()` resolves).
- [ ] Note: `execCommand` is deprecated but still works in WebView2; `navigator.clipboard` requires the `clipboard-read` / `clipboard-write` permissions. Add these to `capabilities/default.json` if not already present.
- [ ] In the editor body: map these to `editorStore` actions so they go through the undo history stack rather than bypassing it.

#### 19.11.6 Context-Sensitive Items by Target
- [ ] The menu content should adapt based on what element was right-clicked. Define a resolver function that inspects `event.target` and returns the appropriate item list:

| Target | Extra menu items |
|---|---|
| Pane drag handle | Reset pane width (19.11.2) |
| Editor / contenteditable | Spellcheck suggestions (19.11.4), Cut/Copy/Paste (19.11.5) |
| Link in preview pane | Open in browser (`shell.open(href)` via Tauri) |
| Image in preview pane | Copy image path / Open containing folder |
| Chapter item in sidebar | Rename, Duplicate, Delete chapter (mirrors existing button actions) |
| Chapter history entry | Restore this version, Delete entry |
| Anywhere (fallback) | Nothing (menu is suppressed, or only global items like Copy if selection exists) |

- [ ] The resolver lives in a utility file `src/utils/contextMenuResolver.ts` and returns `MenuItem[]` given a `MouseEvent`.
- [ ] Avoid duplicating logic already in toolbar buttons or keyboard shortcuts — context menu items should call the same underlying store actions.

#### Roll-up Implementation Order
1. Build `ContextMenu.vue` + `useContextMenu` in isolation with a stub item list (19.11.3)
2. Suppress default context menu in release builds (19.11.1)
3. Wire up Copy/Cut/Paste for the editor (19.11.5)
4. Add handle right-click reset (19.11.2), exporting `resetWidth()` from `usePaneResize`
5. Implement spellcheck suggestions (19.11.4) — mark as best-effort given WebView2 API limitations
6. Add context-sensitive sidebar chapter items (19.11.6)
7. Add preview pane link/image items (19.11.6)
