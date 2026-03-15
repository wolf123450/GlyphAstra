# Glyph Astra

<p align="center">
  <img src="public/icon-master.png" alt="Glyph Astra" width="128" />
</p>

[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?logo=github-sponsors)](https://github.com/sponsors/wolf123450)

A desktop AI-assisted creative writing application built with **Vue 3**, **Tauri 2**, and **TypeScript**. Glyph Astra combines a distraction-free markdown editor with intelligent AI writing assistance powered by local models (Ollama) or cloud providers (OpenAI, Anthropic, Google Gemini).

## Features

### Editor
- **Three editing modes** — seamless (hybrid WYSIWYG), raw markdown, and rendered preview
- **Full markdown support** — headings, bold/italic/strikethrough, ordered & unordered lists, blockquotes, fenced code blocks, horizontal rules, links, images, and inline combinations
- **Split-view** — side-by-side editor + live preview with synchronized scrolling
- **Markdown reference** — in-app cheat sheet accessible from the editor toolbar
- **Session undo/redo** — persistent undo stack that survives chapter switches within a session
- **Spellcheck toggle** — enable or disable browser spellcheck from settings

### AI Writing Assistance
- **Inline ghost-text suggestions** — VS Code Copilot-style completions at the cursor position
- **Multiple suggestions** — up to 3 suggestions with varied temperature; cycle with arrow keys
- **Writing Profiles** — five built-in prose-style profiles (Lean & Direct, Lush & Lyrical, Deep POV, Commercial Thriller, Literary/Experimental) plus custom user-created profiles
- **Prompt preview** — view the full prompt exactly as it will be sent to the model, colour-coded by section
- **Context-aware generation** — layered context builder assembles story metadata, writing profile, plot outline, chapter summaries, and surrounding prose into a token-budgeted prompt
- **Chapter summaries** — background AI-generated summaries cached per chapter, with manual edit and pause controls
- **Context tags** — tag chapters (e.g. `POV: Alice`, `Timeline A`) and filter which chapters are included in AI context
- **Multi-provider support** — Ollama (local), OpenAI, Anthropic, and Google Gemini via a unified provider interface with BYO API keys

### Story Management
- **Multi-story library** — create, switch between, and delete stories from the story picker
- **Chapter organization** — create, rename, reorder (drag-and-drop), and delete chapters
- **Special chapter types** — Table of Contents, Cover, License, Illustration, Plot Outline, and standard chapters
- **Chapter labels** — custom display labels (Prologue, Epilogue, Part I, etc.) with auto-numbering fallback
- **Story metadata** — title, summary, genre, tone, narrative voice, and character profiles
- **Chapter version history** — snapshot-based history with markdown preview, line-level diff view, and one-click restore
- **Inline title editing** — click a chapter name in the sidebar to rename it in place
- **Cross-story links** — `story://` and `chapter://` URL schemes for navigating between stories and chapters

### Search & Navigation
- **Full-text search** — live search across all chapters with highlighted context snippets
- **Regex & case-sensitive modes** — toggle regex and exact-case matching
- **Search & Replace** — replace individual matches or all matches across the entire story
- **Table of contents** — chapter list with word counts and status badges when search is empty
- **Keyboard navigation** — arrow keys to browse results, Enter to jump, Esc to close

### Export & Import
- **Markdown** — single chapter or full story as `.md`
- **HTML** — styled, print-ready HTML with `@media print` page breaks
- **DOCX** — Word document with title page and chapter headings
- **EPUB 3.0** — e-reader format with embedded styles, image support, and navigation
- **Markdown import** — import `.md` / `.txt` files as new chapters
- **Backup & Restore** — full story backup to JSON with complete metadata and AI state preservation

### Image Management
- **Image packing** — pack all referenced images into a portable archive (`images.pack.json`) so stories are self-contained across machines
- **Pack status widget** — toolbar indicator shows pack state and unresolvable image count
- **Alt-text tooltips** — image captions shown on hover in all editor modes
- **Export integration** — packed images are inlined into HTML and EPUB exports automatically

### Customization
- **Dark / light themes** — with per-theme custom color overrides for accent, background, and text
- **Editor settings** — font family, font size, line height, tab width
- **Auto-save** — configurable interval (off / 5s / 10s / 30s / 1min / 5min)
- **Keyboard shortcuts** — built-in defaults with reference table in settings

### Help & Onboarding
- **Guided tour** — 6-step spotlight walkthrough on first launch (re-launchable from settings)
- **Built-in help story** — multi-chapter tutorial covering markdown, AI features, and keyboard shortcuts
- **Sandbox chapters** — editable playground chapters for experimenting with features

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API) + TypeScript |
| Desktop | Tauri 2 (Rust backend) |
| State | Pinia (5 stores: story, editor, settings, ai, ui) |
| Build | Vite |
| AI (local) | Ollama API |
| AI (cloud) | OpenAI, Anthropic, Google Gemini |
| Storage | Tauri `plugin-fs` (primary) + localStorage (backup) |
| Export | `docx`, `epub-gen-memory`, custom HTML/Markdown renderers |
| Icons | Phosphor Icons + Material Design Icons |
| Testing | Vitest (149+ unit tests) |

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.70+ (for Tauri)
- **Visual Studio Build Tools** (Windows) or Xcode CLI tools (macOS)
- **Ollama** (optional, for local AI models) — [ollama.com](https://ollama.com)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/glyphastra.git
cd glyphastra

# Install dependencies
npm install

# Run in development mode (browser only)
npm run dev

# Run as a desktop app with Tauri
npm run dev:tauri

# Run tests
npm test
```

## Building for Production

```bash
# Build the frontend + Tauri desktop app
npm run tauri build
```

The packaged application will be output to `src-tauri/target/release/bundle/`.

## Release Builds & Code Signing

Releases are built automatically via GitHub Actions (see [`.github/workflows/release.yml`](.github/workflows/release.yml)) for Windows, macOS (x86_64 + Apple Silicon), and Linux whenever a version tag is pushed.

### Creating a release

1. Bump the version in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Create a branch, commit, and open a PR:

```bash
git checkout -b version-bump-v0.3.0
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump to v0.3.0"
git push origin version-bump-v0.3.0
# open a PR and merge it into master
```

3. After the PR is merged, tag the merge commit on `master` and push the tag:

```bash
git checkout master
git pull origin master
git tag v0.3.0
git push origin v0.3.0
```

This triggers the workflow, which builds all platforms and creates a **draft** GitHub Release with installers attached. Once you've verified the draft, publish it manually from the GitHub Releases page. Publishing the release also triggers the `update-manifest` job, which generates and attaches `latest.json` for the auto-updater.

### Re-running a failed release

If CI fails after the tag is already pushed (e.g. a workflow bug was fixed):

1. Fix the issue on a branch, open a PR, and merge it into `master`.
2. Delete the old draft release from the GitHub Releases page.
3. Move the tag to the new HEAD and force-push to re-trigger CI:

```bash
git checkout master
git pull origin master
git tag -f v0.3.0
git push --force origin v0.3.0
```

> **Note:** force-pushing a tag re-triggers the workflow but does **not** automatically delete any draft release GitHub already created. Always delete the old draft from the Releases page before re-running so the asset upload starts clean.

### ⚠️ Unsigned builds

Current releases are **not code-signed**. This means:

- **macOS** — Gatekeeper will block the app on first launch. To open it, right-click the `.dmg` → **Open** → **Open** in the dialog.
- **Windows** — SmartScreen may show an "Unknown publisher" warning. Click **More info → Run anyway**.
- **Linux** — no signing requirement; `.deb`, `.rpm`, and `.AppImage` all work without ceremony.

Code signing requires platform-specific certificates (Apple Developer Program for macOS, an Authenticode certificate for Windows) which carry ongoing costs. **If Glyph Astra receives community support or donations, enabling signed releases is a priority.** Watch the [releases page](https://github.com/your-username/glyphastra/releases) for updates.

## Project Structure

```
src/
  components/       # Vue components (editor, sidebar, AI panel, settings, export, etc.)
  stores/           # Pinia state stores
  utils/            # Core logic (markdown rendering, AI context, storage, export, etc.)
  api/              # AI provider implementations (Ollama, OpenAI, Anthropic, Google)
  styles/           # Global CSS
  __tests__/        # Unit tests (Vitest)
src-tauri/
  src/              # Rust backend (Tauri commands)
  capabilities/     # Tauri permission capabilities
  icons/            # Application icons
```

## Data Storage

Stories are stored under the OS application data directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\com.clint.glyphastra\stories\` |
| macOS | `~/Library/Application Support/com.clint.glyphastra/stories/` |
| Linux | `~/.config/com.clint.glyphastra/stories/` |

Each story has this structure:
```
stories/{storyId}/
  story.json                 # Metadata, characters, chapter list
  chapters/{chapterId}.md    # Chapter content
  history/{chapterId}.json   # Version history snapshots
  images.pack.json           # Packed image data (optional)
```

Settings and the project index are stored in `localStorage` as a secondary backup layer.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+N` | New chapter |
| `Ctrl+S` | Save |
| `Ctrl+F` | Search |
| `Ctrl+,` | Settings |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+Space` | Trigger AI suggestion |
| `Tab` | Accept AI suggestion |
| `Esc` | Dismiss AI suggestion |
| `↑` / `↓` | Cycle between AI suggestions |

## License

[Hippocratic License 3.0](LICENSE.md)
