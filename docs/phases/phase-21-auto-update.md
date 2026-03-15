# Phase 21: Auto-Update via GitHub Releases ⏳ NOT STARTED

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

### 21.1 Generate the Ed25519 Update Signing Key Pair

- [ ] Run `npm run tauri signer generate` (or `cargo tauri signer generate`) in the project root
  - Outputs a **private key** (kept secret, stored as a GitHub Actions secret `TAURI_SIGNING_PRIVATE_KEY`) and a **public key** (embedded in `tauri.conf.json`)
- [ ] Store the private key passphrase (if set) as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret
- [ ] Add the public key to `tauri.conf.json` under `bundle.updater.pubkey`
- [ ] **Never commit the private key** — `.gitignore` should exclude any generated key files

### 21.2 Configure the Updater in tauri.conf.json

- [ ] Add a `plugins.updater` block to `tauri.conf.json` (Tauri 2 plugin config — **not** under `bundle`):
  ```json
  "plugins": {
    "updater": {
      "pubkey": "<paste ed25519 public key here>",
      "endpoints": [
        "https://github.com/wolf123450/GlyphAstra/releases/latest/download/latest.json"
      ]
    }
  }
  ```
- [ ] In Tauri 2, the updater plugin has no `active` or `dialog` config — update UI is always custom (our Vue component)
- [ ] The endpoint URL must serve a JSON file in Tauri's update manifest format (see 21.3)
- [ ] Add `"updater:default"` permission to `capabilities/default.json`
- [ ] Add `"process:allow-restart"` permission to `capabilities/default.json` (for `relaunch()` after install)

### 21.3 Publish the Update Manifest as a Release Asset

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

- [ ] Add a final step to `release.yml` (after all 4 platform builds succeed) using `actions/github-script` or a community action to:
  1. List the newly-created release assets to get their download URLs
  2. Read the `.sig` sidecar files that `tauri-action` outputs alongside each installer
  3. Assemble the `latest.json` manifest
  4. Upload `latest.json` as a release asset
- [ ] The `latest.json` URL (`…/releases/latest/download/latest.json`) always resolves to the most recent non-prerelease release — this is the endpoint the updater polls

### 21.4 Sign Release Artifacts in the Release Workflow

`tauri-action` will sign installers automatically if the signing key env vars are set:

- [ ] In `release.yml`, add to the `tauri-apps/tauri-action` `env:` block:
  ```yaml
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  ```
- [ ] Each platform will then output `<installer>.sig` sidecar files alongside the normal installer — these are consumed by step 21.3 to build `latest.json`

### 21.5 Add tauri-plugin-updater + tauri-plugin-process (Rust + JS)

- [ ] `Cargo.toml` — add `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"`
- [ ] `package.json` — add `"@tauri-apps/plugin-updater": "^2"` and `"@tauri-apps/plugin-process": "^2"`
- [ ] `lib.rs` — register `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_process::init())`
- [ ] `capabilities/default.json` — add `"updater:default"` and `"process:allow-restart"`

### 21.6 Update Check Service (Frontend)

- [ ] Create `src/utils/updateService.ts`:
  - `checkForUpdate()` — calls `tauri-plugin-updater`'s `check()` method; returns `UpdateManifest | null`
  - Called once on app startup (in `App.vue` `onMounted`) with a 10-second delay to avoid blocking startup
  - Also callable manually from Settings → Help tab ("Check for updates" button)
  - Guard: only runs if `isTauri` (no-op in browser dev mode)

### 21.7 Update Notification UI

- [ ] When `checkForUpdate()` returns a manifest, show a **non-blocking notification** via `uiStore.showNotification`:
  - Message: `"Glyph Astra v{version} is available"` with an **"Install update"** action button
  - Type: `'info'` with a persistent duration (0 = no auto-dismiss) so the user sees it
- [ ] Clicking "Install update":
  1. Show a progress notification: `"Downloading update…"`
  2. Call `update.downloadAndInstall()` — this downloads and applies the installer
  3. On completion: prompt the user to restart (`"Update ready — restart to apply"`)
  4. "Restart now" button calls `relaunch()` from `@tauri-apps/plugin-process`
- [ ] On error: show `uiStore.showNotification('Update failed: …', 'error')`
- [ ] Extend `Notification.vue` if needed to support an action button callback

### 21.8 Manual Update Check in Settings

- [ ] **Settings → Help tab**: add a `"Check for updates"` button below the version string
  - On click: runs `checkForUpdate()`; shows `"You're on the latest version"` or the install prompt
  - Show a spinner/loading state while checking
  - This gives users a way to trigger a check without restarting the app

### 21.9 Fallback for Unsigned / Dev Builds

- [ ] The updater should be completely disabled in development (`import.meta.env.DEV`) to avoid trying to contact a non-existent endpoint during development
- [ ] Guard in `updateService.ts`: early return if `isDev` or `!isTauri`
- [ ] Document in README that self-built binaries (built locally without the signing keys) will not receive auto-updates; only official GitHub release builds will

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
