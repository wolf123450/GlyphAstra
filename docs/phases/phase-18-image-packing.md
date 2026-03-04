# Phase 18: Image Packing & Alt-Text Captions ✅ COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

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
