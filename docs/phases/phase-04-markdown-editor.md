# Phase 4: Markdown Editor & Preview System ✅ MOSTLY COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

### 4.1 Markdown Editor ✅
- [x] Editor component with content-editable div
- [x] Line numbers and basic syntax awareness
- [x] Tab and indentation support (Tab inserts two spaces in editor)
- [x] Three rendering modes: seamless, markdown, preview
- [x] CRLF/LF normalisation (Windows clipboard paste works correctly)
- [ ] Code formatting guides (visual helpers)

### 4.2 Preview Rendering ✅
- [x] Real-time preview updates
- [x] CSS styling for preview with proper markup elements
- [x] Support for:
  - [x] Headers (h1-h6) with seamless hide/show of # markers
  - [x] Unordered lists with nested/indented bullet levels
  - [x] Bold / italic / strikethrough
  - [x] Inline code
  - [x] Inline formatting nested inside list items and headers
  - [ ] Tables — **TODO**

### 4.3 Edit/Preview Toggle ✅
- [x] Full markdown mode (raw text with syntax)
- [x] Full preview mode (rendered HTML)
- [x] Seamless mode (hybrid showing markdown and preview)
- [x] Smooth transitions between modes
- [x] Sync scroll between editor and preview — split view toggle (⊡ button) shows editor + live preview side by side with proportional scroll sync; persisted to localStorage

### 4.4 Inline Editing Mode
- [ ] Detect cursor position in preview
- [ ] Trigger inline edit mode when clicking text
- [ ] Edit text without switching to edit mode

### 4.5 Extended Markdown Features ✅ COMPLETE
- [x] Fenced code blocks (```lang\n...\n```) — multi-line token, lang label, monospace block
- [x] Ordered lists (1. item) with correct numbering, nesting, inline formatting
- [x] Blockquotes (> text) with visual left-bar, nested levels (>>)
- [x] Horizontal rules (--- / ***)
- [x] Inline links ([text](url)) — rendered clickable in preview; Ctrl+Click in seamless
- [x] External links open in system browser via plugin-opener (never inside WebView)
- [x] Internal `chapter://` links navigate within the app
- [ ] **In-chapter anchor links** (`chapter://id#anchor`) — extend the `chapter://` scheme with an optional `#fragment` so authors can link to a specific heading or named location within a chapter (e.g. `chapter://bibliography-chapter#ref-smith2020`); headings in preview automatically get slugified `id` attributes; bibliography and endnote entries get `id="ref-{key}"` anchors; `navigateToChapter` extended to scroll to the target element after navigation
- [x] Internal `story://` links — `[text](story://story-id)` or `[text](story://story-id/chapter-id)` — navigate to another story (optionally landing on a specific chapter); broken links shown with strikethrough in `--error-color`
- [ ] `:icon name:` shorthand in markdown — e.g. `:PhGear:` or `:mdiCog:` renders the matching Phosphor/MDI icon inline; **deferred** pending icon library choice and consideration of export implications (icons would need to be stripped or converted for MD/HTML/DOCX export)
- [ ] **Footnotes** (`[^1]` inline marker + `[^1]: footnote text` definition at end of chapter) — rendered at chapter bottom in preview; Pandoc-compatible syntax; see Phase 12.8 for full spec
- [x] Images (![alt](url)) — remote URLs rendered as `<img loading="lazy">`; local paths show styled placeholder; seamless mode shows source chars when cursor is on the token
- [ ] Tables (pipe syntax)

### 4.6 Markdown Reference Page ✅ COMPLETE
- [x] Dedicated modal (`MarkdownReference.vue`) showing all supported markdown syntax
- [x] Each entry: syntax example (code) + rendered result side-by-side
- [x] Grouped by category: Headings, Text Formatting, Lists, Blockquotes, Fenced Code, Links, Images, Horizontal Rules, Combinations
- [x] Accessible from editor header (? button; also has Escape to close)
- [x] Teleport to body, backdrop click to close, matches app theme (CSS vars)

**Current Status:**
- ✅ Markdown editor with three modes operational
- ✅ Real-time preview system working
- ✅ Mode switching fully integrated
- 🟡 Basic markdown support complete, advanced features (links, images) pending
- ⏳ Inline seamless editing has framework but needs cursor sync refinement
