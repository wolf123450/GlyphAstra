# Phase 17: Story Library & Series Management 🟡 IN PROGRESS

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

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
