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
- [x] **Delete story** — button in the story list (with confirmation dialog) that removes the story from disk and localStorage and refreshes the list
- [x] **Story list sorting** — sort by last-modified date descending (then by creation timestamp embedded in story ID as stable tiebreaker)
- [x] **Story list timestamps** — show both date *and* time (e.g. `Feb 22, 2026 · 4:32 PM`) instead of date-only for created/last-modified labels

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
  - [x] Images (![alt](url))
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
- [ ] **Footnotes** (`[^1]` inline marker + `[^1]: footnote text` definition at end of chapter) — rendered at chapter bottom in preview; Pandoc-compatible syntax; see 12.8 for full spec
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
- [x] **Persist selected model** — save `currentModel` to `localStorage`; on startup, after the model list is fetched, auto-select the persisted model if it is still available, otherwise fall back to the first available model and notify the user

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
- **Bibliography & footnote export** — see Phase 12.8 for the source-of-truth spec. Summary: Markdown uses Pandoc `[^n]` syntax; HTML uses `<sup><a>` + `<section class="footnotes">` at chapter end + `id` anchors on bibliography entries; DOCX uses native Word footnotes (`FootnoteReferenceRun`) + formatted bibliography paragraphs; EPUB uses `epub:type="footnote"` footnotes with backlinks + `id`-anchored bibliography entries; `chapter://id#anchor` internal links rewritten to format-appropriate hrefs in all exporters

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
- [ ] User selects preferred icons for each slot, then replace Unicode glyphs across Sidebar, Editor header, ExportPanel, Settings modal
- [ ] Design new app icon (`.ico` / `.icns` / `.png` set) matching chosen aesthetic
- [ ] Ensure icons respect the current CSS `--text-primary` / `--accent-color` variables so they work in both dark and light themes

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
- [x] Editor status bar “⏱ History” button opens the modal
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
> Currently renaming is only available through the Chapter Metadata Editor (≡ → Title field).
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
    key: string           // cite key, e.g. 'smith2020' — used in [@smith2020] references
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
- [ ] `citationStyle: 'apa' | 'mla' | 'chicago-author-date' | 'chicago-notes' | 'turabian' | 'ieee'` added to story metadata; default `'apa'`; selector in Story Overview or story metadata panel
- [ ] `src/utils/citationFormatter.ts` — `formatInText(entry, style)` and `formatReference(entry, style)` for all six styles
- [ ] **APA 7th**: `(Author, Year)` in-text; `Author, A. A. (Year). *Title*. Publisher.` reference
- [ ] **MLA 9th**: `(Author page)` in-text; `Author. *Title*. Publisher, Year.` reference
- [ ] **Chicago Author-Date**: `(Author Year, page)` in-text; `Author. Year. *Title*. Publisher.` reference
- [ ] **Chicago Notes / Turabian**: `[@key]` references become footnote entries rather than inline citations; shortened repeat citations (`Ibid.`); bibliography entry identical to Chicago Author-Date format
- [ ] **IEEE**: `[1]` numeric bracket in-text; `[1] A. Author, "Title," *Journal*, vol. V, no. N, pp. P, Year.` reference
- [ ] `[@key]` syntax in markdown — renderer looks up entry by key in all bibliography chapters of the current story, formats per active style; unknown keys render in `--error-color` as `[?key]`
- [ ] Clicking a rendered `[@key]` in preview navigates to the bibliography chapter and scrolls to that entry via `chapter://biblio-chapter-id#ref-key`

#### Endnotes chapter type
- [ ] `chapterType: 'endnotes'` — live-generated panel (same pattern as TOC chapter) aggregating all `[^key]` footnote definitions from preceding chapters in order
- [ ] Each entry shows its source chapter name and the footnote text; clicking the chapter name navigates there
- [ ] On export the endnotes chapter renders the aggregated list; per-chapter footnotes are suppressed in chapter bodies when an endnotes chapter is present

#### Export handling
- [ ] **Markdown**: `[^key]` and `[@key]` preserved verbatim (Pandoc-compatible); bibliography entries rendered as the formatted reference list under the chapter heading
- [ ] **HTML**: `[^key]` → `<sup><a href="#fn-key">N</a></sup>` + `<section class="footnotes">` at chapter end with backlinks; bibliography entries get `id="ref-{key}"` anchors; `[@key]` in-text citations rendered and hyperlinked to the bibliography entry anchor
- [ ] **DOCX**: `[^key]` uses `docx` `FootnoteReferenceRun` + footnotes section for native Word footnotes (Chicago Notes style uses this path automatically); APA/MLA/IEEE render as parenthetical `TextRun`s instead; bibliography chapter as styled paragraph list; `[@key]` links encoded as `InternalHyperlink` to the bibliography bookmark
- [ ] **EPUB**: footnotes use `epub:type="footnote"` aside elements with `↩` backlinks; bibliography entries get `id` anchors; `chapter://id#ref-key` links rewritten to `chapterN.xhtml#ref-key` in the pre-pass
- [ ] Per-export **citation style override**: selector in `ExportPanel.vue` defaulting to the story-level setting, so authors can export in APA for one publisher and Chicago for another without touching story metadata

---

## Phase 13: Advanced Features & Extensions (Week 25+) ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features
- [ ] **Auto-updater** — configure Tauri's `updater` plugin to ship security patches and new releases. Requires: (1) finalise app rename, (2) host on GitHub with Releases for update manifests, (3) add `updater` section to `tauri.conf.json` with public signing key and GitHub endpoint.

---

## Phase 16: Cloud AI Model Integration ⏳ NOT STARTED

**Context:** Ollama covers local models well, but many users will want to use hosted cloud models (OpenAI, Anthropic, Google) — especially for higher-quality suggestions or when a machine is underpowered for local inference. This is a **BYO API key** integration; BlockBreaker will never proxy or hold user keys server-side.

### 16.1 Architecture
- [ ] Abstract the current Ollama client behind a `ModelProvider` interface:
  ```
  interface ModelProvider {
    id: string                                  // 'ollama' | 'openai' | 'anthropic' | 'google'
    name: string
    isAvailable(): Promise<boolean>
    listModels(): Promise<ModelInfo[]>
    streamCompletion(prompt: string, opts: CompletionOptions): AsyncIterable<string>
  }
  ```
- [ ] `aiStore` holds the active provider ID + per-provider API key (keys stored in encrypted localStorage or Tauri's `stronghold` plugin)
- [ ] The AI panel model selector groups models by provider

### 16.2 Provider Implementations
- [ ] **OpenAI** — `POST /v1/chat/completions` with `stream: true`; supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`
- [ ] **Anthropic (Claude)** — Messages API with streaming; supported models: `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-3`
- [ ] **Google (Gemini)** — `generateContentStream`; supported models: `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-2.5-pro`
- [ ] Each provider implementation lives in `src/api/providers/{name}.ts`

### 16.3 Settings UI
- [ ] New **AI Providers** section in Settings → AI tab
- [ ] Per-provider row: enable toggle, API key input (masked, paste-friendly), "Test connection" button, status indicator
- [ ] API keys never logged anywhere; connection test uses the cheapest available model (e.g. a 1-token completion)
- [ ] Warning banner: *"Your API key is stored locally on this device only and is never sent to any BlockBreaker server."*
- [ ] When a cloud provider is enabled and connected, its models appear in the model selector alongside (or instead of) local Ollama models

### 16.4 Context & Cost Considerations
- [ ] Cloud providers use the same `contextBuilder.ts` pipeline as Ollama
- [ ] Show an estimated **token count** for the assembled prompt in the Prompt Preview modal so users can reason about cost
- [ ] Per-provider token limits enforced (e.g. 128K for GPT-4o, 200K for Claude); `contextBuilder` respects the active model's limit
- [ ] Optional: running session cost estimator in editor status bar (tokens used × known pricing)

---

## Phase 17: Story Library & Series Management 🟡 IN PROGRESS

Support for multi-book series, sequels, and cross-story references — useful for authors working on a universe with multiple books.

### 17.1 In-Markdown Story Links (Primary Feature)

Mirrors the existing `chapter://` link scheme, but for navigating between stories in the library.

- [x] **`story://` URL scheme** — `[Link text](story://story-id)` in any chapter opens that story in the app. Also support `story://story-id/chapter-id` to land on a specific chapter.
- [x] `EditorPreview.vue` and `EditorSeamless.vue` handle the `story://` scheme and route it through the app instead of the system browser (same pattern as `chapter://`)
- [x] In seamless mode, `Ctrl+Click` on a `story://` link navigates to that story (consistent with `chapter://` behaviour)
- [ ] The **Insert Link** helper (if/when added) offers an autocomplete picker for stories and their chapters alongside the existing chapter picker
- [ ] Story titles are resolved at render time from the story library so the rendered link label can fall back to the story title when the href is an opaque ID
- [x] Broken `story://` links (story no longer exists) render with a visual error indicator (`class="link-broken"`) rather than silently going nowhere

### 17.2 Story Metadata Linking (Series Management)

Higher-level metadata for multi-book series — builds on 17.1.
- [ ] Add `linkedStoryIds: string[]` to story metadata — a list of other story IDs in the library this story is connected to
- [ ] Links are symmetric: linking Story A → B automatically adds B → A
- [ ] **Link type tags** per link: `sequel`, `prequel`, `companion`, `same-universe`, `alternate-timeline` (free text allowed too)
- [ ] Linked stories shown in a **Series** panel in the Story Overview sidebar section
- [ ] Clicking a linked story switches to that story (story breadcrumb in title bar)
- [ ] Optionally pull character profiles from linked stories into the AI context so the model is aware of shared characters
- [ ] `contextBuilder.ts` option: `includeLinkedCharacters?: boolean` — injects a `Shared characters:` block from linked stories
- [ ] Characters can be flagged `sharedAcrossSeries: true` in the character profile to be included automatically

### 17.3 Series Overview
- [ ] Dedicated **Series** view (accessible from the sidebar footer or Stories page) showing all stories in a linked cluster with reading-order arrows
- [ ] Drag-to-reorder reading order within a series
- [ ] Total series word count and per-book progress bars

---

## Phase 14: Help, Onboarding & Demo Story ✅ COMPLETE

### 14.1 First-Run Onboarding Tour ✅ COMPLETE
- [x] Detect first launch (flag in localStorage: `blockbreaker_onboarding_complete`)
- [x] Guided spotlight tour: 6-step overlay highlights each major UI region in sequence (sidebar, editor header, editor body, status bar, sidebar footer, finish)
- [x] Each step has a title, description, and Next / Skip buttons
- [x] Tour overlay dims the rest of the UI and draws a highlighted border around the active element (`OnboardingTour.vue`)
- [x] "Skip tour" exits immediately and marks onboarding complete
- [x] Re-launchable from **Settings → Help tab**

### 14.2 Demo / Help Story ✅ COMPLETE
- [x] A pre-bundled story defined as TypeScript constants in `src/utils/helpStory.ts`
- [x] Loaded automatically on first launch if no other stories exist; also accessible any time via the **?** button in the sidebar footer
- [x] 6 chapters: Welcome, Markdown Guide, AI Writing Guide, Keyboard Shortcuts, Sandbox — Try Markdown, Sandbox — Try AI
- [x] Read-only chapters display a banner (editing disabled with `contenteditable="false"` + banner)
- [x] The help story cannot be deleted from the stories list (shows an info notification instead)
- [x] **Reset help story** button in Settings → Help restores all read-only chapters; sandbox chapters left untouched
- [x] `storyStore.loadOrCreateHelpStory()` and `storyStore.resetHelpStory()` actions

### 14.3 Chapter Read-Only Flag ✅ COMPLETE
- [x] `isReadOnly?: boolean` on `Chapter` type in `storyStore`
- [x] `EditorSeamless` / `EditorMarkdown` — when true, `contenteditable="false"` and a read-only banner is shown
- [x] Read-only chapters are skipped by `onContentFromEditor` and `saveChapter` (no dirty state, no autosave, no history snapshot)
- [x] Toggle visible in the **Chapter Metadata Editor** (checkbox at the bottom of the form)
- [x] Extended chapter fields (`isReadOnly`, `isPlotOutline`, `contextTags`, `summary`, etc.) now correctly serialised/deserialised ( `storyManager.ts` + `loadStory` fix)

### 14.4 Settings → Help Tab ✅ COMPLETE
- [x] **Help** tab added to `Settings.vue` (sixth tab)
- [x] Contains: “Take the tour again” button, “Open help story” button, “Reset help content” button
- [x] App version number displayed (imported from `package.json`)

---

## Phase 15: Advanced Features & Extensions (Week 25+) ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features

---

## OVERALL PROGRESS SUMMARY

**Total Phases:** 17 (6 months planned + extensions)
**Completed Phases:** 1-2 (~40% core framework done)
**Partially Completed:** 3-7, 9-10 (most features implemented, some sub-items pending)
**Not Started:** 11-17 (polish, chapter management, advanced features, cloud AI, series management)

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
- 🟡 **Phase 10**: Export & Data Management - 99% (MD/HTML/DOCX/EPUB/import/backup/restore done; auto-backup timer pending)
- ⏳ **Phase 11**: Performance & Polish - NOT STARTED (icon overhaul planned)
- ✅ **Phase 12**: Chapter Management - IN PROGRESS (12.1 drag-to-reorder, 12.2 version history, 12.3 session undo/redo, 12.4 special chapter types, 12.6 inline title editing, 12.7 custom labels/numbering done; 12.5 translations + 12.8 bibliography/footnotes not started)
- ✅ **Phase 14**: Help & Onboarding - COMPLETE (14.1 tour, 14.2 demo story, 14.3 read-only flag, 14.4 Help settings tab)
- ⏳ **Phase 13**: Advanced Features - NOT STARTED
- ✅ **Phase 18**: Image Packing & Alt-Text Captions - COMPLETE
- ⏳ **Phase 16**: Cloud AI Integration - NOT STARTED
- ⏳ **Phase 17**: Story Library & Series Management - NOT STARTED

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
✅ Chapter version history (snapshots, Markdown preview, line-level diff, restore)
✅ Drag-to-reorder chapters via native pointer events
✅ Inline chapter title editing in sidebar\n✅ Chapter custom numbering & labels (chapterLabel field, auto-number fallback, export heading prefix, quick-preset buttons in metadata editor)
✅ Export: Markdown, HTML, DOCX; Import: Markdown; Backup & Restore
✅ Settings: font, autosave, AI, custom theme colors (per dark/light), spellcheck toggle
✅ Character and metadata management
✅ Keyboard shortcut system with defaults registered
✅ Dark/light theme toggle with per-theme CSS color overrides
✅ Notification system
✅ Ollama API client with connection checking
✅ Word count, line count, and character count tracking
✅ 149 unit tests (Vitest)

### Next Priorities:
1. **Phase 18** — Image packing & alt-text captions
2. **Phase 11.x** — Icon library evaluation & overhaul
3. **Phase 16** — Cloud AI model integration (OpenAI, Anthropic, Google)
4. **Phase 17** — Story library & series management
5. **Phase 11** — Performance & polish

---

## Phase 18: Image Packing & Alt-Text Captions ✅ COMPLETE

### Overview
Images in markdown are referenced by path (`./cover.jpg`, `/abs/path`, `https://...`).
On another machine — or in an export without the originals — those paths are broken.
"Packing" reads each image and stores it as a base64 data URL inside the story's
AppData folder.  The markdown **never changes**; packed data is looked up transparently
at render time.  Exports can inline the packed data, making them fully self-contained.

### 18.1 Packed Image Store
- [x] Create `stories/{storyId}/images.pack.json` with the schema below
- [x] Implement `src/utils/imagePackManager.ts` with:
  - [x] `loadPackFile(storyId)` — reads + parses pack file; returns empty store if absent
  - [x] `savePackFile(storyId, pack)` — writes JSON to disk
  - [x] `getPackedDataUrl(storyId, src)` — in-memory cache first, then disk; returns null if absent
  - [x] `packAllImages(storyId, markdownContents[])` — scans all chapter content for `![...](src)`
        patterns, de-dupes srcs, resolves each, skips any already packed whose source is unreadable,
        persists results; returns `{ total, packed, skipped, failed, failedSrcs[] }`
  - [x] `unpackImage(storyId, src)` — remove a single entry from the pack
  - [x] `clearPack(storyId)` — delete all packed entries (or the whole file)
  - [x] `evictPackCache(storyId)` — drop in-memory pack cache for a story (call on story unload)
- [x] Enforce safe re-pack rule: never overwrite an existing good packed entry with a failure result

**Storage file:** `stories/{storyId}/images.pack.json`

```jsonc
{
  "version": 1,
  "packedAt": "<ISO>",
  "images": {
    "cover.jpg": {
      "dataUrl": "data:image/jpeg;base64,/9j/...",
      "mime": "image/jpeg",
      "byteSize": 84231,
      "packedAt": "<ISO>",
      "sourceType": "local"   // "local" | "remote" | "absolute"
    },
    "https://example.com/banner.png": {
      "dataUrl": "data:image/png;base64,...",
      "mime": "image/png",
      "byteSize": 12400,
      "packedAt": "<ISO>",
      "sourceType": "remote"
    }
  }
}
```

**Key** is the raw src string from the markdown (relative path as-written, or full URL).
Absolute paths are normalised to forward slashes before being used as a key.

**imageUtils.ts** — update `resolveToDataUrl()` resolution order:
1. Check packed store (`getPackedDataUrl`) — use if present
2. Try local file read (existing logic)
3. For http/https: use URL directly (packing is optional for remote)
4. Return null on failure, mark `img.md-image-broken`

### 18.2 Pack UI
- [x] Add a **Pack Images** toolbar button to the Editor bottom status bar (visible when a story is loaded)
- [x] Use `mdiArchive` (filled) / `mdiArchiveOutline` (outlined) from `@mdi/js` as the pack status icon
- [x] Implement a **combined status widget** — a small pill/card housing two elements side by side:
  - [x] **Archive icon** (left):
    - `mdiArchiveOutline` — not packed or pack is stale; tooltip: _"Images not packed — click to pack"_ or _"Pack is out of date — click to update"_
    - `mdiArchive` (filled) — all images found in pack and up to date; tooltip: _"All images packed"_
  - [x] **Error icon** (right, only shown when there are unresolvable images):
    - `mdiImageBrokenVariant` next to a count badge inside the pill
    - tooltip on this segment: _"N images could not be resolved"_
  - [x] The two icon segments share a pill/card container with a subtle divider between them when both are visible
- [x] Clicking the archive icon segment opens the **Pack modal** (progress + results)
- [x] Clicking the error segment opens the same modal pre-scrolled to the failed list
- [x] Pack modal:
  - [x] Shows "Scanning chapters…" → "Packed N images (M skipped, K failed)"
  - [x] Lists unresolvable srcs so the author can fix or locate files
  - [x] "Force re-pack all" checkbox — ignores existing packed data and re-reads every source
  - [x] After success: re-checks pack status in the toolbar
- [x] **Stale-pack detection** (lightweight, on story load): compare set of unique image srcs in all
      chapters against keys in `images.pack.json`; set a reactive `packStatus` flag used by the widget

### 18.3 Resolution in Rendering
- [x] Update `imageUtils.ts` `resolveToDataUrl()` to check the pack store first (see §18.1)
- [x] EditorSeamless / EditorPreview require no template changes — `resolveLocalImages()` already walks `img[data-local-src]`
- [x] Wire `evictPackCache(storyId)` into the story unload / story-switch path in `storyStore`
- [x] **Export pipeline** (`exportImport.ts`):
  - [x] Before building export output, substitute `data-local-src` → packed data URL for all images
  - [x] This makes exported HTML/EPUB fully self-contained with no external file references

### 18.4 Alt-Text / Caption Mouseover
- [x] `renderImageHtml()` in `seamlessRenderer.ts`: add `title="${escapeHtml(alt)}"` when `alt` is non-empty
- [x] `editorCursor.ts` `buildStructuredHTML` image case: same — add `title` to the rendered `<img>`
- [x] `editorCursor.ts` `renderInlineContent()` inline image case: same

Result:
- **Seamless mode**: hovering the rendered image shows a native browser tooltip with the caption (works in Tauri WebView)
- **Preview mode**: same (images rendered from `token.rendered`)
- **Export**: `title` is included in exported HTML; browsers and EPUB readers that show title tooltips will display it

**Note:** `title` supplements `alt` — `alt` is the accessible description, `title` is the hover tooltip.  Both are set.

### 18.5 Implementation Order
- [x] §18.4 — Add `title` attr to all three image render paths (quick win, no dependencies)
- [x] §18.1 — `imagePackManager.ts` core logic (no UI dependency)
- [x] §18.1 — Update `imageUtils.ts` resolution order to check pack first
- [x] §18.2 — Pack status widget (pill/card with archive + error icons) in Editor toolbar
- [x] §18.2 — Pack modal (progress + results + failed list)
- [x] §18.2 — Stale-pack detection on story load
- [x] §18.3 — Wire `evictPackCache` into story unload
- [x] §18.3 — Export pipeline integration

### 18.6 File Layout

```
src/utils/imagePackManager.ts       ← new ✅
src/utils/imageUtils.ts             ← updated (pack-first resolution) ✅
src/utils/seamlessRenderer.ts       ← add title attr to renderImageHtml ✅
src/utils/editorCursor.ts           ← add title attr (buildStructuredHTML + renderInlineContent) ✅
src/components/Editor.vue           ← pack status widget in toolbar ✅
src/components/PackModal.vue        ← new ✅
stories/{storyId}/images.pack.json  ← new runtime file (not in git)
```

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
