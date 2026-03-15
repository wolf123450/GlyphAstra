# Changelog

All notable changes to Glyph Astra are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

---

## [0.2.1] — 2026-03-15

### Fixed
- **Auto-updater manifest** — `update-manifest` CI job now uses `listReleases` instead of `getReleaseByTag`, which was returning 404 for draft releases and preventing `latest.json` from being generated.

---

## [0.2.0] — 2026-03-14

### Added
- **Auto-update** — in-app update checking and one-click install via `tauri-plugin-updater`. The app checks for new releases on startup and shows a dismissible notification with release notes.
- **Application icons** — full icon set for all platforms (Windows ICO, macOS ICNS, Linux PNG sizes, Android/iOS variants) generated from a single master SVG.
- **PR check workflow** — GitHub Actions workflow that runs unit tests and a Vite build on every pull request.

### Core features (initial release baseline)
- Three editor modes: seamless hybrid WYSIWYG, raw markdown, rendered preview
- Split-view editor with synchronized scrolling
- Full markdown support: headings, bold/italic/strikethrough, lists, blockquotes, fenced code, horizontal rules, links, images
- Session undo/redo stack persistent across chapter switches
- AI ghost-text suggestions with multi-suggestion cycling (Ollama, OpenAI, Anthropic, Google Gemini)
- Writing Profiles (5 built-in + custom) and prompt preview
- Context-aware prompt builder with token budgeting
- Background chapter summary generation
- Context tags for filtering AI context by chapter
- Multi-story library with chapter management (create, rename, reorder, delete)
- Special chapter types: ToC, Cover, License, Illustration, Plot Outline
- Chapter version history with diff view and one-click restore
- Full-text search and replace across all chapters (with regex and case-sensitive modes)
- Export: Markdown, HTML, DOCX, EPUB 3.0
- Markdown / plain-text import
- Full story backup and restore (JSON)
- Image packing for portable story archives
- Dark / light themes with custom color overrides
- Configurable auto-save, font and editor settings
- Guided onboarding tour and built-in help story
- Keyboard shortcuts (Ctrl+N, Ctrl+S, Ctrl+F, Ctrl+,, Ctrl+Z, Ctrl+Space, Tab, Esc, ↑/↓)

---

[0.2.1]: https://github.com/wolf123450/GlyphAstra/releases/tag/v0.2.1
[0.2.0]: https://github.com/wolf123450/GlyphAstra/releases/tag/v0.2.0
