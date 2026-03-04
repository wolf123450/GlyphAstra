# Phases 13–15: Advanced Features & Help/Onboarding

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

## Phase 13: Advanced Features & Extensions ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features
- [ ] **Auto-updater** — configure Tauri's `updater` plugin to ship security patches and new releases. Requires: (1) finalise app rename, (2) host on GitHub with Releases for update manifests, (3) add `updater` section to `tauri.conf.json` with public signing key and GitHub endpoint.
- [ ] **E2E testing** — set up Playwright (or similar) for end-to-end tests covering critical user flows: story creation, chapter editing, AI suggestion acceptance, export, and settings persistence. Deferred from CODE_REVIEW.md §9.1 item #52.

---

## Phase 14: Help, Onboarding & Demo Story ✅ COMPLETE

### 14.1 First-Run Onboarding Tour ✅ COMPLETE
- [x] Detect first launch (flag in localStorage: `glyphastra_onboarding_complete`)
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
- [x] Extended chapter fields (`isReadOnly`, `isPlotOutline`, `contextTags`, `summary`, etc.) now correctly serialised/deserialised (`storyManager.ts` + `loadStory` fix)

### 14.4 Settings → Help Tab ✅ COMPLETE
- [x] **Help** tab added to `Settings.vue` (sixth tab)
- [x] Contains: "Take the tour again" button, "Open help story" button, "Reset help content" button
- [x] App version number displayed (imported from `package.json`)

---

## Phase 15: Advanced Features & Extensions ⏳ NOT STARTED

- [ ] Analytics and insights
- [ ] Community features
