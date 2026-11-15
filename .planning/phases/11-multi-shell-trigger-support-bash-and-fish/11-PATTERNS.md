# Phase 11: Multi-shell trigger support (bash, fish-ready) - Pattern Map

**Mapped:** 2026-11-13
**Files analyzed:** 30 (new + modified)
**Analogs found:** 28 / 30

All analog paths below are git-tracked (verified with `git ls-files`). Spike sources under `.claude/skills/spike-findings-tui-llm/sources/` are reference material only, not production analogs.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `shell/bash/queque.bash` (NEW) | shell adapter | event-driven (keypress) + file-I/O | `shell/zsh/queque.zsh` (+ spike 005 `queque.bash`) | exact (role) |
| `src/shared/instant-frame-spec.ts` (NEW) | utility (pure oracle) | transform | `src/client/instant-frame.ts` + `_qq_instant_frame` in `shell/zsh/queque.zsh:100-150` | role-match |
| `src/shared/shell-registry.ts` (NEW) | config/registry | static lookup | `src/registry/bootstrap.ts` + `src/cli/commands/init.ts:11-26` | partial |
| `tests/bash-widget.test.ts` (NEW) | test | spawn-shell | `tests/zsh-widget.test.ts` | exact |
| `tests/instant-frame-parity.test.ts` (NEW) | test | transform parity | `tests/zsh-widget.test.ts` z5 (lines ~1051-1062) | role-match |
| `tests/shell-pty.test.ts` (NEW) | test (integration) | PTY round-trip | `tests/bundle-startup.test.ts` (tsup build to temp dir) | role-match |
| `tests/pty/drive.sh` (NEW) | test helper script | PTY driving | spike 005 `drive.sh` (untracked reference) | no tracked analog |
| `tests/helpers/shells.ts` (NEW) | test helper | probe | `scripts/smoke-distro.sh:67-75` (CI-must-fail rule) | partial |
| `src/contracts/shell.ts` | contract (zod) | validation | itself (lines 8-15) | exact |
| `src/contracts/request.ts` | contract | validation | itself (line 67-68) | exact |
| `src/context/base-context.ts` | service | transform | itself (line 13) | exact |
| `src/contracts/telemetry.ts` | contract | validation | itself (lines 85-93) | exact |
| `src/shared/environment-shape.ts` | utility | transform | itself (64-68, 98-99) | exact |
| `src/contracts/doctor.ts` | contract | validation | itself (12-25) | exact |
| `src/cli/commands/doctor.ts` | CLI command | request-response (probes) | itself (`DoctorDeps`, `BINDINGS_SCRIPT`) | exact |
| `src/cli/commands/init.ts` | CLI command | file-I/O (rc write) | itself | exact |
| `src/cli/main.ts` | CLI wiring | request-response | itself (100-106) | exact |
| `src/registry/bootstrap.ts` | registry | startup | itself (32-36) | exact |
| `src/shared/command-words.ts` | utility (lexer) | transform | itself (296-319, 387-392) | exact |
| `src/shared/tool-awareness.ts` | utility | transform | itself (8-15) | exact |
| `src/client/tool-handoff.ts` | service | file-I/O (poll) | itself (38-68) | exact |
| `src/client/run-foreground.ts` | client orchestration | request-response | itself (168-172, 267, 293, 513) | exact |
| `src/providers/claude.ts` (`buildPrompt`) | provider | request-response | itself (358-382) | exact |
| `src/providers/ollama.ts`, `openai.ts`, `src/cli/commands/init-provider.ts` | copy only | — | — | exact |
| `tests/telemetry-contract.test.ts`, `tests/doctor.test.ts`, `tests/init-command.test.ts` | test | — | themselves | exact |
| `.github/workflows/ci.yml` | CI config | batch | itself (66-68) | exact |
| `.github/workflows/distro.yml`, `scripts/smoke-distro.sh`, `scripts/smoke-distro.exp`, `scripts/smoke-distro-runner.sh`, `scripts/install-distro-deps.sh` | CI/smoke | batch | themselves | exact |
| `.github/workflows/homebrew.yml`, `release.yaml`, `scripts/smoke-homebrew-docker.sh` | packaging | batch | `homebrew.yml:66` install line | exact |
| README, docs/INSTALL, PRIVACY, etc. | docs | — | — | n/a |
| `shell/README.md` (optional) | docs | — | none | no analog |

## Pattern Assignments

### `shell/bash/queque.bash` (shell adapter, event-driven)

**Analog:** `shell/zsh/queque.zsh`; trigger core from spike 005 (see RESEARCH Pattern 1).

**Constant block to mirror verbatim (queque.zsh:88-96)** - keep the same names and the "mirrors X" comments so the parity test and reviewers can map them:
```zsh
typeset -g QQ_MODAL_VIEWPORT_LINES=18          # mirrors MODAL_VIEWPORT_LINES (modal-layout.ts)
typeset -g QQ_MODAL_MAX_COLUMNS=80             # mirrors MODAL_MAX_WIDTH (CandidateSelect / Modal)
typeset -g QQ_MODAL_PADDING_COLUMNS=1
typeset -g QQ_ZELLIJ_FRAME_COLUMNS=2
typeset -g QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING=2
typeset -g QQ_INSTANT_FRAME_LOADING_TEXT='thinking…'
typeset -g QQ_INSTANT_FRAME_FILE='instant-frame.txt'
typeset -g QQ_PANE_PAINT_SCRIPT='cat "$1" 2>/dev/null; shift; exec "$@"'
```
In bash use plain globals (not `readonly`: the file is re-sourced in dev, same reason as the zsh comment).

**Frame function shape (queque.zsh:100-137)** - port `_qq_instant_frame` to set `REPLY`, honor `QQ_INSTANT_FRAME=0`, locale probe on `'›'`, strip `[[:cntrl:]]`, clamp columns to 80, header only when raw `$1` non-empty, truncate to `width-1` + `…`, 2 empty rows, then loading text, joined by `\r\n`. bash port idioms are in RESEARCH Pattern 3 "bash port notes".

**Inline bytes (queque.zsh:142-150):**
```zsh
REPLY="${(pl:QQ_MODAL_VIEWPORT_LINES::\n:)}"$'\e['"${QQ_MODAL_VIEWPORT_LINES}A"$'\r\e7\e[J'"${frame}"$'\e8'
```

**Debug log (queque.zsh:~190-195)** - same format, tag `[bash]`:
```zsh
print -r -- "$(date '+%Y-%m-%dT%H:%M:%S%z') [zsh] $message" >> "$QQ_DEBUG_LOG_FILE" 2>/dev/null
```

**Daemon prewarm (queque.zsh:197-210)** - copy logic; replace zsh `&!` with bash `( ... & )` subshell form (only silent form per RESEARCH job-control probe):
```zsh
_qq_prewarm_daemon() {
  if [[ "$QQ_DAEMON_PREWARMED" == 1 ]]; then return 0; fi
  QQ_DAEMON_PREWARMED=1
  (
    if [[ -n "$QQ_DEV_ROOT" && -f "$QQ_DEV_ROOT/dist/cli/main.js" ]] && command -v node >/dev/null 2>&1; then
      command node "$QQ_DEV_ROOT/dist/cli/main.js" daemon --ensure
    elif command -v qq >/dev/null 2>&1; then
      command qq daemon --ensure
    fi
  ) >/dev/null 2>&1 &!
}
```

**Other zsh sections to mirror (line refs from RESEARCH, read them when implementing):** `setopt interactivecomments` (12) -> `shopt -s interactive_comments`; history `print -s` (~289) -> `history -s -- "$QQ_ORIG_LBUFFER"`; request heredoc (409-418) -> `command jq -n --arg ...` adding `shell:"bash", shellVersion`; Zellij pane frame + `/bin/sh -c "$QQ_PANE_PAINT_SCRIPT"` (446-456); FIFO read (467) -> `IFS= read -r -t 30`.

**Bash-only hardening (no zsh analog, from RESEARCH Pattern 1/4):** interactive guard before version guard; `local -; set +euE +o pipefail`; `command` prefix on externals except `zellij`; `${VAR:-}`; `tools.pending` marker + detached writer + two-flag cleanup; never chain on `compgen` status; quote `READLINE_LINE="${lbuf}?${rbuf}"`; bind only `emacs` and `vi-insert`.

---

### `src/shared/instant-frame-spec.ts` (utility, transform)

**Analog:** `src/client/instant-frame.ts`

**Module doc + exported-constant style (lines 1-35):** JSDoc header citing the quick-task / decision id, one-line `/** ... */` per exported constant:
```typescript
/** `ESC 7`: save the cursor position. */
export const SAVE_CURSOR = '\u001B7';
/** `CSI J`: erase from the cursor to the end of the screen. */
export const ERASE_BELOW = '\u001B[J';
/** `CSI H`: move the cursor to the top-left cell. */
export const CURSOR_HOME = '\u001B[H';
```
**Reuse, do not duplicate (lines 47-55):**
```typescript
export function inlineScrollReserve(lines: number): string {
  return `${'\n'.repeat(lines)}\u001B[${lines}A\r${SAVE_CURSOR}`;
}
```
Import `SAVE_CURSOR`, `ERASE_BELOW`, `CURSOR_HOME`, `RESTORE_CURSOR`, `inlineScrollReserve` from `../client/instant-frame.js` and `MODAL_VIEWPORT_LINES` from `../ui/modal-layout.js` (relative `.js` ESM imports, project convention). `inlineInstantFrameBytes = inlineScrollReserve(18) + ERASE_BELOW + rows + RESTORE_CURSOR`; `paneInstantFrameBytes = rows + CURSOR_HOME`. Update the comment at instant-frame.ts:51 ("tests/zsh-widget.test.ts z5 guards the drift") to point at the parity test.

---

### `src/shared/shell-registry.ts` (registry, static)

**Analogs:** `src/cli/commands/init.ts:11-26` (what moves in), `src/registry/bootstrap.ts:32-36` (registration).

Current state to generalize:
```typescript
const SUPPORTED_SHELLS = ['zsh'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];
const HOMEBREW_PREFIXES = ['/opt/homebrew', '/usr/local', '/home/linuxbrew/.linuxbrew'];
function _resolveScriptPath(shell: Shell): string {
  for (const prefix of HOMEBREW_PREFIXES) {
    const p = resolve(prefix, 'share', 'queque', `queque.${shell}`);
    if (existsSync(p)) return p;
  }
  return resolve(__dirname, '../../shell', shell, `queque.${shell}`);
}
```
```typescript
registerShellAdapter({ id: 'zsh', shell: 'zsh', description: 'zsh ZLE widget adapter (Phase 2 built-in)' });
```
Add a sibling `registerShellAdapter({ id: 'bash', shell: 'bash', ... })` - init validates via `listShellAdapters()` (init.ts:44). Use the `ShellSpec` interface from RESEARCH Pattern 5. Import `ShellName`/`SHELL_NAMES` from `src/contracts/shell.ts` (single source).

---

### `src/cli/commands/init.ts` (CLI, file-I/O)

**Analog:** itself. Keep `hasShellIntegration` (lines 32-39, already shell-parameterized):
```typescript
export function hasShellIntegration(existing: string, shell: Shell): boolean {
  if (/# queque shell integration/.test(existing)) return true;
  const scriptPattern = new RegExp(`source\\s+["'][^"']*queque\\.${shell.replace('.', '\\.')}["']`);
  return scriptPattern.test(existing);
}
```
Replace hardcodes at 51 (`join(homedir(), '.zshrc')`), 58/63 (`~/.zshrc` messages) with `spec.rcPath(home)` / `spec.rcDisplay`. Refactor `initCommand(shell?: string, deps = defaultDeps)` mirroring doctor's injectable `DoctorDeps` (below). Error style: `console.error(...)` + `process.exit(n)` as in lines 46-48.

---

### `src/cli/commands/doctor.ts` (CLI, probes)

**Analog:** itself.

**Threshold constants (lines 33-36)** - add bash pair next to them in identical style:
```typescript
/** zsh below this version cannot run the widget: `zsh` fails (D-20). */
export const ZSH_FAIL_BELOW = '5.0';
/** zsh below this version is untested: `zsh` warns (D-20; 5.8 is Ubuntu 22.04, the oldest CI). */
export const ZSH_WARN_BELOW = '5.8';
```
-> `BASH_FAIL_BELOW = '5.0'`, `BASH_WARN_BELOW = '5.1'` (cite D-12).

**Injectable deps (lines 55-75)** - generalize these three members, keep the rest:
```typescript
  zshVersion(): Promise<string | null>;
  zshBindings(): Promise<ZshBindings | null>;
  readZshrc(): string | null;
```
-> `shellVersion(shell)`, `shellBindings(shell)`, `readRc(path)`.

**Binding probe script (lines ~184-186)** - bash equivalent uses the same `__qq_<keymap>__` marker convention:
```typescript
const BINDINGS_SCRIPT =
  `print -r -- "__qq_emacs__ $(bindkey -M emacs '?')"; ` +
  `print -r -- "__qq_viins__ $(bindkey -M viins '?')"`;
```
Timeouts reuse `ZSH_VERSION_TIMEOUT_MS`/`ZSH_BINDINGS_TIMEOUT_MS`/`EXIT_GRACE_MS` (rename-neutral or add `SHELL_*`). Doctor copy rule: fixed strings + `rcDisplay` literals only.

---

### `src/contracts/shell.ts`, `request.ts`, `doctor.ts`, `telemetry.ts` (contracts, zod)

**Analog:** each file itself; exact before/after given in RESEARCH Inventory rows 1, 2, 5, 7 and Patterns 2/6.

Telemetry field style to copy (telemetry.ts:85-93):
```typescript
const environmentFields = {
  os: z.enum(OS_KINDS),
  arch: z.enum(ARCH_KINDS),
  distro: z.enum(DISTRO_IDS),
  /** zsh major.minor only: `5.9`, never `5.9-dev-1` or a build string. */
  zsh: z.union([z.string().regex(/^\d{1,2}\.\d{1,2}$/), z.literal('unknown')]),
  node_major: z.number().int().min(18).max(99),
  zellij: z.boolean(),
};
```
Add `SHELL_KINDS` as a top-level `as const` array next to `OS_KINDS`/`ARCH_KINDS` (file is the allow list); add, never rename. Update pinned `ENVIRONMENT_KEYS` in `tests/telemetry-contract.test.ts:339`.

---

### `src/client/tool-handoff.ts` (service, file-I/O)

**Analog:** itself (lines 38-68). Keep the never-throw + reason-only debug log pattern:
```typescript
  } catch (error) {
    void appendDebugLog('client', 'tool handoff unavailable', { reason: errorReason(error) });
    return null;
  }
```
Add `opts?: { pendingBudgetMs?: number }`; before `Promise.all`, poll `tools.pending` (~10 ms, budget 500 ms) and log `{ reason: 'pending-timeout' }` on timeout. No marker -> unchanged path (zsh). Add marker name to `TOOL_HANDOFF_FILES` in `src/shared/tool-awareness.ts`. In `run-foreground.ts:171-172` start the promise there, `await` it just before `withInstalledToolsChunk` (line 293).

---

### `src/shared/command-words.ts` (lexer)

**Analog:** itself. Turn `RES_EXPECT` / `RES_LOOP` (296-319, 387-392) into per-dialect tables keyed by `ShellName`; default param `shell: ShellName = 'zsh'` keeps existing callers/tests valid. fish maps to the bash table for now.

---

### `tests/bash-widget.test.ts` (test, spawn-shell)

**Analog:** `tests/zsh-widget.test.ts`

**Header doc + imports (lines 1-36)** - copy the strategy docblock and import set:
```typescript
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { inlineScrollReserve } from '../src/client/instant-frame.js';
import { MODAL_VIEWPORT_LINES } from '../src/ui/modal-layout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetPath = join(__dirname, '..', 'shell', 'zsh', 'queque.zsh');
```
**Runner helper (lines 45-56)** -> `runBash` with `bash5 --noprofile --norc -c` (binary from `findShell('bash',{min:5})`):
```typescript
function runZsh(script: string): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('zsh', ['-f', '-c', `source ${widgetPath}\n${script}`], {
    encoding: 'utf8', timeout: 5000, env: { ...process.env, PATH: process.env.PATH },
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
}
```
Interactive variant: `runInteractiveZsh` (`-fi`) -> `bash --noprofile --norc -i -c`. Strip `ZELLIJ*`/`TMUX` from env (cerebrum Do-Not-Repeat). Test ids: `b1..` mirroring `z1..`. Required extra cases: non-interactive source silent (also bash 3.2), version refusal line, `set -e` survives, alias/function shadowing (`alias grep=...; jq(){...}`), no `[1]` job notice, `compgen -a` empty-alias case.

---

### `tests/instant-frame-parity.test.ts` (test, parity)

**Analog:** z5 in `tests/zsh-widget.test.ts:~1051-1062` (asserts inline bytes start with `inlineScrollReserve(MODAL_VIEWPORT_LINES)`). Generalize to `describe.each(ADAPTERS)` comparing each adapter's `_qq_instant_frame` / `_qq_inline_instant_frame_bytes` / pane writer output `===` the TS oracle over the fixture table in RESEARCH Pattern 3 step 3.

---

### `tests/shell-pty.test.ts` (integration test, PTY)

**Analog:** `tests/bundle-startup.test.ts`

**Imports + build-to-temp pattern (lines 1-9, 35):**
```typescript
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, type Options } from 'tsup';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import tsupConfig from '../tsup.config.js';

const BUILD_TIMEOUT_MS = 180_000;
```
Copy the long header comment style (lines 11-33: what regression, what is checked, "No timing assertions: wall time flakes under load"). `beforeAll` builds once with the real tsup config into a temp dir, `afterAll` removes it; then `describe.each(['zsh','bash'])` drives `tests/pty/drive.sh <shell>` with `--result-mode replace-buffer-fixture`, private tmux server (`-L`, `-f /dev/null`), `env -u ZELLIJ -u ZELLIJ_PANE_ID -u ZELLIJ_SESSION_NAME -u TMUX`, `QQ_DAEMON_PREWARMED=1`, throwaway `HOME`. Assert no `[1]`/`Done` in capture.

### `tests/helpers/shells.ts` (test helper)
**Analog rule:** `scripts/smoke-distro.sh:67-75` - missing dependency is a skip locally but a hard failure when `CI` is set. Implement `findShell(name, {min})` returning path or throwing under `process.env.CI`.

---

### CI and smoke edits

**`.github/workflows/ci.yml:66-68`** current:
```yaml
      - name: Install shell test dependencies
        run: sudo apt-get update && sudo apt-get install -y zsh jq
```
-> add `bash tmux` (ubuntu-latest bash is 5.x). Same edit at `release.yaml:29`. `scripts/install-distro-deps.sh`: add `tmux` for all five families, `bash tmux` on alpine (line ~96). `scripts/smoke-distro.exp`: take shell as second arg; per-shell prompt regex `QQSMOKE[%#$] `, not-found regex, `echo restored-$((6*7))`; new exit code (e.g. 37) for `qq init bash`. `scripts/smoke-distro-runner.sh:120` keep `>= 11` doctor checks. `.github/workflows/distro.yml`: add bash leg/pass per distro plus optional `bash:<tag>` version-matrix job (3.2/4.4 refuse, 5.0 accept). Lint workflows with actionlint, adapter with shellcheck (Biome ignores both).

**Homebrew:** `homebrew.yml:66` and `release.yaml:188`:
```ruby
(share/"queque").install "shell/zsh/queque.zsh"
```
-> add `(share/"queque").install "shell/bash/queque.bash"`; mirror in `scripts/smoke-homebrew-docker.sh:106`. Do not rename step "Release to Homebrew tap". Caveats (homebrew.yml:83-84, release.yaml:205-206) -> `qq init`.

## Shared Patterns

### Shell identity type
**Source:** new `SHELL_NAMES` in `src/contracts/shell.ts`. **Apply to:** request.ts, base-context.ts, shell-registry.ts, command-words.ts, tool-awareness.ts, environment-shape.ts. Telemetry declares its own `SHELL_KINDS` (contract file is the allow list).

### Additive contract evolution
**Source:** comments in `src/contracts/telemetry.ts` / `doctor.ts` ("add, do not rename"). **Apply to:** all contract edits; new request fields `.default('zsh')` / `.optional()`, `version: z.literal(1)` unchanged.

### Never-throw + reason-only debug logging
**Source:** `src/client/tool-handoff.ts:38-68` (`void appendDebugLog('client', ..., { reason })`). **Apply to:** pending-marker wait, any new client-side reader.

### Injectable deps for CLI commands
**Source:** `DoctorDeps` in `src/cli/commands/doctor.ts:55-75`. **Apply to:** refactored `initCommand`, per-shell probes; tests in `tests/doctor.test.ts` / `tests/init-command.test.ts` pass fakes, never spawn real shells.

### Test env isolation
**Source:** cerebrum Do-Not-Repeat 2026-11-13. **Apply to:** bash-widget, parity, shell-pty tests: unset `ZELLIJ*`/`TMUX`, fake `zellij` as a shell function.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/pty/drive.sh` | test driver | PTY | Only the untracked spike `.claude/skills/spike-findings-tui-llm/sources/005-bash-tui-handoff/drive.sh` exists; productionize it with a shell parameter |
| `shell/README.md` (optional) | docs | — | No adapter-author doc exists; content list in RESEARCH Recommended Project Structure |

## Metadata

**Analog search scope:** `shell/`, `src/client`, `src/cli/commands`, `src/contracts`, `src/registry`, `src/shared`, `tests/`, `scripts/`, `.github/workflows/`
**Files scanned:** ~16 read directly, remainder line refs taken from RESEARCH.md (verified this session by the researcher)
**Pattern extraction date:** 2026-11-13
