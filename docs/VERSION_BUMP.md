# Version Bump Process

How to cut a new release of Glyph Astra.

---

## Version files

There are **two** files that need a manual version bump:

| File | Field |
|---|---|
| `package.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` |

`src-tauri/tauri.conf.json` does **not** need a manual bump — it uses `"version": "../package.json"` and automatically reads from `package.json` at build time.

> **Important:** Both files must match before you push the version tag. If the tag is pushed while they are out of sync, the release workflow will produce installer assets named after the old version and attach them to the new release draft — requiring manual cleanup on the GitHub Releases page.

---

## Steps

### 1. Create a version bump branch

```bash
git checkout master
git pull origin master
git checkout -b version-bump-vX.Y.Z
```

### 2. Update both version files

In `package.json`:
```json
"version": "X.Y.Z"
```

In `src-tauri/Cargo.toml`:
```toml
version = "X.Y.Z"
```

### 3. Verify they match

```bash
grep '"version"' package.json
grep '^version' src-tauri/Cargo.toml
```

Both should show the same `X.Y.Z` value before continuing.

### 4. Update CHANGELOG.md

Add a new entry at the top of `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com) format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Fixed
- ...

### Changed
- ...
```

### 5. Commit, push, and open a PR

```bash
git add package.json src-tauri/Cargo.toml CHANGELOG.md
git commit -m "chore: bump to vX.Y.Z"
git push origin version-bump-vX.Y.Z
# open a PR and merge it into master
```

### 6. Tag the merge commit

After the PR merges:

```bash
git checkout master
git pull origin master
git tag vX.Y.Z
git push origin vX.Y.Z
```

This triggers the release workflow, which builds all four platforms and creates a **draft** GitHub Release with installers attached.

### 7. Publish the release

Once you've verified the draft release assets look correct, publish it manually from the GitHub Releases page. Publishing also triggers the `update-manifest` job, which generates and attaches `latest.json` for the auto-updater.

---

## Re-running a failed release

If the workflow fails after the tag is already pushed:

1. Fix the issue on a branch, open a PR, and merge it into `master`.
2. Delete the old draft release from the GitHub Releases page.
3. Move the tag to the new HEAD and force-push:

```bash
git checkout master
git pull origin master
git tag -f vX.Y.Z
git push --force origin vX.Y.Z
```

> Always delete the old draft release before re-pushing the tag so the asset upload starts clean.
