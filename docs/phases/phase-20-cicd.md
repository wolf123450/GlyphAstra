# Phase 20: CI/CD Pipeline Improvements 🟡 ~40% Complete

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

The initial release pipeline (Phase 19 / v0.2.0) established a working GitHub Actions workflow with basic unit tests and a draft-release build matrix. This phase hardens and extends that foundation into a production-quality CI/CD pipeline.

---

### 20.1 Separate CI and Release Workflows 🟡 Partial

**Current state:** A single `release.yml` workflow runs on every `v*` tag push, combining tests, bundle safety check, and the Tauri build/publish in one job per platform.

**Goal:** Split into two independent workflows so PRs and branch pushes get feedback cheaply, and the release workflow can assume tests have already passed.

- [x] Create `.github/workflows/ci.yml` — triggers on `push` (master) and `pull_request`; runs `npm ci` → `npm test` → `npm run build`
- [ ] `ci.yml` is missing the bundle safety test step (`npx vitest run src/__tests__/bundleSafety.test.ts`)
- [ ] Modify `release.yml` — remove the duplicate `npm test` / `test:bundle` steps (they still exist; CI already ran them)
- [ ] (Optional) Add `concurrency:` group on CI workflow to cancel in-progress runs when a newer commit arrives

### 20.2 Branch Protection Rules (Documentation)

- [ ] Document recommended GitHub repository settings in `README.md` § "Contributing":
  - Require the `CI / Tests & bundle safety` status check to pass before merge
  - Require pull request reviews: 1 approver
  - Do not allow direct pushes to `main`
- [ ] Note: these are configured in the GitHub repo settings UI, not in YAML — document the exact path (Settings → Branches → Add rule)

### 20.3 Dependency Update Automation

- [ ] Add a `.github/dependabot.yml` config:
  - `npm` ecosystem, weekly schedule, `main` base branch, grouped updates (patch, minor, major separately)
  - `cargo` ecosystem, weekly schedule
  - `github-actions` ecosystem, monthly schedule
- [ ] Cap concurrent open PRs at 5 to avoid inbox floods

### 20.4 Release Notes Automation (CHANGELOG) ✅

- [x] `CHANGELOG.md` created at repo root following [Keep a Changelog](https://keepachangelog.com) format
- [ ] Update `release.yml` `releaseBody` to reference `CHANGELOG.md` properly
- [ ] (Optional / future) Evaluate `release-please` or `semantic-release` for fully automated changelog generation from conventional commits

### 20.5 Artifact Caching 🟡 Partial

- [x] `ci.yml` — `cache: npm` set in `actions/setup-node`
- [x] `release.yml` — `cache: npm` set in `actions/setup-node`
- [ ] Add Rust cache via `Swatinem/rust-cache@v2` in both `ci.yml` and `release.yml`
  - Cargo registry + build artifacts are typically 1–2 GB; caching the registry alone halves CI time on cache hits

### 20.6 Build Status Badge

- [ ] Add a CI build status badge to the top of `README.md`:
  ```md
  [![CI](https://github.com/wolf123450/GlyphAstra/actions/workflows/ci.yml/badge.svg)](https://github.com/wolf123450/GlyphAstra/actions/workflows/ci.yml)
  ```
- [ ] Place alongside the existing Sponsor badge

---

### Roll-up order

1. **20.5** (caching) — quick win, improves all subsequent runs
2. **20.1** (split CI/release) — reduces release matrix from 4×(test+build) to 4×(build-only)
3. **20.3** (Dependabot) — set-and-forget
4. **20.4** (CHANGELOG) — needed before the next public release
5. **20.2** (branch protection docs) — admin/process work, low urgency
6. **20.6** (badge) — cosmetic, after CI workflow exists
