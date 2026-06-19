---
status: complete
---

# Quick Task: Workflows use .nvmrc for Node version

CI workflows now read the pinned Node version from `.nvmrc` (24.14.1) via `actions/setup-node` `node-version-file`.

## Changes

- `.github/workflows/release.yaml` — three `setup-node` steps
- `.github/workflows/homebrew.yml` — added `setup-node` with `.nvmrc`
