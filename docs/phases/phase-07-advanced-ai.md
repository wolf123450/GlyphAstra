# Phase 7: Advanced AI Features 🟡 PARTIAL

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

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

| Profile name | What it describes |
|---|---|
| **Lean & Direct** | Hemingway-inspired: short sentences, no adverbs, iceberg subtext, grounded in action and dialogue. |
| **Lush & Lyrical** | Rich sensory description, musicality in sentence rhythm, metaphor-heavy, slows down for emotional beats. |
| **Deep POV** | Tight third-person intimacy; free indirect discourse; thoughts and narration blur; characters notice things that reveal their psychology. |
| **Commercial Thriller** | Fast chapter breaks; short sentences under tension; clear cause-and-effect; forward momentum above all. |
| **Literary / Experimental** | Non-linear structure welcome; ambiguity valued; language as subject; image and symbol carry meaning. |

#### Implementation tasks

**`aiStore.ts`:**
- [x] Rename `AIStyle` interface to `WritingProfile`; add `isCustom?: boolean` (backward-compat alias `AIStyle = WritingProfile` kept)
- [x] Replace the five genre-preset `styles` with the five style-oriented profiles above
- [x] Add `addCustomProfile(p: WritingProfile)`, `updateProfile(name, updates)`, `deleteProfile(name)` actions
- [x] Persist `currentStyle` + custom profiles to `localStorage` (key `glyphastra_writing_profiles`)

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
