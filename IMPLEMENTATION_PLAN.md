# BlockBreaker Implementation Plan

## Project Overview
BlockBreaker is a desktop-based AI-assisted creative writing application combining a Vue.js frontend with Tauri for native desktop features and Ollama for local AI models.

**Tech Stack:**
- Frontend: Vue.js 3 + Tauri
- Backend Integration: Ollama API (local)
- Storage: Local file system + JSON metadata
- Styling: Dark/light mode compatible CSS

---

## Phase 1: Project Foundation & Setup ✅ COMPLETE

### 1.1 Development Environment & Project Structure ✅
- [x] Initialize Tauri project with Vue.js template
- [x] Set up project folder structure
  - `/src/components` - Vue components
  - `/src/pages` - Main pages
  - `/src/stores` - State management (Pinia) ✅
  - `/src/utils` - Helpers and utilities ✅
  - `/src/api` - Ollama API client ✅
  - `/src/styles` - Global styles
  - `/src-tauri/src` - Rust backend ✅
  - `/data` - Local story files
- [x] Configure Git and version control
- [x] Set up build and dev scripts

### 1.2 Tauri Backend Setup ✅
- [x] Configure Tauri security and permissions (file access, HTTP)
- [x] Set up Ollama connection module (Rust)
  - `check_ollama_connection()` command
  - `list_ollama_models()` command
- [x] Implement file system access layer
- [x] Create error handling and logging infrastructure

### 1.3 Frontend Scaffolding ✅
- [x] Set up Vue 3 with Composition API
- [x] Install and configure Pinia for state management
  - Created 5 stores: story, editor, settings, ai, ui
- [x] Create base layout components foundation ready
- [x] Set up dark/light mode toggle system (in uiStore)
- [x] Implement keyboard shortcut system foundation (in utils/keyboard.ts)

**Phase 1 Deliverables - COMPLETE:**
- ✅ Working dev environment with hot reload
- ✅ Tauri + Vue.js integration confirmed
- ✅ Pinia state management configured
- ✅ NPM build succeeds without errors
- ✅ Ollama API client ready (with connection check and model listing)
- ✅ File system utilities prepared
- ✅ Error handling and logging infrastructure in place
- ✅ Keyboard shortcut manager implemented

---

## Phase 2: Core UI Framework & Navigation (Week 3-4)

### 2.1 Main Application Shell ✅
- [x] Create main layout with 3-column structure:
  - Left sidebar (navigation) - **Sidebar.vue** ✅
  - Center panel (editor) - **Editor.vue** ✅
  - Optional right panel (story overview) - **Overview.vue** ✅
- [x] Implement responsive design for different screen sizes
- [x] Add minimize, maximize, close window controls

### 2.2 Theme System ✅
- [x] Implement dark/light mode toggle
- [x] Create consistent color palette
- [x] Add CSS variables for theming
- [x] Persist theme preference to local storage

### 2.3 Sidebar Navigation ✅
- [x] Create folder/chapter tree structure component
- [x] Implement folder expand/collapse
- [x] Add context menu (add chapter, delete, rename)
- [x] Visual indicators for:
  - Active chapter
  - Chapter status (draft, in-progress, complete)
  - Recent chapters (search functionality)

### 2.4 Keyboard Shortcuts ✅
- [x] Implement shortcut registry system
- [x] Core shortcuts:
  - Ctrl+N: New chapter
  - Ctrl+S: Save
  - Ctrl+F: Search
  - Ctrl+,: Settings
- [x] Story Overview opens via ◨ button in editor header (Tab no longer hijacked)

**Deliverables - COMPLETE:**
- ✅ Polished main UI shell
- ✅ Working navigation with full CRUD operations
- ✅ Theme system operational
- ✅ Obsidian-like aesthetic achieved
- ✅ All base components created and functional
- ✅ Frontend builds successfully

---

## Phase 3: File & Storage Management (Week 5-6) ✅ COMPLETE

### 3.1 Local File System Integration ✅
- [x] Story data structure in memory with localStorage persistence
- [x] Actual file system integration through Tauri (`filesystem.ts` with `@tauri-apps/plugin-fs`)
- [x] Create story directory structure on disk (`stories/{storyId}/`)
- [x] Implement file I/O operations through Tauri
- [x] AppData capabilities granted (`fs:allow-appdata-read-recursive`, write, meta)

### 3.2 Story Project System ✅
- [x] Create story initialization flow
- [x] Story metadata management (title, description, genre, tone, narrative voice)
- [x] Basic folder and chapter CRUD operations
- [x] Load existing story projects from disk via `fileStorage.listProjects()`

### 3.3 Chapter Operations ✅
- [x] Create new chapters programmatically
- [x] Rename chapters (memory only, not file system)
- [x] Delete chapters with proper handling
- [x] Chapter properties (status, word count, metadata)
- [x] Chapter content saved as individual `.md` files on disk

### 3.4 Auto-save System 🟡 PARTIAL
- [x] Debounced autosave framework implemented
- [x] Unsaved changes indicator in editor status bar
- [ ] Save conflict handling
- [ ] Recovery from crashes mechanism

**Current Status:**
- ✅ Story project system works in-memory with localStorage
- ✅ Chapter management fully operational (in-memory + disk)
- ✅ Dual-write persistence: file system primary, localStorage backup
- ✅ `fileStorage.ts` — disk layer: `saveStory`, `loadStory`, `listProjects`, `deleteStory`
- ✅ `filesystem.ts` — real Tauri fs I/O: `readFile`, `writeFileContent`, `ensureDir`, `pathExists`, `listDirectory`, `deleteFile`
- ✅ `storyStore.saveStory()` writes to both FS and localStorage
- ✅ `storyStore.loadStory()` reads from FS first, falls back to localStorage
- ✅ Auto-save system framework in place

---

## Phase 4: Markdown Editor & Preview System (Week 7-9) ✅ MOSTLY COMPLETE

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
  - [ ] Fenced code blocks (triple backtick) — **TODO**
  - [ ] Ordered lists (1. 2. 3.) — **TODO**
  - [ ] Blockquotes (> text) — **TODO**
  - [ ] Horizontal rules (---) — **TODO**
  - [ ] Links ([text](url)) — **TODO**
  - [ ] Images (![alt](url)) — **TODO**
  - [ ] Tables — **TODO**

### 4.3 Edit/Preview Toggle ✅
- [x] Full markdown mode (raw text with syntax)
- [x] Full preview mode (rendered HTML)
- [x] Seamless mode (hybrid showing markdown and preview)
- [x] Smooth transitions between modes
- [ ] Sync scroll between editor and preview (in seamless mode)

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
- [x] Internal chapter:// links navigate within the app
- [ ] Images (![alt](url))
- [ ] Tables (pipe syntax)

### 4.6 Markdown Reference Page ✅ COMPLETE
- [x] Dedicated modal (`MarkdownReference.vue`) showing all supported markdown syntax
- [x] Each entry: syntax example (code) + rendered result side-by-side
- [x] Grouped by category: Headings, Text Formatting, Lists, Blockquotes, Fenced Code, Links, Horizontal Rules, Combinations
- [x] Accessible from editor header (? button; also has Escape to close)
- [x] Teleport to body, backdrop click to close, matches app theme (CSS vars)

**Current Status:**
- ✅ Markdown editor with three modes operational
- ✅ Real-time preview system working
- ✅ Mode switching fully integrated
- 🟡 Basic markdown support complete, advanced features (links, images) pending
- ⏳ Inline seamless editing has framework but needs cursor sync refinement

---

## Phase 5: Story Context & Overview System (Week 10-11) ✅ MOSTLY COMPLETE

### 5.1 Story Overview Panel ✅
- [x] Create story overview component with:
  - [x] Story summary (textarea)
  - [x] Character profiles (list with add/edit/delete buttons)
  - [ ] Settings/locations (list) - not yet implemented
  - [ ] Plot points/themes (list) - not yet implemented
  - [ ] Narrative voice and tone settings - in metadata
- [x] Real-time updates to story metadata

### 5.2 Character Management ✅ PARTIAL
- [x] Character profile structure in store
  - [x] Name, description, appearance
  - [ ] Personality traits - not yet in UI
  - [ ] Role in story
  - [ ] First appearance chapter
- [ ] Character search integration (Phase 8)

### 5.3 Context Embedding System
- [ ] Summarize completed chapters for context
- [ ] Extract key information for prompts
- [ ] Context window management (token counting)

### 5.4 Story Metadata Display ✅
- [x] Total word count calculation
- [x] Chapter statistics
- [ ] Progress indicators/visualizations
- [x] Last modified dates

**Current Status:**
- ✅ Story overview panel fully visible and functional
- ✅ Character management basic UI implemented
- ✅ Story statistics (word count, chapter count) working
- 🟡 Character fields all available but UI only shows name/role
- ⏳ Context extraction for AI needs Phase 6+ completion

---

## Phase 6: Ollama Integration & Basic AI (Week 12-14) ✅ COMPLETE

### 6.1 Ollama Connection ✅
- [x] OllamaClient class created with connection checking
- [x] Tauri commands for checking connection and listing models
- [x] Live connection indicator in `AIPanel.vue` (green/red dot + re-check button)
- [x] Error handling for connection failures
- [x] User-facing hint when Ollama is offline (`ollama serve`)

### 6.2 Model Management ✅
- [x] List available local models via API
- [x] Model selection dropdown in AI panel
- [x] Model caching in aiStore

### 6.3 Inline Suggestion System ✅
- [x] `useAISuggestion.ts` composable — manages up to 3 suggestions, consumed index, cycling
- [x] Streaming completions fill suggestions sequentially (1 appears quickly, 2–3 in background)
- [x] Temperature varied per suggestion (+0.12 each) so they differ
- [x] Ghost text overlay in editor at cursor position (matches editor font/style)
- [x] Ctrl+Space — trigger generation
- [x] Tab — accept full remaining suggestion
- [x] Escape — dismiss
- [x] ↑/↓ arrows — switch between suggestions (when multiple available)
- [x] Left/Right arrows — dismiss suggestion, move cursor normally
- [x] Click — dismiss suggestion
- [x] Matching char typed — advances `consumed` counter, suggestion persists trimmed
- [x] Non-matching char — suggestion dismissed, char typed normally
- [x] `✦` toggle button in editor header opens AI settings panel

### 6.4 Style & Length Selection ✅
- [x] Style pills: mystical, sci-fi, romance, fantasy, noir
- [x] Suggestion length selector: Phrase (30 tokens), Sentence (80), Paragraph (200)
- [x] Selected style + length injected into generation prompt
- [x] `aiStore` extended with `currentStyle`, `suggestionTokens`

**Current Status:**
- ✅ Full inline ghost-text suggestion system (VSCode Copilot-style)
- ✅ `AIPanel.vue` is now a config-only panel (connection, model, style, length, keyboard reference)
- ✅ All keyboard shortcuts work in both Seamless and Markdown editor modes
- ✅ `editorStore.insertAtCursor()` used for acceptance
- ✅ Suggestion dismissed cleanly on click, chapter switch, or escape

---

## Phase 7: Advanced AI Features (Week 15-17) 🟡 PARTIAL

### Done in Phase 6:
- [x] Basic inline suggestion system (ghost text, cycling, char-matching)
- [x] Up to 3 sequential suggestions with varied temperatures

### Remaining:
- [ ] **Parallel** multi-suggestion generation (all 3 start at once, appear as each completes)
- [ ] **Context builder** (`utils/contextBuilder.ts`) — layered token-budget prompt assembler (see 7.z)
- [ ] **Chapter summaries** — AI-generated background summaries, cached per chapter (see 7.z)
- [ ] **Plot outline chapter** — `isPlotOutline` flag on chapter, injected as outline layer in context
- [ ] **Future chapter context** — included by default, global opt-out in AI settings, per-chapter opt-out
- [ ] **Per-chapter context exclusion** — chapters are tagged with one or more **context tags** (e.g. `POV: Alice`, `POV: Bob`, `Timeline A`); the AI panel has an active context selector; only chapters whose tags overlap with the active context, plus untagged chapters, are included in the prompt (see 7.y for tag UI)
- [ ] Custom suggestion count in settings (1–5)
- [ ] Suggestion history (re-trigger to see different set)
- [ ] Keyboard shortcut customization for AI triggers
- [ ] Character consistency checking (flag if generated text contradicts known characters)

### 7.z AI Context Architecture ✅ COMPLETE

#### Layered context stack (priority order, lower layers cut first if over token budget)

| Layer | Content | Size strategy |
|---|---|---|
| **System** | Role + instructions | Fixed ~200 tokens |
| **Writing profile** | Current WritingProfile prompt block | Fixed ~100 tokens |
| **Story metadata** | Title, genre, tone, characters | Fixed ~80 tokens |
| **Plot outline** | Content of the chapter flagged `isPlotOutline` | Summarized to ~300 tokens if long |
| **Past chapter summaries** | AI-generated summaries of chapters before the current one | ~50 tokens each, fill to budget |
| **Current chapter prefix** | Verbatim text in the current chapter before cursor | Dynamic — see below |
| **Future chapter summaries** | Summaries of chapters after the current one, labelled as planned | ~30 tokens each, opt-in by default |
| **Continuation marker** | `=== CONTINUE FROM HERE ===` | Fixed |

#### Current chapter prefix strategy
- Chapter ≤ ~2,000 chars → send verbatim
- Chapter > ~2,000 chars, cursor near start → verbatim prefix up to token budget
- Chapter > ~2,000 chars, cursor in middle/end → summary of everything before the last ~800 verbatim chars + those 800 chars verbatim, so the model always sees the immediate prose

#### Chapter summary caching
- New fields on `Chapter`: `summary?: string`, `summaryGeneratedAt?: number` (timestamp), `summaryContentHash?: string`, `summaryPaused?: boolean`, `summaryManuallyEdited?: boolean`
- Summary auto-triggers when: content delta since last summary ≥ ~250 chars AND cooldown of 5 minutes has elapsed
- Summary is a short Ollama call: `"Summarize this chapter in 2–3 sentences for use as writing context:"`
- If `summaryPaused = true`, auto-summary never fires regardless of changes
- If `summaryManuallyEdited = true`, the manual edit persists until the user explicitly hits **Regenerate** (not wiped by auto-trigger). Warning shown: *"This summary was manually edited and will not update automatically. Click Regenerate to replace it."*
- Summaries are persisted with chapter data in localStorage

#### Future chapters
- Sent under `=== PLANNED EVENTS (DO NOT REPEAT) ===` header so the model understands they are ahead
- Global opt-out toggle in AI settings: **Include future chapter context** (default: on)
- Per-chapter context filtering via **context tags** (see below) — chapters only appear in the prompt when their tags match the active context

#### Context tag system
- Each chapter has `contextTags: string[]` — a free-form list of tags (e.g. `POV: Alice`, `Timeline A`, `Subplot: Heist`)
- Untagged chapters are always included (they are treated as universal context)
- The AI panel has an **Active context** selector — a pill for each unique tag in the story plus an `All` pill (default)
- When `All` is selected: all chapters are included (existing behaviour)
- When a specific tag is selected: only chapters that carry that tag *or have no tags at all* are included in the context stack
- Multiple tags can be active simultaneously (multi-select) for cross-POV scenes
- Context tag selection persists per story (stored in `aiStore` or `storyStore` story metadata)

#### Plot outline chapter
- Any chapter can be flagged `isPlotOutline: true` via Chapter Metadata Editor
- When flagged, its content is injected as the outline layer (between story metadata and past summaries)
- If outline is short (< ~800 chars): verbatim; if longer: summarized
- Only one chapter should be the active plot outline (the first one flagged wins; a warning is shown if multiple are flagged)

#### `contextBuilder.ts` responsibilities
- Assemble the final prompt string from all layers
- Track running token estimate (chars ÷ 4)
- Fill layers in priority order, truncating lower-priority layers first when over the configured context window size
- Expose `buildContext(chapterId, cursorOffset, options)` → `string`

#### Implementation tasks
- [x] Add `summary`, `summaryGeneratedAt`, `summaryContentHash`, `summaryPaused`, `summaryManuallyEdited` to `Chapter` type in `storyStore`
- [x] Add `isPlotOutline`, `contextTags: string[]` to `Chapter` type
- [x] Add `activeContextTags: string[]` to story metadata (session ref in storyStore, default empty = All)
- [x] `contextBuilder.ts` filters past/future chapter lists by tag overlap before assembling prompt
- [x] Create `utils/contextBuilder.ts` with layered assembly + token budget
- [x] Create `utils/summaryManager.ts` — delta-watcher, cooldown timer, background Ollama call, hash check
- [x] Update `useAISuggestion.ts` `buildPrompt()` to call `contextBuilder`
- [x] Add **Include future chapter context** toggle to AI settings tab
- [x] Add **Active context** pill selector to `AIPanel.vue` (shows unique tags across all chapters; `All` pill = no filter)
- [x] Summary status shown in editor status bar: `⊙` button opens Chapter Metadata Editor
- [x] Full summary UI in Chapter Metadata Editor (see 7.y)

### 7.y Chapter Metadata Editor ✅ COMPLETE

A modal/panel accessible from the chapter context menu in the sidebar (and from the status bar summary button). Covers all per-chapter metadata in one place.

#### Fields
| Field | Input type | Notes |
|---|---|---|
| Title | Text input | Rename chapter |
| Status | Pills: Draft / In Progress / Complete | Source of the badge in sidebar |
| Chapter type | Pills: Normal / Plot Outline / Table of Contents / Cover / License / Illustration | `isPlotOutline` sets the context flag; others affect export rendering |
| Context tags | Tag input (free text, comma-separated, with suggestions from existing tags) | `contextTags: string[]` — e.g. `POV: Alice`, `Timeline A`; untagged = always included |
| **Summary section** | | |
| Summary text | Read-only textarea (editable when user clicks Edit) | Shows current cached summary |
| Generated timestamp | Text | "Generated 3 hours ago" / "Never" |
| Paused indicator | Checkbox: Pause auto-summary | When checked, auto-summary never fires |
| Manual edit warning | Banner | Shown when `summaryManuallyEdited = true`: *"Manual edit active — will not update automatically"* |
| Regenerate button | Button | Fires summary generation immediately; clears `summaryManuallyEdited` |

#### Implementation tasks
- [x] Create `ChapterMeta.vue` modal component
- [x] Wire to sidebar ≡ button on active chapter row ("Edit properties…")
- [x] Wire to status bar summary `⊙` button → opens metadata editor
- [x] Emit updates back through `storyStore.updateChapter()`

### 7.x Writing Profiles & AI Instruction Redesign ✅ COMPLETE

**Background / problem:**
The current five "style" pills (mystical, sci-fi, romance, fantasy, noir) describe *genres*, not *writing style*. They inject a single sentence like `Style: Write in a sci-fi style with advanced technology and futuristic concepts.` into the prompt. This conflates story genre (setting/world-building) with stylistic voice (how the prose sounds), and gives writers no visibility into or control over what is actually sent to the model.

**Goals:**
1. Rename the concept from "style" to **"Writing Profile"** throughout the UI.
2. Redesign the built-in presets around genuine prose-style dimensions, not genre themes.
3. Let users create, edit, and delete custom writing profiles.
4. Show the user the **full prompt preview** before/during generation.

#### Writing dimensions (the style axes that actually matter)

A writing profile should describe how the prose is written, independent of what genre the story is set in. Relevant dimensions include:

| Dimension | Low end | High end | Example prompt fragment |
|---|---|---|---|
| **Prose density** | Spare, minimalist | Lush, ornate | "Use spare, unadorned sentences — show don't tell." vs "Use rich, sensory prose with layered description." |
| **Sensory focus** | Abstract / intellectual | Grounded in senses | "Anchor every scene in at least two physical senses (touch, sound, smell)." |
| **Sentence rhythm** | Short, punchy, staccato | Long, flowing, syntactically complex | "Favour short declarative sentences and sentence fragments for impact." |
| **Pacing** | Fast-paced, lean | Slow, contemplative | "Keep the prose moving — cut any sentence that doesn't earn its place." |
| **Reading level / audience** | Simple, accessible (YA / commercial) | Dense, literary | "Write for an adult literary audience comfortable with complex vocabulary." |
| **Perspective interiority** | External / cinematic | Deep interiority | "Stay close to the POV character's inner voice; thoughts blend with narration." |
| **Dialogue style** | Sparse, only essential | Rich, character-revealing | "Dialogue should carry subtext; characters rarely say exactly what they mean." |

A profile doesn't need all dimensions — a few well-chosen sentences that capture a real author's voice or a target style are more useful than a long checklist.

#### Built-in profiles to replace the current genre pills

Replace the five genre pills with style-oriented profiles. Story genre continues to come from story metadata (already injected as `Genre: ${meta.genre}`), so profiles should not duplicate it.

Proposed replacements:

| Profile name | What it describes |
|---|---|
| **Lean & Direct** | Hemingway-inspired: short sentences, no adverbs, iceberg subtext, grounded in action and dialogue. |
| **Lush & Lyrical** | Rich sensory description, musicality in sentence rhythm, metaphor-heavy, slows down for emotional beats. |
| **Deep POV** | Tight third-person intimacy; free indirect discourse; thoughts and narration blur; characters notice things that reveal their psychology. |
| **Commercial Thriller** | Fast chapter breaks; short sentences under tension; clear cause-and-effect; forward momentum above all. |
| **Literary / Experimental** | Non-linear structure welcome; ambiguity valued; language as subject; image and symbol carry meaning. |

The current `prompt` field on `AIStyle` becomes a multi-sentence instruction block rather than one line.

#### Implementation tasks

**`aiStore.ts`:**
- [x] Rename `AIStyle` interface to `WritingProfile`; add `isCustom?: boolean` (backward-compat alias `AIStyle = WritingProfile` kept)
- [x] Replace the five genre-preset `styles` with the five style-oriented profiles above
- [x] Add `addCustomProfile(p: WritingProfile)`, `updateProfile(name, updates)`, `deleteProfile(name)` actions
- [x] Persist `currentStyle` + custom profiles to `localStorage` (key `blockbreaker_writing_profiles`)

**`useAISuggestion.ts` → `buildPrompt()`:**
- [x] Change profile injection from the single-line `Style: ${style.prompt}.` to a multi-sentence block under a `Writing style instructions:` header
- [x] Keep `Genre:` from story metadata separate so prose style and genre remain orthogonal
- [x] Expose `buildPrompt()` and add `getLastPrompt()` getter so the UI can show a preview

**`AIPanel.vue`:**
- [x] Replace the current hard-coded pill row with a dynamic pill list driven by `aiStore.styles`
- [x] Add a **"View prompt"** button (`⊙`) that opens `PromptPreview.vue`
- [x] Add a **"+ New profile"** button that opens `WritingProfileEditor.vue`
- [x] Per-profile `⊙` / `✎` button shows profile instructions or opens edit modal

**Profile editor modal (`WritingProfileEditor.vue`):**
- [x] Fields: **Name** (text), **Description** (short subtitle shown on pill), **Prompt instructions** (multi-line textarea)
- [x] Live character/token estimate below the textarea
- [x] Quick-starter pill buttons append common style phrases to the instructions field
- [x] Save / Cancel / Delete buttons (Delete only available for custom profiles)
- [x] Built-in profiles open in read-only view mode

**Settings → AI tab:**
- [ ] Default writing profile selector (replaces `defaultCompletionStyle`)
- [ ] Link to manage profiles (opens profile editor)

**Prompt preview modal (`PromptPreview.vue`):**
- [x] Shows the complete prompt string as it would be sent: system context, story metadata, writing profile block, `=== TEXT ALREADY WRITTEN ===` section, continuation marker
- [x] Colour-coded sections (system / meta / style / context / continuation marker)
- [x] Read-only, monospace, scrollable; context section capped at 180px with its own scroll
- [x] "Copy to clipboard" button; ⟳ Refresh builds a fresh prompt from current editor content

---

## Phase 8: Search & Navigation Features (Week 18-19) ✅ MOSTLY COMPLETE

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

---

## Phase 10: Export & Data Management ⏳ IN PROGRESS

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

### Technical Notes
- `plugin-dialog` Rust crate added to `Cargo.toml`, registered in `lib.rs`
- Capabilities: `dialog:allow-open`, `dialog:allow-save`, `fs:allow-home-read-recursive`, `fs:allow-home-write-recursive`
- `filesystem.ts` extended with `writeAbsoluteFile(path, content)`, `readAbsoluteFile(path)`, `writeBinaryAbsolute(path, data: Uint8Array)`
- `backupRestore.ts` — uses `writeAbsoluteFile` + `readAbsoluteFile`; backup format v1 includes all `Chapter` fields (AI metadata preserved)
- `uiStore.activePanel` extended with `'export'` type
- `ExportPanel.vue` shown as right panel (same architecture as `AIPanel.vue`)
- Export button `⬡` added to editor header

---

## Phase 11: Performance Optimization & Polish (Week 23-24) ⏳ NOT STARTED

- [ ] Lazy loading for large stories
- [ ] Virtual scrolling for long chapter lists
- [ ] Memory optimization
- [ ] Caching strategies
- [ ] UI polish and animations
- [ ] Loading states and transitions
- [ ] Accessibility (WCAG compliance)
- ✅ Unit and integration test suite (Vitest, 149 tests across seamlessRenderer, editorCursor, CRLF tokenisation)

---

## Phase 12: Chapter Management ⏳ NOT STARTED

Substantial standalone features grouped to avoid fragmented implementation.

### 12.1 Drag-to-Reorder Chapters
- [ ] Drag handle on each sidebar chapter row
- [ ] Visual drop indicator between chapters
- [ ] `storyStore.reorderChapters()` action updates chapter order
- [ ] Consider `@vueuse/core` `useSortable` or `SortableJS`

### 12.2 Chapter Version History & Timeline
- [ ] Store diffs (or snapshots) of chapter content on each save (up to a configurable limit)
- [ ] Timeline slider UI: drag to travel back/forward through edit history
- [ ] **Age heatmap view**: colour text by how recently it was written/modified (recently written = bright, older = faded); alternately highlight frequently-changed text
- [ ] Diff view: side-by-side or inline comparison between any two history points
- [ ] Restore from a history point

### 12.3 Session Undo / Redo
- [ ] Persistent undo/redo stack beyond the browser's native `contenteditable` history
- [ ] Survives chapter switches within a session
- [ ] `Ctrl+Z` / `Ctrl+Shift+Z`

### 12.4 Special Chapter Types (UI & Export Rendering)
- [ ] **Table of Contents** — auto-generated from chapter titles; renders as a formatted list in preview/export
- [ ] **Cover** — full-page image or styled title block in export
- [ ] **License / Publisher Info** — formatted legal block
- [ ] **Illustration** — embeds an image file; caption field; rendered inline in preview and export
- [ ] Chapter type icons shown in sidebar next to title

### 12.5 Translations
- [ ] A chapter can have one or more translation variants (language tag + content)
- [ ] AI-assisted auto-translation via Ollama (long-term)
- [ ] Manual translation entry
- [ ] Language selector in editor header when translations exist

### 12.6 Inline Chapter Title Editing
> Currently renaming is only available through the Chapter Metadata Editor (≡ → Title field).
- [ ] Mouseover on a chapter name in the sidebar reveals an edit (✎) indicator icon.
- [ ] Single-click on a chapter name in the sidebar activates an in-place `<input>` replacing the title text
- [ ] `Escape` cancels and restores the original name; `Enter` or blur commits via `storyStore.updateChapter()`
- [ ] Input auto-selects all text on activation for fast replacement
- [ ] No rename occurs if the trimmed value is empty or unchanged
- [ ] Visual affordance: cursor changes to `text` on hover over the title span

---

## Phase 13: Advanced Features & Extensions (Week 25+) ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features

---

## Phase 14: Help, Onboarding & Demo Story ⏳ NOT STARTED

### 14.1 First-Run Onboarding Tour
- [ ] Detect first launch (flag in localStorage: `blockbreaker_onboarding_complete`)
- [ ] Guided spotlight tour: step-by-step overlay highlights each major UI region in sequence
  - Step 1: Sidebar — chapters, context menu, new chapter button
  - Step 2: Editor header — mode switcher, word count, AI toggle, export
  - Step 3: Seamless editor — markdown rendering, cursor, typing
  - Step 4: AI panel — writing profiles, model selection, Ctrl+Space to trigger
  - Step 5: Search panel — Ctrl+F, TOC mode, replace
  - Step 6: Settings — Ctrl+, shortcut, theme, fonts
- [ ] Each step has a title, description, and Next / Skip buttons
- [ ] Tour overlay dims the rest of the UI and draws a highlighted border around the active element
- [ ] "Skip tour" exits immediately and marks onboarding complete
- [ ] Re-launchable: **Settings → Shortcuts tab** (or a dedicated Help tab) has a "Take the tour again" button

### 14.2 Demo / Help Story
- [ ] A pre-bundled story (`helpStory`) shipped with the app (in `/public/help-story/` or embedded in code)
- [ ] Loaded automatically on first launch if no other stories exist; also accessible any time via a `?` / Help button in the sidebar footer
- [ ] The story is structured as a set of chapters that double as a living reference:

| Chapter | Content | Editable? |
|---|---|---|
| Welcome to BlockBreaker | App overview, what the app does, quick-start tips | 🔒 Read-only |
| Markdown Guide | Full markdown syntax reference with live examples (the same content as `MarkdownReference.vue`) | 🔒 Read-only |
| AI Writing Guide | How writing profiles work, how to trigger suggestions, prompt preview | 🔒 Read-only |
| Keyboard Shortcuts | Full shortcut reference | 🔒 Read-only |
| Sandbox — Try Markdown | Blank/starter chapter for practising markdown | ✏️ Editable |
| Sandbox — Try AI | Starter prose for testing AI suggestions | ✏️ Editable |

- [ ] Read-only chapters display a banner: *"This is a reference chapter — editing is disabled to preserve the help content."*
- [ ] Sandbox chapters display a banner: *"This is a practice chapter — feel free to edit or delete content here."*
- [ ] The help story cannot be deleted from the stories list (or shows a confirmation warning that it can be recreated from Help)
- [ ] A **Reset help story** button in Settings restores the bundled content to all read-only chapters (sandbox chapters are left untouched)

### 14.3 Chapter Read-Only Flag
- [x] Add `isReadOnly?: boolean` to `Chapter` type in `storyStore` *(added in Phase 7.z)*
- [ ] `EditorSeamless` / `EditorMarkdown` check this flag; when true, the editor `contenteditable` is disabled and a banner is shown
- [ ] Read-only chapters are skipped by the auto-save system
- [ ] The flag is visible (and toggleable for non-help stories) in the Chapter Metadata Editor (7.y)
- [ ] Export includes read-only chapters normally (they are content, just locked in-app)

### 14.4 Settings → Help Tab
- [ ] Add a sixth tab to `Settings.vue`: **Help**
- [ ] Contains: "Take the tour again" button, "Open help story" button, "Reset help story" button, link to project README / changelog
- [ ] App version number displayed here

### Technical Notes
- Help story content is defined as a TypeScript constant (no disk files needed) and hydrated into `storyStore` on first launch or on reset
- `isReadOnly` is the only new field required on `Chapter` for this phase; it is reusable for translated chapters, template chapters, etc. (Phase 12.5)
- The spotlight tour uses a simple Vue component (`OnboardingTour.vue`) with a `steps` array; it does not require a third-party library

---

## Phase 15: Advanced Features & Extensions (Week 25+) ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features

---

## OVERALL PROGRESS SUMMARY

**Total Phases:** 15 (6 months planned + extensions)
**Completed Phases:** 1-2 (~40% core framework done)
**Partially Completed:** 3-7, 9-10 (most features implemented, some sub-items pending)
**Not Started:** 12-13 (chapter management, advanced features)

### Current Implementation Status:
- ✅ **Phase 1**: Foundation - COMPLETE
- ✅ **Phase 2**: UI Framework - COMPLETE
- ✅ **Phase 3**: File Storage - COMPLETE (dual-write FS + localStorage, Tauri plugin-fs wired)
- ✅ **Phase 4**: Markdown Editor - COMPLETE (three modes, full inline markdown, all block types, markdown reference modal)
- ✅ **Phase 5**: Story Overview - 80% (panel functional, some fields pending)
- ✅ **Phase 6**: Ollama Integration - COMPLETE (inline ghost-text suggestions, config panel)
- ✅ **Phase 7**: Advanced AI - 90% (writing profiles, context builder, summaries, chapter metadata editor done; parallel suggestions pending)
- 🟡 **Phase 8**: Search - 90% (full-text search, TOC, replace, regex, case-sensitive done; badge + advanced filters pending)
- ✅ **Phase 9**: Settings & Customization - COMPLETE (5-tab modal, all settings persisted, custom theme colors)
- 🟡 **Phase 10**: Export & Data Management - 95% (MD/HTML/DOCX/import/backup/restore done; auto-backup timer pending)
- ⏳ **Phase 11**: Performance & Polish - NOT STARTED
- ⏳ **Phase 12**: Chapter Management - NOT STARTED
- ⏳ **Phase 13**: Advanced Features - NOT STARTED
- ⏳ **Phase 14**: Help & Onboarding - NOT STARTED
- ⏳ **Phase 15**: Extensions - NOT STARTED

### Key Achievements:
✅ Full Vue.js + Tauri desktop application framework
✅ Three-column responsive layout with sidebar, editor, and overview
✅ Pinia state management with 5 stores (story, editor, settings, ai, ui)
✅ Three markdown editor modes (seamless, markdown, preview)
✅ Story/chapter management system with in-memory + localStorage persistence
✅ Writing Profiles system with built-in + custom profiles, prompt preview, profile editor
✅ AI context architecture: layered prompt stack, token budget, chapter summaries, context tag filtering
✅ Chapter Metadata Editor (title, status, type, context tags, AI summary management)
✅ Full-text search panel with regex, case-sensitive, and search & replace
✅ Export: Markdown, HTML, DOCX; Import: Markdown; Backup & Restore (full-fidelity .json backups preserving AI metadata)
✅ Settings: font, autosave, AI, custom theme colors (per dark/light), spellcheck toggle
✅ Character and metadata management
✅ Keyboard shortcut system with defaults registered
✅ Dark/light theme toggle with per-theme CSS color overrides
✅ Notification system
✅ Ollama API client with connection checking
✅ Word count, line count, and character count tracking
✅ 149 unit tests (Vitest)

### Next Priorities:
1. **Phase 12.1** — Drag-to-reorder chapters
2. **Phase 14** — Help & Onboarding (demo story, onboarding tour)
3. **Phase 11** — Performance & Polish

---

## Technical Architecture Summary

### State Management (Pinia)
- `storyStore` - Story metadata and structure
- `editorStore` - Current editor state (content, cursor, mode)
- `settingsStore` - User preferences
- `aiStore` - AI models, settings, completions
- `uiStore` - UI state (theme, active chapter, etc.)

### Key APIs/Modules
- `ollama.ts` - Ollama API client
- `filesystem.ts` - File operations via Tauri
- `markdown.ts` - Markdown rendering and parsing
- `storage.ts` - Local storage management
- `context-builder.ts` - AI context assembly

### Storage Structure
```
story-project/
  story.json              # Metadata
  chapters/
    chapter-1/
      content.md          # Chapter content
      metadata.json       # Chapter properties
    chapter-2/
      content.md
      metadata.json
  backups/                # Automatic backups
  .backup/                # Auto-save recovery
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Ollama not installed | Check at startup, show setup guide |
| Large document performance | Pagination, lazy loading, virtual scrolling |
| Context window limitations | Automatic summarization, selective context building |
| File system access issues | Comprehensive error handling, recovery options |
| Data loss | Auto-save, versioning, backup system |
| Complex markdown | Progressive feature additions, test coverage |

---

## Success Metrics

- ✅ Desktop application launches without errors
- ✅ Story projects create and persist correctly
- ✅ Markdown rendering smooth and accurate
- ✅ AI completions generate in <10 seconds
- ✅ No lag with stories up to 100K words
- ✅ Seamless Tauri-Vue integration
- ✅ Professional UI matching Obsidian aesthetic
- ✅ All core features working without bugs

---

## Dependencies & Prerequisites

Before starting development:
1. Ollama installed and running locally
2. Node.js 16+ and npm/yarn
3. Rust 1.70+ (for Tauri)
4. Visual Studio Build Tools (Windows)
5. A code editor (VS Code recommended)

---

## Estimated Timeline

- **Total Duration:** 24-26 weeks (6 months) for core features
- **MVP (Phase 1-7):** 14 weeks (3.5 months)
- **Full Release (Phase 1-11):** 24 weeks (6 months)
- **Plus advanced features:** 25+ weeks

(Timelines are estimates and can vary based on complexity and team size)
