# Phase 20: CI/CD Pipeline Improvements ✅ COMPLETE

[← Back to Implementation Plan](../IMPLEMENTATION_PLAN.md)

---

The initial release pipeline (Phase 19 / v0.2.0) established a working GitHub Actions workflow with basic unit tests and a draft-release build matrix. This phase hardens and extends that foundation into a production-quality CI/CD pipeline.

---

### 20.1 Separate CI and Release Workflows ✅

- [x] `ci.yml` — triggers on `push` (master) and `pull_request`; runs `npm ci` → `npm test` → `npm run test:bundle`
- [x] `ci.yml` includes `concurrency:` group (`ci-${{ github.ref }}`, `cancel-in-progress: true`)
- [x] `release.yml` — duplicate `npm test` and `test:bundle` steps removed; Tauri build-only per matrix runner

### 20.2 Branch Protection Rules (Documentation) ✅

- [x] `README.md` § "Contributing" documents recommended branch protection settings:
  - Require `CI / Tests & bundle safety` status check to pass before merge
  - Require 1 pull request review
  - No direct pushes to `master`
  - Path: Settings → Branches → Add rule

### 20.3 Dependency Update Automation ✅

- [x] `.github/dependabot.yml` added:
  - `npm` — weekly, grouped patch/minor/major, max 5 open PRs
  - `cargo` — weekly, max 5 open PRs
  - `github-actions` — monthly, max 5 open PRs

### 20.4 Release Notes Automation (CHANGELOG) ✅

- [x] `CHANGELOG.md` created at repo root (Keep a Changelog format)
- [x] `release.yml` `releaseBody` references `CHANGELOG.md`
- [ ] (Optional / future) Evaluate `release-please` or `semantic-release` for fully automated changelog generation from conventional commits

### 20.5 Artifact Caching ✅

- [x] `ci.yml` — `cache: npm` in `actions/setup-node`
- [x] `release.yml` — `cache: npm` in `actions/setup-node`; `Swatinem/rust-cache@v2` added (keyed on `Cargo.lock`, workspaces: `src-tauri`)

### 20.6 Build Status Badge ✅

- [x] CI badge added to top of `README.md` alongside the Sponsor badge

---

### Roll-up order

1. **20.5** (caching) — quick win, improves all subsequent runs
2. **20.1** (split CI/release) — reduces release matrix from 4×(test+build) to 4×(build-only)
3. **20.3** (Dependabot) — set-and-forget
4. **20.4** (CHANGELOG) — needed before the next public release
5. **20.2** (branch protection docs) — admin/process work, low urgency
6. **20.6** (badge) — cosmetic, after CI workflow exists
