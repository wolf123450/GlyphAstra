# Phases 8–9: Search & Settings ✅ MOSTLY COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

## Phase 8: Search & Navigation Features ✅ MOSTLY COMPLETE

- [x] Full-text search across all chapters' content (case-insensitive, live as you type)
- [x] Search results with highlighted context snippets (±80 chars around each match, up to 3 per chapter)
- [x] Table of contents view when search is empty (chapter list with word count + status)
- [x] Keyboard navigation: ↑/↓ to move between results, Enter to navigate, Esc to close
- [x] `Ctrl+F` opens/closes the panel (via `uiStore.toggleSearchPanel()`)
- [x] Live editor content used for currently-open chapter (shows unsaved changes)
- [x] Click chapter heading or snippet to navigate to that chapter
- [x] **Regex mode** — toggle button (e.g. `.*` pill) in the search input row; when active, interprets the query as a JavaScript regular expression; invalid regex shows an inline error instead of results; affects snippet highlighting
- [x] **Case-sensitive mode** — toggle button (`Aa` pill) in the search input row; when off (default) search is case-insensitive; when on, exact case is required; applies to both plain-text and regex searches
- [x] **Search & Replace** — expandable replace row below the search input (toggle with a `⇄` button); replace field accepts plain text; "Replace" button swaps the focused match in its chapter; "Replace All" replaces every match across all chapters and saves each affected chapter; undo via the editor's existing content state
- [ ] Advanced search filters (chapter, character, date range)
- [ ] Result count badge in sidebar / status bar

---

## Phase 9: Settings & Customization ✅ COMPLETE

- [x] **Settings modal component** (`Settings.vue`) — full overlay modal with 5 tabs
- [x] Editor settings (font size, font family, line height, tab width)
- [x] Auto-save interval settings (Off / 5s / 10s / 30s / 1min / 5min)
- [x] AI settings (default style, suggestion length, temperature, context window size)
- [x] Theme customization (dark / light toggle)
- [x] Keyboard shortcuts reference table
- [x] All settings persisted to `localStorage` via `settingsStore`
- [x] Font settings applied as `--editor-font-size`, `--editor-line-height`, `--editor-font-family` CSS variables
- [x] Persisted theme restored on startup
- [x] `Ctrl+,` and ⚙ button both open the modal
- [ ] Keyboard shortcut customization (UI only, editing coming later)
- [ ] Custom prompt templates
- [x] **Custom UI theme colors** — let users override individual CSS color variables (accent, background, text) for both dark and light mode; saved per-theme in `settingsStore`; a color-picker grid in the Appearance tab with a "Reset colors" button
