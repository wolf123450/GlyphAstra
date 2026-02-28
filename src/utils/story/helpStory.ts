/**
 * Embedded help / reference story.
 *
 * Content is defined here as TypeScript constants so no disk files are
 * needed.  On first launch (no existing stories) the story is loaded into
 * the app.  It can also be reopened or reset at any time from Settings → Help.
 *
 * Chapter IDs are stable so resetHelpStory() can restore individual chapters
 * without touching the sandbox chapters.
 */

export const HELP_STORY_ID = 'blockbreaker-help'

export interface HelpChapterDef {
  id: string
  name: string
  content: string
  isReadOnly: boolean
}

// ─── Chapter content ───────────────────────────────────────────────────────

const WELCOME = `# Welcome to BlockBreaker

BlockBreaker is a desktop creative writing app with **local AI assistance** — your stories stay on your machine and never touch a cloud.

---

## Getting started

1. **Create a story** — click the story title in the sidebar header to open the story picker, then press **+ New Story**.
2. **Add chapters** — press **⊕ Add Chapter** at the bottom of the chapter list.
3. **Write** — formatting is rendered live as you type in Seamless mode.
4. **Get AI suggestions** — make sure Ollama is running, then press **Ctrl+Space** anywhere in the editor.
5. **Save** — work auto-saves every 10 seconds.  Press **Ctrl+S** to save immediately.

---

## Editor modes

Use the three buttons in the editor toolbar to switch modes:

| Button | Mode | Description |
|--------|------|-------------|
| ≡ | **Seamless** | Markdown rendered live as you type (recommended) |
| ⁋ | **Markdown** | Raw markdown source with syntax highlighting |
| ▣ | **Preview** | Read-only rendered view |

---

## Sidebar

- **Story title** (top) — click to open the story switcher
- **Chapter list** — click a chapter to open it; drag to reorder
- **⊕** — add a new chapter
- **≡** next to a chapter name — open the Chapter Metadata Editor
- **⚙** (footer) — Settings
- **?** (Help button) — re-open this story at any time

---

## Tips

- Press **Ctrl+F** to open full-text search with regex and replace support.  
- Preview a chapter without switching modes by pressing **▣** in the toolbar.
- The **Overview** panel (◨) shows story metadata, word count, and character profiles.
- Press **Ctrl+,** to open Settings where you can change fonts, theme, AI config, and shortcuts.

> This is a read-only reference chapter.  Use the **Sandbox** chapters at the bottom of the list to practise.`

// ─────────────────────────────────────────────────────────────────────────────

const MARKDOWN_GUIDE = `# Markdown Guide

BlockBreaker uses standard Markdown with full live rendering in Seamless mode.

---

## Headings

\`\`\`
# Heading 1
## Heading 2
### Heading 3
\`\`\`

---

## Emphasis

| Syntax | Result |
|--------|--------|
| \`**bold**\` | **bold** |
| \`*italic*\` | *italic* |
| \`~~strikethrough~~\` | ~~strikethrough~~ |
| \`\`code\`\` | \`code\` |

---

## Lists

**Unordered:**
\`\`\`
- First item
- Second item
  - Nested item
\`\`\`

**Ordered:**
\`\`\`
1. First step
2. Second step
3. Third step
\`\`\`

---

## Blockquotes

\`\`\`
> "The pages are still blank, but there is a miraculous feeling of the words being there."
> — Vladimir Nabokov
\`\`\`

> "The pages are still blank, but there is a miraculous feeling of the words being there."
> — Vladimir Nabokov

---

## Horizontal rules

Three or more hyphens on a line create a scene break:

\`\`\`
---
\`\`\`

---

## Links

\`\`\`
[Link text](https://example.com)
\`\`\`

**Chapter links** — Ctrl+Click to navigate within the app:
\`\`\`
[Go to Chapter 2](chapter://chapter-id)
\`\`\`

**Story links** — Ctrl+Click to open a different story:
\`\`\`
[Open My Novel](story://story-id)
\`\`\`

You can also link to a specific chapter inside another story:
\`\`\`
[See Book 2, Chapter 1](story://story-id/chapter-id)
\`\`\`

Broken links (story or chapter no longer exists) are shown with a strikethrough in red.

---

## Code blocks

\`\`\`
\`\`\`python
def hello():
    print("Hello, world!")
\`\`\`
\`\`\`

---

## Tables

\`\`\`
| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |
\`\`\`

---

## Escaping

Prefix any Markdown character with \`\\\` to render it literally:  
\`\\*not italic\\*\` → \\*not italic\\*

> This is a read-only reference chapter.  Use the **Sandbox — Try Markdown** chapter to experiment.`

// ─────────────────────────────────────────────────────────────────────────────

const AI_GUIDE = `# AI Writing Guide

BlockBreaker uses **Ollama** for fully local, private AI suggestions.  No internet connection or API key is required.

---

## Prerequisites

1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Pull at least one model, e.g.:
   \`\`\`
   ollama pull llama3.2
   \`\`\`
3. Make sure Ollama is running (it starts automatically on most systems).

BlockBreaker will show a connection indicator in the AI panel.  If it says **Not connected**, start Ollama and press the refresh button.

---

## Triggering suggestions

Place your cursor anywhere in the editor and press **Ctrl+Space**.

BlockBreaker sends the text before your cursor (up to the token budget) plus your story metadata and AI settings as context.

The suggestion appears as **ghost text** after your cursor:

- **Tab** — accept the full suggestion  
- **→** (right arrow at end of line) — accept one word at a time  
- **Escape** — dismiss  
- **Ctrl+Space** again — generate a new suggestion

---

## Writing Profiles

Writing profiles control the tone and style of AI suggestions.

Open the AI panel (**✦** button in the editor toolbar) and choose a profile:

| Profile | Style |
|---------|-------|
| Neutral | Plain, unbiased continuation |
| Descriptive | Rich sensory detail |
| Dialogue | Conversational, character-driven |
| Action | Fast-paced, short sentences |
| Custom | Your own system prompt |

Press **Prompt Preview** to see exactly what gets sent to the model.

---

## AI Context

BlockBreaker automatically includes relevant context in every prompt:

- **Story metadata** — title, genre, tone, narrative voice
- **Chapter summaries** — auto-generated summaries of earlier chapters
- **Plot outline chapters** — any chapter flagged as a plot outline (via Chapter Metadata)
- **Context tags** — chapters tagged with the same tags as the active chapter

You can manage all of these per-chapter in the **Chapter Metadata Editor** (≡ icon next to the chapter name).

---

## Tips

- Keep chapter summaries up to date for better long-arc coherence.
- Use a **Plot Outline** chapter to give the AI a bird's-eye view of your story.
- Reduce the **Suggestion Length** in Settings → AI for faster, shorter completions.
- If suggestions stall, restart Ollama and check that the selected model is downloaded.

> This is a read-only reference chapter.  Use the **Sandbox — Try AI** chapter to practise suggestions.`

// ─────────────────────────────────────────────────────────────────────────────

const SHORTCUTS = `# Keyboard Shortcuts

All shortcuts can be customised in **Settings → Shortcuts** (Ctrl+,).

---

## Editor

| Shortcut | Action |
|----------|--------|
| **Ctrl+S** | Save chapter |
| **Ctrl+Z** | Undo |
| **Ctrl+Shift+Z** / Ctrl+Y | Redo |
| **Ctrl+Space** | Trigger AI suggestion |
| **Tab** (with suggestion) | Accept full suggestion |
| **Escape** (with suggestion) | Dismiss suggestion |

---

## Navigation

| Shortcut | Action |
|----------|--------|
| **Ctrl+F** | Open search panel |
| **Ctrl+,** | Open Settings |

---

## Markdown (Seamless mode)

Formatting is typed inline — no keyboard shortcuts needed.  
Type \`**\`, \`*\`, \`~~\`, \`\`\`\` directly around text.

---

## Chapter and story links

Ctrl+Click any \`chapter://\` link in the editor to navigate to that chapter.  
Ctrl+Click any \`story://\` link to open a different story.

---

> This is a read-only reference chapter.  Shortcuts can be changed in **Settings → Shortcuts**.`

// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX_MARKDOWN = `# Sandbox — Try Markdown

This chapter is yours to edit freely.  Try out any Markdown syntax from the **Markdown Guide** chapter.

---

## Try some formatting

You can **bold** text, *italicise* it, or ~~strike it through~~.

> Add a blockquote here.

---

## Try a list

- Item one
- Item two
  - Nested item

Delete everything in this chapter and start fresh if you like — it\u2019s just a practice space.`

// ─────────────────────────────────────────────────────────────────────────────

const SANDBOX_AI = `# Sandbox — Try AI

This chapter is a practice space for AI suggestions.

Make sure Ollama is running, place your cursor at the end of a sentence, and press **Ctrl+Space**.

---

The old clock on the mantelpiece had stopped at half past three.  No one in the house could remember when it had last been wound, or who had wound it last.  Sarah ran a finger along its dusty face and`

// ─────────────────────────────────────────────────────────────────────────────

export const HELP_CHAPTERS: HelpChapterDef[] = [
  {
    id: 'help-ch-welcome',
    name: 'Welcome to BlockBreaker',
    content: WELCOME,
    isReadOnly: true,
  },
  {
    id: 'help-ch-markdown',
    name: 'Markdown Guide',
    content: MARKDOWN_GUIDE,
    isReadOnly: true,
  },
  {
    id: 'help-ch-ai',
    name: 'AI Writing Guide',
    content: AI_GUIDE,
    isReadOnly: true,
  },
  {
    id: 'help-ch-shortcuts',
    name: 'Keyboard Shortcuts',
    content: SHORTCUTS,
    isReadOnly: true,
  },
  {
    id: 'help-ch-sandbox-md',
    name: 'Sandbox \u2014 Try Markdown',
    content: SANDBOX_MARKDOWN,
    isReadOnly: false,
  },
  {
    id: 'help-ch-sandbox-ai',
    name: 'Sandbox \u2014 Try AI',
    content: SANDBOX_AI,
    isReadOnly: false,
  },
]
