# Phase 10: Export & Data Management 🟡 99% COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

### 10.1 Markdown Export ✅
- [x] Export entire story as single `.md` file (chapters concatenated with `## Chapter Name` headers)
- [x] Export single current chapter as standalone `.md` file
- [x] Native save dialog (Tauri `plugin-dialog`) defaults filename to story/chapter title
- [x] `tauri-plugin-dialog` Rust plugin registered; `dialog:allow-save` capability added

### 10.2 HTML Export (Print → PDF) ✅
- [x] Export story as a self-contained styled `.html` file
- [x] Story metadata (title, genre, tone) in header section
- [x] Each chapter separated with `<h2>` heading
- [x] Print-ready CSS with `@media print { h2 { page-break-before: always } }`
- [x] Reuses `markdownRenderer.renderMarkdown(..., 'preview')` for body content
- [x] Export can be opened in browser and printed to PDF

### 10.3 DOCX Export ✅
- [x] Uses `docx` npm package (pure-JS, no Rust required)
- [x] Title page paragraph + one `HEADING_1` per chapter
- [x] Chapter body split on blank lines → individual `Paragraph` objects
- [x] Inline markdown stripped to plain text
- [x] Binary write via `writeFile(Uint8Array)` + `fs:allow-home-write-recursive`

### 10.4 Markdown Import ✅
- [x] Open file dialog (`.md`, `.txt`) via `plugin-dialog`
- [x] File read via `readTextFile` (absolute path) + `fs:allow-home-read-recursive`
- [x] First `# Heading` in file used as chapter name; falls back to filename
- [x] Imported content becomes a new chapter in the current story
- [x] `setCurrentChapter` auto-switches to the new chapter

### 10.5 Backup & Restore ✅ COMPLETE
- [x] "Export backup" — serializes full story state (metadata + all chapters with AI metadata + characters) to a user-chosen `.json` file via save dialog
- [x] "Restore backup" — opens a `.json` backup, creates a fresh story ID, fully restores all chapter fields (including AI summaries/tags), auto-saves to disk
- [x] `src/utils/backupRestore.ts` — `BackupFile` interface, `exportBackup()`, `importBackup()`
- [x] `storyStore.restoreFromBackup(backup)` — sets full store state, returns new story ID
- [x] Backup & Restore section added to `ExportPanel.vue`
- [ ] Auto-backup on close or timer (Phase 11)

### 10.6 EPUB Export ✅ COMPLETE

EPUB 3.0 is the standard format for e-readers (Kindle via conversion, Kobo, Apple Books, etc.). It is a ZIP archive containing XHTML chapter files, a CSS stylesheet, an OPF package manifest, and a `nav.xhtml` navigation document.

**Library:** `epub-gen-memory` (pure-JS, browser bundle `epub-gen-memory/bundle`; outputs `Blob` in WebView; converted to `Uint8Array` via `blob.arrayBuffer()` then written with existing `writeFile`).

#### Core output
- [x] `exportStoryToEpub(meta, chapters)` added to `exportImport.ts`
- [x] Save dialog defaults to `<story-title>.epub`; written via `writeFile(Uint8Array)`
- [x] EPUB 3.0 (`version: 3`)
- [x] Story title and description injected as EPUB metadata
- [x] Language defaults to `en`

#### Chapter rendering
- [x] Each chapter becomes an XHTML spine item; chapter order matches sidebar order
- [x] Chapter headings (`chapterLabel` prefix when set) → `<h1>` in XHTML
- [x] Chapter content passed through `renderMarkdown(..., 'preview')` → HTML handed to EPUB builder
- [x] **TOC chapter** → readable `<ol>` nav page placed `beforeToc`; excluded from auto-TOC; entries are plain text chapter names
- [x] **Cover chapter** → XHTML with `.cover-block` class; `beforeToc: true`; excluded from auto-TOC
- [x] **License chapter** → XHTML with `.license-block` class; included in spine
- [x] **Illustration chapter** → image read from disk via Tauri `readFile`, embedded as base64 data-URL `<img>` with `<figcaption>`; falls back to placeholder text if file not found

#### Styling
- [x] Embedded CSS optimized for e-readers: Georgia serif, `line-height: 1.7`, `max-width: 100%`
- [x] `.cover-block`, `.license-block`, `figure`, `figcaption` classes; no `@media print` rules

#### Export panel integration
- [x] "Export as EPUB" button added to `ExportPanel.vue` alongside existing format buttons
- [x] `mdiBookOpenPageVariant` icon used for the button
- [x] Same success/error notification pattern as other export formats

### Technical Notes
- `plugin-dialog` Rust crate added to `Cargo.toml`, registered in `lib.rs`
- Capabilities: `dialog:allow-open`, `dialog:allow-save`, `fs:allow-home-read-recursive`, `fs:allow-home-write-recursive`
- `filesystem.ts` extended with `writeAbsoluteFile(path, content)`, `readAbsoluteFile(path)`, `writeBinaryAbsolute(path, data: Uint8Array)`
- `backupRestore.ts` — uses `writeAbsoluteFile` + `readAbsoluteFile`; backup format v1 includes all `Chapter` fields (AI metadata preserved)
- `uiStore.activePanel` extended with `'export'` type
- `ExportPanel.vue` shown as right panel (same architecture as `AIPanel.vue`)
- Export button `⬡` added to editor header
- **Bibliography & footnote export** — see [Phase 12](phase-11-12-polish-chapters.md) for the source-of-truth spec. Summary: Markdown uses Pandoc `[^n]` syntax; HTML uses `<sup><a>` + `<section class="footnotes">` at chapter end + `id` anchors on bibliography entries; DOCX uses native Word footnotes (`FootnoteReferenceRun`) + formatted bibliography paragraphs; EPUB uses `epub:type="footnote"` footnotes with backlinks + `id`-anchored bibliography entries; `chapter://id#anchor` internal links rewritten to format-appropriate hrefs in all exporters
