# Quick Task: Fix CI pnpm install ERR_PNPM_IGNORED_BUILDS

pnpm 11 blocks esbuild/lefthook postinstall scripts unless explicitly allowed. Add `pnpm-workspace.yaml` with `allowBuilds` so CI fresh installs succeed.
