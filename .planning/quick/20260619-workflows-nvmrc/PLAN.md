# Quick Task: Workflows use .nvmrc for Node version

Replace hardcoded `node-version: 24` with `node-version-file: .nvmrc` in all GitHub Actions workflows.

## Files

- `.github/workflows/release.yaml` — test, tag-and-changelog, publish-npm jobs
- `.github/workflows/homebrew.yml` — add setup-node before version resolution
