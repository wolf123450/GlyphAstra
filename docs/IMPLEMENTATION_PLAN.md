# Glyph Astra Implementation Plan

## Project Overview
Glyph Astra is a desktop-based AI-assisted creative writing application combining a Vue.js frontend with Tauri for native desktop features and Ollama for local AI models.

**Tech Stack:**
- Frontend: Vue.js 3 + Tauri
- Backend Integration: Ollama API (local) + Cloud providers (OpenAI, Anthropic, Google)
- Storage: Local file system + JSON metadata + localStorage backup
- Styling: Dark/light mode compatible CSS

---

## Phase Index

Each phase is documented in its own file under [`docs/phases/`](phases/).

| Phase | Status | Description | Doc |
|---|---|---|---|
| **1–3** | ✅ Complete | Foundation, UI Framework, Storage | [phase-01-03-foundation.md](phases/phase-01-03-foundation.md) |
| **4** | ✅ Mostly Complete | Markdown Editor & Preview | [phase-04-markdown-editor.md](phases/phase-04-markdown-editor.md) |
| **5–6** | ✅ Complete | Story Overview & Ollama Integration | [phase-05-06-overview-ollama.md](phases/phase-05-06-overview-ollama.md) |
| **7** | 🟡 90% | Advanced AI (writing profiles, context, summaries) | [phase-07-advanced-ai.md](phases/phase-07-advanced-ai.md) |
| **8–9** | ✅ Mostly Complete | Search & Settings | [phase-08-09-search-settings.md](phases/phase-08-09-search-settings.md) |
| **10** | 🟡 99% | Export & Data Management | [phase-10-export.md](phases/phase-10-export.md) |
| **11–12** | 🟡 In Progress | Performance/Polish & Chapter Management | [phase-11-12-polish-chapters.md](phases/phase-11-12-polish-chapters.md) |
| **13–15** | ⏳ Partial | Advanced Features & Help/Onboarding | [phase-13-15-advanced-help.md](phases/phase-13-15-advanced-help.md) |
| **16** | 🟡 85% | Cloud AI Model Integration | [phase-16-cloud-ai.md](phases/phase-16-cloud-ai.md) |
| **17** | 🟡 In Progress | Story Library & Series Management | [phase-17-series.md](phases/phase-17-series.md) |
| **18** | ✅ Complete | Image Packing & Alt-Text Captions | [phase-18-image-packing.md](phases/phase-18-image-packing.md) |
| **19** | ⏳ Not Started | Bug Fixes & UI Polish | [phase-19-bugfixes-polish.md](phases/phase-19-bugfixes-polish.md) |

**Other documentation:**
- [Code Review](CODE_REVIEW.md) — full security & architecture review (2026-02-28)

---

## Overall Progress Summary

### Current Implementation Status
- ✅ **Phase 1**: Foundation — COMPLETE
- ✅ **Phase 2**: UI Framework — COMPLETE
- ✅ **Phase 3**: File Storage — COMPLETE (dual-write FS + localStorage, Tauri plugin-fs wired)
- ✅ **Phase 4**: Markdown Editor — COMPLETE (three modes, full inline markdown, all block types, markdown reference modal)
- ✅ **Phase 5**: Story Overview — 80% (panel functional, some fields pending)
- ✅ **Phase 6**: Ollama Integration — COMPLETE (inline ghost-text suggestions, config panel)
- ✅ **Phase 7**: Advanced AI — 90% (writing profiles, context builder, summaries, chapter metadata editor done; parallel suggestions pending)
- 🟡 **Phase 8**: Search — 90% (full-text search, TOC, replace, regex, case-sensitive done; badge + advanced filters pending)
- ✅ **Phase 9**: Settings & Customization — COMPLETE (5-tab modal, all settings persisted, custom theme colors)
- 🟡 **Phase 10**: Export & Data Management — 99% (MD/HTML/DOCX/EPUB/import/backup/restore done; auto-backup timer pending)
- ⏳ **Phase 11**: Performance & Polish — NOT STARTED (icon overhaul planned)
- 🟡 **Phase 12**: Chapter Management — IN PROGRESS (drag-to-reorder, version history, session undo/redo, special chapter types, inline title editing, custom labels/numbering done; translations + bibliography/footnotes not started)
- ✅ **Phase 14**: Help & Onboarding — COMPLETE (tour, demo story, read-only flag, Help settings tab)
- ⏳ **Phase 13**: Advanced Features — NOT STARTED
- ✅ **Phase 18**: Image Packing & Alt-Text Captions — COMPLETE
- 🟡 **Phase 16**: Cloud AI Integration — 85% (ModelProvider interface, OpenAI/Anthropic/Google providers with streaming, Settings UI with API key management & test buttons done; token count display, per-model context limits, cost estimator pending)
- 🟡 **Phase 17**: Story Library & Series Management — IN PROGRESS (story:// links done; metadata linking + series view not started)
- ⏳ **Phase 19**: Bug Fixes & UI Polish — 5/10 done (19.8 ✅; 19.1 ✅; 19.2 ✅; 19.3 ✅; 19.4 resizable panes ✅; remaining: drop cap, minimal borders, active icon highlighting, formatting toolbar, VS Code extension research)

### Key Achievements
- Full Vue.js + Tauri desktop application framework
- Three-column responsive layout with sidebar, editor, and overview
- Pinia state management with 5 stores (story, editor, settings, ai, ui)
- Three markdown editor modes (seamless, markdown, preview)
- Story/chapter management system with dual-write persistence
- Writing Profiles system with built-in + custom profiles, prompt preview, profile editor
- AI context architecture: layered prompt stack, token budget, chapter summaries, context tag filtering
- Chapter Metadata Editor (title, status, type, context tags, AI summary management)
- Full-text search panel with regex, case-sensitive, and search & replace
- Chapter version history (snapshots, Markdown preview, line-level diff, restore)
- Drag-to-reorder chapters via native pointer events
- Inline chapter title editing in sidebar
- Chapter custom numbering & labels
- Export: Markdown, HTML, DOCX, EPUB; Import: Markdown; Backup & Restore
- Settings: font, autosave, AI, custom theme colors (per dark/light), spellcheck toggle
- Character and metadata management
- Keyboard shortcut system with defaults registered
- Dark/light theme toggle with per-theme CSS color overrides
- Notification system
- Multi-provider AI support (Ollama, OpenAI, Anthropic, Google)
- Image packing for portable, self-contained stories
- 149+ unit tests (Vitest)

### Next Priorities
1. **Phase 19** — Bug fixes & UI polish
2. **Phase 11.x** — Icon library evaluation & overhaul
3. **Phase 16.4** — Token count display & cost estimator (remaining Phase 16 work)
4. **Phase 17** — Story library & series management
5. **Phase 11** — Performance & polish

---

## Technical Architecture Summary

### State Management (Pinia)
- `storyStore` — Story metadata and structure
- `editorStore` — Current editor state (content, cursor, mode)
- `settingsStore` — User preferences
- `aiStore` — AI models, settings, completions
- `uiStore` — UI state (theme, active panel, etc.)

### Key Modules
- `api/providers/` — AI provider implementations (Ollama, OpenAI, Anthropic, Google)
- `utils/storage/filesystem.ts` — File operations via Tauri
- `utils/editor/markdownRenderer.ts` — Markdown rendering and parsing
- `utils/storage/storage.ts` — localStorage management
- `utils/ai/contextBuilder.ts` — AI context assembly
- `utils/storage/persistenceService.ts` — Coordinated save/load/delete facade

### Storage Structure
```
stories/{storyId}/
  story.json                 # Metadata, characters, chapter list
  chapters/{chapterId}.md    # Chapter content
  history/{chapterId}.json   # Version history snapshots
  images.pack.json           # Packed image data (optional)
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

1. Node.js 18+ and npm
2. Rust 1.70+ (for Tauri)
3. Visual Studio Build Tools (Windows)
4. Ollama (optional, for local AI models)
5. VS Code recommended

---

## Estimated Timeline

- **Total Duration:** 24–26 weeks (6 months) for core features
- **MVP (Phase 1–7):** 14 weeks (3.5 months)
- **Full Release (Phase 1–11):** 24 weeks (6 months)
- **Plus advanced features:** 25+ weeks
