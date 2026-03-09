# Phases 11–12: Performance/Polish & Chapter Management 🟡 IN PROGRESS

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

## Phase 11: Performance Optimization & Polish ⏳ NOT STARTED

- [ ] Lazy loading for large stories
- [ ] Virtual scrolling for long chapter lists
- [ ] Memory optimization
- [ ] Caching strategies
- [ ] UI polish and animations
- [ ] Loading states and transitions
- [ ] Accessibility (WCAG compliance)
- ✅ Unit and integration test suite (Vitest, 149 tests across seamlessRenderer, editorCursor, CRLF tokenisation)

### 11.x Icon Library Overhaul 🟡 IN PROGRESS

**Problem:** Several current icons are unsatisfying — the circled `+` for new chapters, sidebar expand/collapse arrows, export/import icon, save icon, settings gear, and the app icon itself. Unicode glyphs are limited and inconsistent across platforms.

**Approach:**
- Both **Phosphor Icons** (`@phosphor-icons/vue`, MIT, ~1,200 icons, Vue 3 components, weight variants) and **Material Design Icons** (`@mdi/js`, ~7,000 SVG path strings) are now installed.
- An in-app **Icon Gallery** (`IconGallery.vue`) is accessible from **Settings → Help → Browse icon gallery** for side-by-side comparison.
- The gallery shows candidates for each UI slot (new chapter, settings, delete, edit, drag handle, save, export, sidebar, search) with all Phosphor weight variants selectable and multiple size options.
- Click any candidate card to copy the import name to the clipboard.

**Scope:**
- [x] Install `@phosphor-icons/vue` and `@mdi/js`
- [x] Build in-app icon gallery (`IconGallery.vue`) — side-by-side comparison, Phosphor weight selector, size selector, copy-import-name on click
- [x] Gallery accessible from Settings → Help tab
- [x] User selects preferred icons for each slot, then replace Unicode glyphs across Sidebar, Editor header, ExportPanel, Settings modal
- [x] Ensure icons respect the current CSS `--text-primary` / `--accent-color` variables so they work in both dark and light themes
- [ ] Design new app icon (`.ico` / `.icns` / `.png` set) matching chosen aesthetic

### 11.y Icon Component Refactor ✅ COMPLETE

**Problem:** Every icon in the codebase is a raw `<svg width="N" height="N" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiXxx"/></svg>` inline fragment. This is verbose, non-semantic (no `aria-label`/`role`), hard to search, and requires manually threading `width`/`height`/`fill` everywhere. It also makes a future icon set swap painful.

**Solution:** Created `src/components/AppIcon.vue` — a thin wrapper that sets sensible default `size` and handles accessibility automatically (`aria-hidden="true"` for decorative icons, `role="img"` + `<title>` for meaningful ones). Registered globally in `main.ts` so no per-file imports are needed.

**Migration plan:**
1. [x] Create `src/components/AppIcon.vue` — accessibility-aware SVG wrapper
2. [x] Register globally in `main.ts`; declare in `src/global-components.d.ts` for TypeScript
3. [x] Codebase-wide sweep replacing all `<svg … fill="currentColor"><path :d="mdiXxx"/></svg>` with `<AppIcon :path="mdiXxx" />` — ~108 call sites across 22 `.vue` files
4. [x] Per-site `width`/`height`/`fill`/`aria-hidden` attributes removed; size controlled via `:size` prop; `class`/`style` forwarded via Vue `inheritAttrs`

---

## Phase 12: Chapter Management 🟡 IN PROGRESS

Substantial standalone features grouped to avoid fragmented implementation.

### 12.1 Drag-to-Reorder Chapters ✅ COMPLETE
- [x] Drag handle (&#x28FF;) on each sidebar chapter row (visible when search is inactive)
- [x] Visual drop indicator (glowing accent line) between chapters
- [x] `storyStore.reorderChapters(newOrder: string[])` action updates chapter order and saves
- [x] Native pointer-events (mousedown/mousemove/mouseup) — avoids WebView2 HTML5 DnD restrictions
- [x] Drag disabled automatically when search filter is active
- [x] Dragged chapter dims (`.is-dragging`) while repositioning
- [x] `dataTransfer.setData` set for Firefox compatibility

### 12.2 Chapter Version History & Timeline ✅ MOSTLY COMPLETE
- [x] Snapshot-based history captured on every successful save (50-char delta or 60s elapsed threshold)
- [x] Max 20 snapshots per chapter, oldest pruned first; persisted to `stories/{storyId}/history/{chapterId}.json`
- [x] `src/utils/historyManager.ts` — `captureSnapshot()`, `getHistory()`, `evictCache()`; in-memory cache prevents redundant disk reads
- [x] `src/components/ChapterHistory.vue` — modal with:
  - Scrollable snapshot list (most recent first; datetime + word count per entry)
  - Full Markdown preview of selected snapshot
  - Line-level LCS diff view vs current editor content (added lines green, removed red)
  - "Restore this version" button replaces current editor content
- [x] Editor status bar "⏱ History" button opens the modal
- [x] Snapshot capture hooked into `saveChapter()` in `Editor.vue` (after successful save)
- [ ] **Age heatmap view** — colour live text by recency: recently written = bright, older = faded (deferred, complex)
- [ ] Timeline slider UI for visual browsing

### 12.3 Session Undo / Redo ✅ COMPLETE
- [x] Persistent undo/redo stack beyond the browser's native `contenteditable` history (`src/utils/undoManager.ts`)
- [x] Survives chapter switches within a session (stack keyed by chapter ID; `init` is a no-op if the chapter already has a stack)
- [x] `Ctrl+Z` / `Ctrl+Shift+Z` (also `Ctrl+Y`); pre-structural snapshot emitted before Enter/Delete/Tab/paste/cut

### 12.4 Special Chapter Types (UI & Export Rendering) ✅ COMPLETE
- [x] **Table of Contents** — auto-generated from chapter titles; renders as a formatted list in preview/export
- [x] **Cover** — full-page image or styled title block in export
- [x] **License / Publisher Info** — formatted legal block
- [x] **Illustration** — embeds an image file; caption field; rendered inline in preview and export
- [x] Chapter type icons shown in sidebar (badges in ChapterItem) next to title
- [x] `chapterType` + `illustrationPath` + `illustrationCaption` persisted in story data
- [x] 6-option type picker in Chapter Properties (Normal / Plot Outline / Contents / Cover / License / Illustration)
- [x] Type banners shown in editor for TOC and Illustration chapters
- [x] All three exporters (Markdown, HTML, DOCX) handle each chapter type correctly

### 12.5 Translations
- [ ] A chapter can have one or more translation variants (language tag + content)
- [ ] AI-assisted auto-translation via Ollama (long-term)
- [ ] Manual translation entry
- [ ] Language selector in editor header when translations exist

### 12.7 Chapter Numbering & Custom Labels ✅ COMPLETE

- [x] Add `chapterLabel?: string` to the `Chapter` type
- [x] When `chapterLabel` is set it is shown in the sidebar as a badge and as a heading prefix in exports
- [x] When `chapterLabel` is empty the chapter shows an auto-incremented number (unlabeled chapters only); labeled chapters don't consume a number
- [x] `chapterLabel` is editable in the **Chapter Metadata Editor** (new "Display label" field with free-form input and quick-preset buttons: Prologue, Epilogue, Interlude, Appendix, Part I/II/III)
- [x] Export (MD, HTML, DOCX) uses `chapterLabel` when present (prefixed to heading: "Prologue: Chapter Title" or just "Prologue" when label = title); falls back to chapter title only
- [x] Serialization updated in `storyManager.ts` (`chapterLabel` persisted with story data)

### 12.6 Inline Chapter Title Editing ✅ COMPLETE
- [x] Mouseover on a chapter name in the sidebar reveals an edit (✎) indicator icon.
- [x] Single-click on a chapter name in the sidebar activates an in-place `<input>` replacing the title text
- [x] `Escape` cancels and restores the original name; `Enter` or blur commits via `storyStore.updateChapter()`
- [x] Input auto-selects all text on activation for fast replacement
- [x] No rename occurs if the trimmed value is empty or unchanged
- [x] Visual affordance: cursor changes to `text` on hover over the title span

### 12.8 Bibliography, Citations & Footnotes ⏳ NOT STARTED

Supports academic, non-fiction, and heavily-researched creative work. Three interlocking features: a **Bibliography chapter type** for the reference list, in-text **citation references** that link to it, and **footnotes** for inline asides. Requires the `chapter://id#anchor` scheme extension (also listed in Phase 4.5) as its cross-linking foundation.

#### In-chapter anchor link scheme extension
- [ ] Extend `chapter://` to support `chapter://chapter-id#anchor-slug`; `navigateToChapter` splits on `#` and, after switching to the chapter, scrolls the preview/seamless view to the element with that `id`
- [ ] Headings in `markdownRenderer` / `seamlessRenderer` preview output gain auto-slugified `id` attributes (same `slugify()` helper used by the exporters)
- [ ] Broken anchor fragments (heading removed) degrade gracefully — navigation still switches to the chapter, scroll step is skipped silently
- [ ] `EditorPreview.vue` and `EditorSeamless.vue` handle the fragment part of `chapter://` clicks

#### Footnote markdown syntax
- [ ] `[^key]` inline marker — inserts a numbered superscript; key can be numeric (`[^1]`) or a meaningful string (`[^smith2020]`)
- [ ] `[^key]: Footnote text` definition block at end of chapter; multi-line supported with indented continuation
- [ ] `markdownRenderer` renders markers as `<sup><a href="#fn-key" id="fnref-key">N</a></sup>` and appends a `<section class="footnotes"><ol>…</ol></section>` at chapter end
- [ ] Each footnote entry includes a `↩` backlink to its inline marker
- [ ] Footnote markers in seamless mode render as styled superscripts; definition lines are visually de-emphasized (smaller, dimmer)
- [ ] Footnote numbering resets to 1 per chapter in all display modes

#### Bibliography chapter type
- [ ] New `chapterType: 'bibliography'` added to `Chapter` type and all data/serialization layers
- [ ] 7th option in Chapter Properties type picker: `📚 Bibliography`; corresponding `badge-bibliography` chip in `ChapterItem.vue`
- [ ] Editor for bibliography chapters shows a **structured citation list UI** instead of a plain text editor: list of citation cards (formatted per active style), **Add citation** button, drag-to-reorder, delete per entry
- [ ] `CitationEditor.vue` modal: form fields per `CitationEntry` type (author list, title, year, journal, volume, issue, pages, publisher, DOI, URL, etc.); field set adapts to citation type
- [ ] `citations?: CitationEntry[]` field on `Chapter` type — persisted in story data; raw `content` holds the rendered reference list as formatted text (regenerated on save) for plain-text export fallback
- [ ] `CitationEntry` interface:
  ```typescript
  interface CitationEntry {
    key: string           // cite key, e.g. 'smith2020'
    type: 'book' | 'article' | 'website' | 'chapter' | 'conference' | 'thesis' | 'other'
    authors: string[]     // ["Last, First", …]
    title: string
    year?: number
    publisher?: string
    city?: string
    journal?: string
    volume?: string
    issue?: string
    pages?: string        // '123–145' or '123'
    edition?: string
    editors?: string[]    // for edited volumes
    doi?: string
    url?: string
    accessDate?: string   // ISO date, for URL citations
    additionalFields?: Record<string, string>
  }
  ```

#### Citation styles
- [ ] `citationStyle: 'apa' | 'mla' | 'chicago-author-date' | 'chicago-notes' | 'turabian' | 'ieee'` added to story metadata; default `'apa'`
- [ ] `src/utils/citationFormatter.ts` — `formatInText(entry, style)` and `formatReference(entry, style)` for all six styles
- [ ] **APA 7th**: `(Author, Year)` in-text; `Author, A. A. (Year). *Title*. Publisher.` reference
- [ ] **MLA 9th**: `(Author page)` in-text; `Author. *Title*. Publisher, Year.` reference
- [ ] **Chicago Author-Date**: `(Author Year, page)` in-text; `Author. Year. *Title*. Publisher.` reference
- [ ] **Chicago Notes / Turabian**: `[@key]` references become footnote entries rather than inline citations
- [ ] **IEEE**: `[1]` numeric bracket in-text; `[1] A. Author, "Title," *Journal*, vol. V, no. N, pp. P, Year.` reference
- [ ] `[@key]` syntax in markdown — renderer looks up entry by key in all bibliography chapters; formats per active style; unknown keys render in `--error-color` as `[?key]`
- [ ] Clicking a rendered `[@key]` in preview navigates to the bibliography chapter and scrolls to that entry via `chapter://biblio-chapter-id#ref-key`

#### Endnotes chapter type
- [ ] `chapterType: 'endnotes'` — live-generated panel aggregating all `[^key]` footnote definitions from preceding chapters in order
- [ ] Each entry shows its source chapter name and the footnote text; clicking the chapter name navigates there
- [ ] On export the endnotes chapter renders the aggregated list; per-chapter footnotes are suppressed in chapter bodies when an endnotes chapter is present

#### Export handling
- [ ] **Markdown**: `[^key]` and `[@key]` preserved verbatim (Pandoc-compatible)
- [ ] **HTML**: `[^key]` → `<sup><a href="#fn-key">N</a></sup>` + `<section class="footnotes">` at chapter end with backlinks; bibliography entries get `id="ref-{key}"` anchors
- [ ] **DOCX**: `[^key]` uses `docx` `FootnoteReferenceRun` + footnotes section for native Word footnotes
- [ ] **EPUB**: footnotes use `epub:type="footnote"` aside elements with `↩` backlinks; bibliography entries get `id` anchors
- [ ] Per-export **citation style override**: selector in `ExportPanel.vue` defaulting to the story-level setting
