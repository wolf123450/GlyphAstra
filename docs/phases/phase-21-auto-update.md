# Phase 21: Auto-Update via GitHub Releases ✅ COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

GitHub Releases are now live (v0.2.0+). This phase wires Tauri's built-in `tauri-plugin-updater` to those releases so users are notified of new versions and can install them without visiting a browser.

---

### Background

Tauri 2 ships `tauri-plugin-updater` which polls a JSON endpoint (or the GitHub Releases API directly) and can download+install a signed update package. There is an important constraint: **update packages must be signed** with an Ed25519 key pair, or the updater will refuse them. This is separate from code signing (Authenticode/notarization) — it is lightweight and free.

Key components:
- **Update server / endpoint**: a URL that returns a JSON object describing the latest release version, download URLs, and a signature
- **`tauri-plugin-updater`**: Rust-side plugin that fetches the endpoint, verifies the signature, downloads the installer, and applies it
- **Update UI**: a Vue component that shows a notification when an update is available with a "Download & install" action

---

### 21.1 Generate the Ed25519 Update Signing Key Pair ✅

- [x] Run `npm run tauri signer generate` (or `cargo tauri signer generate`) in the project root
  - Outputs a **private key** (kept secret, stored as a GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`) and a **public key** (embedded in `tauri.conf.json`)
- [x] Store the private key passphrase (if set) as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret
- [x] Add the public key to `tauri.conf.json` under `plugins.updater.pubkey`
- [x] **Never commit the private key** — `.gitignore` should exclude any generated key files

### 21.2 Configure the Updater in tauri.conf.json ✅

- [x] `plugins.updater` block added to `tauri.conf.json` with pubkey and GitHub endpoint
- [x] In Tauri 2, the updater plugin has no `active` or `dialog` config — update UI is always custom (our Vue component)
- [x] Endpoint: `https://github.com/wolf123450/GlyphAstra/releases/latest/download/latest.json`
- [x] `"updater:default"` permission added to `capabilities/default.json`
- [x] `"process:allow-restart"` permission added to `capabilities/default.json`

### 21.3 Publish the Update Manifest as a Release Asset ✅

Tauri's updater expects a `latest.json` file at the configured endpoint. For GitHub Releases the simplest approach is to generate and upload this file as a release asset.

Format:
```json
{
  "version": "0.2.0",
  "notes": "See https://github.com/wolf123450/GlyphAstra/releases/tag/v0.2.0",
  "pub_date": "2026-03-06T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/.../GlyphAstra_0.2.0_x64-setup.nsis.zip",
      "signature": "<sig>"
    },
    "darwin-x86_64":  { "url": "...", "signature": "..." },
    "darwin-aarch64": { "url": "...", "signature": "..." },
    "linux-x86_64":   { "url": "...", "signature": "..." }
  }
}
```

- [x] Final `update-manifest` job in `release.yml` uses `actions/github-script` to:
  1. List release assets to get download URLs
  2. Download `.sig` sidecar files output by `tauri-action`
  3. Assemble the `latest.json` manifest
  4. Upload `latest.json` as a release asset
- [x] The `latest.json` URL (`…/releases/latest/download/latest.json`) always resolves to the most recent non-prerelease release

### 21.4 Sign Release Artifacts in the Release Workflow ✅

- [x] `release.yml` `tauri-apps/tauri-action` `env:` block includes:
  ```yaml
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  ```
- [x] Each platform outputs `<installer>.sig` sidecar files consumed by the manifest job (21.3)

### 21.5 Add tauri-plugin-updater + tauri-plugin-process (Rust + JS) ✅

- [x] `Cargo.toml` — `tauri-plugin-updater` and `tauri-plugin-process` added
- [x] `package.json` — `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` in dependencies
- [x] `lib.rs` — both plugins registered
- [x] `capabilities/default.json` — `"updater:default"` and `"process:allow-restart"` added

### 21.6 Update Check Service (Frontend) ✅

- [x] `src/utils/updateService.ts` created with:
  - `checkForUpdate()` — calls `tauri-plugin-updater`'s `check()` method
  - `downloadAndInstallUpdate()` — downloads, installs, prompts restart
  - `autoCheckForUpdate()` — called from `App.vue` on startup; shows notification if update available
  - Guard: no-op if `import.meta.env.DEV` or `!isTauri`

### 21.7 Update Notification UI ✅

- [x] `autoCheckForUpdate()` shows a persistent `'info'` notification: `"Glyph Astra v{version} is available"` with **"Install update"** action button
- [x] Clicking "Install update" calls `downloadAndInstallUpdate()`:
  1. Shows `"Downloading update…"` notification
  2. Calls `update.downloadAndInstall()`
  3. Shows `"Update installed — restart to apply."` with **"Restart now"** button calling `relaunch()`
- [x] On error: `uiStore.showNotification('Update failed: …', 'error')`
- [x] `Notification.vue` extended with optional action button callback

### 21.8 Manual Update Check in Settings ✅

- [x] **Settings → Help tab**: `"Check for updates"` button below the version string
  - Shows spinner/loading state while checking
  - Shows `"You're on the latest version"` or install prompt on result

### 21.9 Fallback for Unsigned / Dev Builds ✅

- [x] `updateService.ts`: early return if `import.meta.env.DEV` or `!isTauri`
- [x] Self-built binaries (no signing keys) will not receive auto-updates — only official GitHub release builds

---

### Roll-up order

1. **21.1** — generate key pair (one-time, offline)
2. **21.5** — add plugin deps
3. **21.4** — add signing env vars to CI
4. **21.2** — configure updater in tauri.conf.json
5. **21.3** — generate + upload `latest.json` in release workflow
6. **21.6** — frontend update service
7. **21.7** — update notification UI
8. **21.8** — manual check in Settings
9. **21.9** — dev build guards
