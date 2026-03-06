# Phase 19: Bug Fixes & UI Polish ⏳ NOT STARTED

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

Tracked issues from the post-code-review pass (2026-03-03).

### 19.1 Preview Mode Paragraph Rendering (Bug)
- [ ] In preview mode, all newlines are collapsed and separate paragraphs merge into one continuous block. The `markdownRenderer` is not converting blank-line-separated text blocks into distinct `<p>` tags (or not preserving `<br>` / margin between them). Investigate `renderMarkdown(..., 'preview')` output for plain paragraph content and ensure double-newlines produce separate `<p>` elements with proper spacing.

### 19.2 Active Model Display in Editor Status Bar
- [ ] Show the currently selected AI model name in the editor bottom status bar (next to word count / line count). Reads from `aiStore.currentModel`. Clicking it could open the AI panel for quick model switching.

### 19.3 Custom Title Bar (Tauri Decorations)
- [ ] Hide the default OS title bar using Tauri's `decorations: false` window config in `tauri.conf.json`
- [ ] Implement a custom title bar component (`TitleBar.vue`) with:
  - App icon / name on the left
  - Draggable region (`data-tauri-drag-region`) for window movement
  - Minimize / maximize / close buttons on the right using Tauri's `appWindow.minimize()`, `appWindow.toggleMaximize()`, `appWindow.close()`
  - Respect platform conventions (button order, hover colors)
- [ ] Ensure the custom title bar works correctly on Windows; test on macOS if applicable
- [ ] Note: Tauri 2 supports `decorations: false` + `data-tauri-drag-region` — this is fully possible

### 19.4 Resizable Panes (Sidebar / Editor / Side Panels)
- [ ] Add adjustable borders/drag handles between the sidebar and the main editor area, and between the editor and any open right panel (Overview, AI, Export)
- [ ] Implement pointer-based resize (mousedown on divider → track mousemove → update CSS flex-basis or width)
- [ ] Persist pane widths to `settingsStore` (or `localStorage`) so they survive restarts
- [ ] Set reasonable min/max width constraints per pane (e.g. sidebar min 180px, max 400px)
- [ ] Consider a collapse threshold — dragging below minimum snaps the pane closed

### 19.5 Drop Cap (Multi-Line Capital First Letter)
- [ ] Add a drop cap style for chapter openings — the first letter of a chapter's first paragraph renders as a large, multi-line capital (spanning 2–3 lines)
- [ ] Implement via CSS `::first-letter` pseudo-element with `float: left`, `font-size`, `line-height`, and `padding` tuned to the editor font
- [ ] Toggle in settings (Settings → Editor or Appearance tab): **Show drop cap** (default: off)
- [ ] Apply in both seamless and preview modes; export renderers (HTML, EPUB) should include the drop cap CSS when enabled
- [ ] Consider a markdown extension syntax (e.g. a class annotation) or simply apply to the first `<p>` of each chapter automatically

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
