# Codebase Map

Generated: 2026-05-21T18:46:37Z | Files: 81 | Described: 0/81
<!-- gsd:codebase-meta {"generatedAt":"2026-05-21T18:46:37Z","fingerprint":"d509f1cca903261e4809ddb39941397778ed86b6","fileCount":81,"truncated":false} -->

### (root)/
- `.gitignore`
- `.nvmrc`
- `.releaserc.json`
- `biome.json`
- `CHANGELOG.md`
- `CLAUDE.md`
- `commitlint.config.js`
- `lefthook.yml`
- `package.json`
- `pnpm-lock.yaml`
- `README.md`
- `tsconfig.json`
- `tsup.config.ts`
- `vitest.config.ts`

### .github/workflows/
- `.github/workflows/release.yaml`

### .wolf/
- `.wolf/anatomy.md`
- `.wolf/buglog.json`
- `.wolf/cerebrum.md`
- `.wolf/identity.md`
- `.wolf/memory.md`
- `.wolf/OPENWOLF.md`
- `.wolf/reframe-frameworks.md`

### .wolf/hooks/
- `.wolf/hooks/_session.json`
- `.wolf/hooks/package.json`
- `.wolf/hooks/post-read.js`
- `.wolf/hooks/post-write.js`
- `.wolf/hooks/pre-read.js`
- `.wolf/hooks/pre-write.js`
- `.wolf/hooks/session-start.js`
- `.wolf/hooks/shared.js`
- `.wolf/hooks/stop.js`

### docs/
- `docs/RELEASING.md`
- `docs/SYSTEM_DESGN.md`

### scripts/
- `scripts/build-dashboard.mjs`
- `scripts/restart-dev-server.mjs`

### shell/zsh/
- `shell/zsh/qq.zsh`

### src/cli/
- `src/cli/main.ts`

### src/cli/commands/
- `src/cli/commands/client.ts`
- `src/cli/commands/daemon.ts`

### src/client/
- `src/client/result-writer.ts`
- `src/client/run-foreground.ts`

### src/context/
- `src/context/base-context.ts`
- `src/context/pipeline.ts`
- `src/context/provider.ts`

### src/context/providers/
- `src/context/providers/filesystem-context.ts`
- `src/context/providers/git-context.ts`

### src/contracts/
- `src/contracts/candidates.ts`
- `src/contracts/ipc.ts`
- `src/contracts/request.ts`
- `src/contracts/shell.ts`

### src/daemon/
- `src/daemon/bootstrap.ts`
- `src/daemon/server.ts`

### src/intent/
- `src/intent/router.ts`

### src/providers/
- `src/providers/claude.ts`
- `src/providers/provider.ts`

### src/registry/
- `src/registry/bootstrap.ts`
- `src/registry/context-providers.ts`
- `src/registry/provider-backends.ts`
- `src/registry/shell-adapters.ts`
- `src/registry/storage-hooks.ts`

### src/shared/
- `src/shared/debug-log.ts`
- `src/shared/env-file.ts`
- `src/shared/socket-path.ts`
- `src/shared/vcs-context.ts`

### src/ui/
- `src/ui/CandidateSelect.tsx`
- `src/ui/ControlsLine.tsx`
- `src/ui/LoadingSpinner.tsx`
- `src/ui/Modal.tsx`
- `src/ui/SearchInput.tsx`

### tests/
- `tests/candidate-select.test.tsx`
- `tests/claude-provider.test.ts`
- `tests/client-result.test.ts`
- `tests/context-pipeline.test.ts`
- `tests/daemon-bootstrap.test.ts`
- `tests/env-file.test.ts`
- `tests/intent-router.test.ts`
- `tests/porcelain-parser.test.ts`
- `tests/registry-bootstrap.test.ts`
- `tests/registry.test.ts`
- `tests/shell-contract.test.ts`
- `tests/zsh-widget.test.ts`
