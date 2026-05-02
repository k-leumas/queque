# Release Process

## Overview

Que-Que uses **semantic-release** to automate versioning, tagging, changelog generation, and GitHub releases. This ensures consistent, predictable releases following Semantic Versioning.

## CI/CD Pipeline

Two GitHub Actions workflows work together:

### 1. **CI Workflow** (`.github/workflows/ci.yml`)

Runs on **every push and pull request** to `main`:

- Lints code with **Biome**
- Type checks with **TypeScript**
- Runs unit tests with **Vitest**
- Builds the project with **tsup**

**Failure blocks merge:** PRs cannot be merged if any check fails.

### 2. **Release Workflow** (`.github/workflows/release.yml`)

Runs only on **push to main** (after CI passes):

1. **Re-runs all CI checks** (lint, typecheck, test, build) as a safety gate
2. **Runs semantic-release** only if all checks pass
3. **Creates release** with auto-generated notes and git tag

**Safety:** Release is completely blocked if tests or builds fail.

---

## How It Works

### Trigger

Every push to `main` automatically runs:

1. CI workflow (required checks)
2. Release workflow (depends on CI success)

### Version Bumping

**semantic-release** reads your git history and analyzes commits using Conventional Commits:

- **`fix:`** → Patch version bump (`0.1.0` → `0.1.1`)
- **`feat:`** → Minor version bump (`0.1.0` → `0.2.0`)
- **`BREAKING CHANGE:`** or `feat!:` → Major version bump (`0.1.0` → `1.0.0`)

### What Gets Updated

1. **package.json** — Version field updated
2. **CHANGELOG.md** — Release notes auto-generated and appended
3. **Git tag** — New semantic version tag created (e.g., `v0.2.0`)
4. **GitHub Release** — Release created with auto-generated notes

---

## Commit Message Format

Use Conventional Commits to trigger releases:

```
type(scope): subject

body

footer
```

### Types

- `feat` — New feature (triggers minor bump)
- `fix` — Bug fix (triggers patch bump)
- `docs` — Documentation only (no release)
- `style` — Code style (no release)
- `refactor` — Refactoring (no release)
- `perf` — Performance improvement (no release)
- `test` — Test changes (no release)
- `chore` — Tooling, build, CI config (no release)

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` footer or use `!` before colon:

```
feat!: redesign shell integration protocol

BREAKING CHANGE: Shell result format changed from numeric offsets to split buffer
```

Or:

```
feat(shell)!: new result contract
```

### Examples

```bash
# Patch release (v0.1.1)
git commit -m "fix(daemon): handle socket timeout gracefully"

# Minor release (v0.2.0)
git commit -m "feat(client): add result filtering UI"

# Major release (v1.0.0)
git commit -m "feat!: change shell integration API"

# No release (chore)
git commit -m "chore: update dependencies"
```

---

## Local Development

### Run all CI checks locally

```bash
pnpm ci:check
```

This runs:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:run`
- `pnpm build`

If this passes locally, it will pass in CI.

### Manual release (testing)

Normally releases happen automatically. To test locally:

```bash
GITHUB_TOKEN=<your_token> pnpm release
```

---

## Workflow Diagram

```
Push to main
     ↓
  CI Workflow
  ├─ Lint ✓
  ├─ Type check ✓
  ├─ Test ✓
  └─ Build ✓
     ↓ (all pass)
 Release Workflow
  ├─ Re-run CI checks (safety gate)
  ├─ Analyze commits
  ├─ Update package.json & CHANGELOG.md
  ├─ Create git tag (v0.2.0)
  └─ Create GitHub Release
```

---

## Troubleshooting

### CI workflow failed

**Check:** GitHub Actions tab → click failed workflow → view logs

**Common issues:**
- Tests failing: Run `pnpm test:run` locally
- Lint errors: Run `pnpm lint:fix` locally
- Build errors: Run `pnpm build` locally
- Type errors: Run `pnpm typecheck` locally

### No release created, but commits were pushed

**Cause:** Commits don't follow Conventional Commits format, or CI checks failed.

**Fix:** 
1. Check workflow logs for CI failures
2. Ensure commit messages start with `feat:`, `fix:`, etc.
3. Run `pnpm ci:check` locally first

### Release created with wrong version

**Cause:** semantic-release analyzed commits incorrectly.

**Fix:** Semantic-release is deterministic. Check the release workflow logs for the commit analysis output.

### Workflow permission errors

**Cause:** Release workflow needs write permissions.

**Fix:** Repository → Settings → Actions → General → Workflow permissions → set to "Read and write permissions"

---

## References

- [semantic-release docs](https://semantic-release.gitbook.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions](https://docs.github.com/en/actions)
