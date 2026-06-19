---
status: complete
---

# Quick Task: Fix CI pnpm install ERR_PNPM_IGNORED_BUILDS

Committed `pnpm-workspace.yaml` with `allowBuilds` for `esbuild` and `lefthook`. The file was gitignored and untracked — pnpm 11 requires this config (not package.json) for CI fresh installs.
