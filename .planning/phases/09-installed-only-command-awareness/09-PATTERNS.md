# Phase 9: Installed-Only Command Awareness - Pattern Map

**Mapped:** 2026-10-08
**Files analyzed:** 25 (13 source, 12 test/fixture)
**Analogs found:** 22 / 25

All analog paths are git-tracked repo source. Spike references live under the tracked
`.claude/skills/spike-findings-tui-llm/sources/` tree.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `shell/zsh/queque.zsh` (mod: `_qq_write_tool_handoff`) | shell widget | file-I/O | same file L186-213 (session dir + request.json) | exact |
| `src/shared/command-words.ts` (new) | utility (lexer) | transform | `.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs` | exact (port) |
| `src/shared/tool-awareness.ts` (new) | utility | transform | `src/shared/privacy-filter.ts`, `src/shared/qq-config.ts` (pattern lists) | role-match |
| `src/client/tool-handoff.ts` (new) | utility (reader) | file-I/O | `src/shared/env-file.ts` (read + split lines) | role-match |
| `src/contracts/request.ts` (mod) | contract/schema | request-response | same file L74-94 `contextChunkSchema` | exact |
| `src/contracts/ipc.ts` (mod) | contract | request-response | same file L34-37 pong | exact |
| `src/daemon/server.ts` (mod) | daemon handler | request-response | same file L72 `writeJson({kind:'pong',fetchCandidates:true})` | exact |
| `src/daemon/bootstrap.ts` (mod) | service | request-response | same file L45-70 `pingDaemonFetchCap`, L211-216 | exact |
| `src/providers/steering.ts` (new) | service (prompt builder) | transform | `src/providers/claude.ts` `QUEQUE_SYSTEM` / `buildPrompt` | role-match |
| `src/providers/claude.ts` (mod) | provider | request-response | same file L174 | exact |
| `src/providers/claude-cli.ts` (mod) | provider | request-response | same file L31-33 | exact |
| `src/client/run-foreground.ts` (mod) | controller | request-response | same file L280-284 (rerender), L196 viewport, L31-33 | exact |
| `src/ui/CandidateSelect.tsx` (mod) | component | event-driven | same file L21-24, L86-87, L162-175, L254-256, footer block | exact |
| `src/ui/ControlsLine.tsx` (mod) | component | presentational | same file L5-30 | exact |
| `src/ui/modal-layout.ts` (mod) | utility | transform | same file L110-126 | exact |
| `docs/EXTENSIONS.md` (mod) | docs | - | - | n/a |
| `tests/fixtures/command-words-cases.ts` (new) | test fixture | - | spike `002-candidate-binary-check/cases.mjs` | exact (port) |
| `tests/fixtures/command-words-fuzz-child.mjs` (new) | test harness | batch | spike 002 `fuzz-child.mjs` + `find-hang.mjs` | exact (port) |
| `tests/command-words.test.ts` (new) | test | - | `tests/privacy-filter.test.ts` (table tests) | role-match |
| `tests/command-words-fuzz.test.ts` (new) | test | batch | `tests/zsh-widget.test.ts` (`spawnSync` harness) | role-match |
| `tests/tool-awareness.test.ts` (new) | test | - | `tests/privacy-filter.test.ts` | role-match |
| `tests/tool-handoff.test.ts` (new) | test | file-I/O | `tests/env-file.test.ts` | role-match |
| `tests/steering.test.ts` (new) | test | - | `tests/claude-provider.test.ts` | role-match |
| `tests/controls-line.test.tsx` (new) | test | - | `tests/candidate-select.test.tsx` | partial (that file mocks ControlsLine) |
| `tests/zsh-widget.test.ts`, `tests/daemon-bootstrap.test.ts`, `tests/candidate-select.test.tsx`, `tests/modal-layout.test.ts`, `tests/claude-*-provider.test.ts` (mod) | test | - | themselves | exact |

## Pattern Assignments

### `shell/zsh/queque.zsh` (shell widget, file-I/O)

**Analog:** same file, L186-213. Session dir is created here; call the new helper right after the
`request.json` heredoc (before the qq_cmd build, so both Zellij and inline launches see it):
```zsh
  local tmpdir req_file
  tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)
  chmod 700 "$tmpdir"
  req_file="$tmpdir/request.json"
  _qq_log "tmpdir=${tmpdir}"
  trap "_qq_cleanup '$tmpdir'" EXIT ERR INT
  ...
  cat > "$req_file" <<JSON
{
  "version": 1,
  ...
}
JSON
  # <-- _qq_write_tool_handoff "$tmpdir" goes here
```
**New helper (top level, so tests can call it like `_qq_capture_buffers`)** - per D-01 as amended:
```zsh
_qq_write_tool_handoff() {
  local dir="$1"
  zmodload zsh/parameter 2>/dev/null
  rehash
  print -rl -- ${(k)commands} > "$dir/commands.txt"
  print -rl -- ${(k)builtins} > "$dir/builtins.txt"
  print -rl -- ${(k)functions:#_*} ${(k)aliases} > "$dir/functions.txt"
}
```
Rules: no `for` loops, no `(o)`/`(ko)` sort, always `rehash` (D-19). `version` stays `1` (fixed sibling filenames).

---

### `src/shared/command-words.ts` (utility, transform)

**Analog:** `.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs` - port
`lexHand`, `commandWords`, `WRAPPERS`, `RES_EXPECT`, `RES_LOOP`, `SHELLS`, `ASSIGN_RE`, `PLACEHOLDER_RE`,
`REDIR_RE` line for line; drop `fromShellQuote`. Word kinds verbatim:
`'external'|'builtin'|'placeholder'|'dynamic'|'path'`.
Constraints: **zero imports, erasable TS only** (no enum/namespace/param properties) so the `.mjs` fuzz
child can `import '../../src/shared/command-words.ts'` under Node 24 type stripping. Add: clamp every
`indexOf` (`< 0 -> s.length`), recursion depth cap (~32), public `extractCommandWords(cmd, builtins)`
wrapper with `try {…} catch { return [] }` and `cmd.length > 8192 -> []`.

---

### `src/shared/tool-awareness.ts` (utility, transform)

**Analog:** `src/shared/qq-config.ts` L21-28 (`DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS` - shipped constant
list style) and `src/shared/privacy-filter.ts` (pure exported functions). Exports: `CATALOG`, `CATALOG_SET`
(seed from `.claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts`),
`PACKAGE_ALIASES`, `ToolInventory { installed; builtins; functions }`, `DisplayCandidate`,
`missingTools(cmd, inv)` (dedupe via Set; treat `functions` names as installed per amended D-01),
`pickInstaller(installed, platform)`, `buildInstallForm(cmd, missing, installer)`.
Sketch from RESEARCH Pattern 4/9:
```ts
export function missingTools(command: string, inv: ToolInventory): string[] {
  const seen = new Set<string>();
  for (const { word, kind } of extractCommandWords(command, inv.builtins)) {
    if (kind === 'external' && !inv.installed.has(word) && !inv.functions.has(word)) seen.add(word);
  }
  return [...seen];
}
const INSTALLERS = {
  brew:   (p: string[]) => `brew install ${p.join(' ')}`,
  apt:    (p: string[]) => `sudo apt install ${p.join(' ')}`,
  dnf:    (p: string[]) => `sudo dnf install ${p.join(' ')}`,
  pacman: (p: string[]) => `sudo pacman -S ${p.join(' ')}`,
};
```
Package-name gate `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/`; wrap `{ cmd; }` when lexer shows top-level `;`, `||`, `&`, newline.

---

### `src/client/tool-handoff.ts` (reader, file-I/O)

**Analog:** `src/shared/env-file.ts` L1-40 (node fs imports, `content.split(/\r?\n/)`, skip empty lines).
Use `node:fs/promises` + `node:path` and `appendDebugLog` from `src/shared/debug-log.ts`:
```ts
export async function readToolHandoff(sessionDir: string): Promise<ToolInventory | null> {
  if (process.env.QQ_TOOL_AWARENESS === '0') return null;
  try {
    const [c, b, f] = await Promise.all(['commands.txt','builtins.txt','functions.txt']
      .map((n) => fsp.readFile(path.join(sessionDir, n), 'utf8')));
    const split = (s: string) => new Set(s.split('\n').filter(Boolean));
    const installed = split(c);
    return installed.size > 0 ? { installed, builtins: split(b), functions: split(f) } : null;
  } catch (error) {
    void appendDebugLog('client', 'tool handoff unavailable', { message: String(error) });
    return null;
  }
}
```
(Planner decides whether a missing `functions.txt` alone degrades to an empty set rather than null.)
Log counts only, never names.

---

### `src/contracts/request.ts` (schema)

**Analog:** same file L74-94:
```ts
export const contextChunkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('git'), payload: z.object({ ... }) }),
  z.object({
    kind: z.literal('filesystem'),
    payload: z.object({
      cwd: z.string(),
      /** Apparent filename extracted from query text. No file bytes read. */
      apparentFilename: z.string().nullable(),
    }),
  }),
]);
```
Add the third variant `installed-tools` with `tools: z.array(z.string()).max(CATALOG.length).refine(ts => ts.every(t => CATALOG_SET.has(t)))`, plus a doc comment in the same privacy-review style as the union header (L70-73).

---

### `src/contracts/ipc.ts` / `src/daemon/server.ts` / `src/daemon/bootstrap.ts` (capability bump)

**ipc.ts L34-37:**
```ts
  z.object({
    kind: z.literal('pong'),
    fetchCandidates: z.literal(true).optional(),
  }),
```
-> add `installedTools: z.literal(true).optional()`.
**server.ts L72:** `writeJson({ kind: 'pong', fetchCandidates: true });` -> add `installedTools: true`; update header comment L11.
**bootstrap.ts L45 `pingDaemonFetchCap(): Promise<'yes'|'no'|'unknown'>`** - pong lacking `installedTools` must resolve `'no'`; timeout stays `'unknown'` (kept, L211-216):
```ts
    const cap = await pingDaemonFetchCap(socketPath);
    if (cap !== 'no') { ...; return; }
    await replaceStaleListener(socketPath);
```

---

### `src/providers/steering.ts` (new) + `claude.ts` / `claude-cli.ts`

**Analog:** `src/providers/claude.ts` L39-40 `export const QUEQUE_SYSTEM = '…'` and L170-178:
```ts
    const response = await client.messages.create(
      { model, max_tokens: 1024, system: QUEQUE_SYSTEM, messages: [{ role: 'user', content: prompt }] },
      { timeout: timeoutMs },
    );
```
-> `system: buildSystemPrompt(envelope)`.
**claude-cli.ts L31-33:** `'--system-prompt', QUEQUE_SYSTEM, prompt,` -> `buildSystemPrompt(envelope)`.
`buildSystemPrompt` runs `filterContextEnvelope` (`src/shared/privacy-filter.ts`) first and returns
`QUEQUE_SYSTEM` byte-for-byte when no `installed-tools` chunk is present. Do not touch `buildPrompt`'s
user JSON (Pitfall 8). Import `QUEQUE_SYSTEM` from `./claude` (avoid circular: steering imports claude, claude imports steering -> planner should move `QUEQUE_SYSTEM` into steering.ts or a `system-prompt.ts` and re-export from claude.ts).

---

### `src/client/run-foreground.ts` (controller)

**Hook point L280-284:**
```ts
fetchCandidatesForUi(socketPath, envelope)
  .then((candidates) => {
    void appendDebugLog('client', 'candidates received', { count: candidates.length });
    app.rerender(buildCandidateElement(candidates));
```
Annotate `missingTools` between receipt and `rerender` (pass-through when inventory null). Read the
handoff eagerly at start from `path.dirname(requestFile)` (Pitfall 7), push `installed-tools` chunk
(sorted `CATALOG ∩ installed`) onto `envelope.extras` after `gatherContext()`.
**L196:** `const MODAL_VIEWPORT_LINES = 16;` -> raise (~20) for the extra footers (Pitfall 4).
**L31-33 `buildShellBuffers`** placeholder cursor logic - unchanged; add test for `brew install fd && fd <pattern>`.

---

### `src/ui/CandidateSelect.tsx` (component, event-driven)

**Constants (L21, L24):**
```ts
const DESTRUCTIVE_WARNING_MARK = '⚠';
const DESTRUCTIVE_WARNING_TEXT = `${DESTRUCTIVE_WARNING_MARK} review carefully — this command may be destructive`;
```
Add sibling `MISSING_TOOL_MARK = '⊘'` (cyan).
**State (L86-87):** new install-toggle `useState` MUST come after `selectedIndex` and `query` (tests index useState by call order). Key toggles by `${command}::${explanation}` (L236 key); reset on `candidates` change.
**Key handling (L162-175)** - insert `key.tab` branch before this block, return early:
```ts
      if (key.return && candidates) {
        const visible = filterCandidates(candidates, query);
        if (visible.length === 0) return;
        const selected = visible[selectedIndex] ?? visible[0];
        const command = normalizeCommand(selected.command);
        const explanation = selected.explanation || `see man ${command.split(' ')[0]}`;
        onSelect(command, explanation);
        return;
      }
      if (input && !key.ctrl && !key.meta) { setQuery((q) => q + input); return; }
```
Enter sends the displayed (install-form) command; explanation fallback uses the original.
**Inline mark (L254-256):**
```tsx
                      {isLastCommandLine && destructive && (
                        <Text color="yellow">{` ${DESTRUCTIVE_WARNING_MARK}`}</Text>
                      )}
```
**Footer (bottom of render):**
```tsx
      {showDestructiveWarning && (
        <Box marginTop={1}>
          <Text color="yellow">{DESTRUCTIVE_WARNING_TEXT}</Text>
        </Box>
```
Add an analogous flag footer: `not installed: fd, xh` / `not installed: fd — no package manager found` / `will install: fd, xh`. Spacing via `marginTop` props only.

---

### `src/ui/ControlsLine.tsx` (component)

**Analog:** same file - chip pairs:
```tsx
      <Text dimColor>{' · '}</Text>
      <Text backgroundColor="ansi256(238)" color="white" bold>{' esc '}</Text>
      <Text backgroundColor="ansi256(245)" color="black">{' cancel '}</Text>
```
Add optional prop `tabHint?: 'install' | 'undo install'`; render ` tab ` / ` install ` chips the same way when set.

---

### `src/ui/modal-layout.ts` (utility)

**Analog:** L110-126:
```ts
  const showDestructiveWarning =
    selectedCommand !== undefined && isDestructiveCommand(selectedCommand);
  if (showDestructiveWarning) {
    lines += 1; // marginTop
    lines += 1; // warning text
  }
```
Add same +2 for the flag footer; wrap the displayed (install-form) command; new inputs: toggle state + missing tools.

---

### Tests

- **zsh tests** (`tests/zsh-widget.test.ts` L19-30 harness: `spawnSync`, real zsh, `widgetPath`): add freshness case (RESEARCH "zsh freshness test"), functions.txt case, static source check (no `(kv)` loop / `(ko)`), timing guard median-of-5 < 25 ms printing median (D-19). No stubs.
- **fuzz** (`tests/command-words-fuzz.test.ts`): `spawnSync(process.execPath, [child, 'fuzz', '20000'], { timeout: 15_000 })`; crafted cases from spike `find-hang.mjs` at 1 s; deep `'$('×2000` < 100 ms.
- **candidate-select.test.tsx**: useState mock by index (L449, L576-630) - keep new state last; ControlsLine is mocked (~L45), hence separate `tests/controls-line.test.tsx`.
- **client-result.test.ts**: leave fs passthrough as is; it exercises the null-handoff fallback.
- Run single files with `pnpm exec vitest run tests/x.test.ts`.

## Shared Patterns

### Debug logging
**Source:** `src/shared/debug-log.ts` via `void appendDebugLog('client' | 'daemon', msg, {...})` (e.g. run-foreground L282, bootstrap L210). Apply to handoff reader and annotation; counts only.

### Privacy filter before prompt
**Source:** `src/shared/privacy-filter.ts` `filterContextEnvelope` - apply in `buildSystemPrompt`.

### Wave 0 stubs
Throw-on-call stubs with public exports for each new `src/` module before RED tests (cerebrum: tsc in pre-commit).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/fixtures/command-words-fuzz-child.mjs` | harness | batch | No in-repo `.mjs` child; port from spike 002 `fuzz-child.mjs` |
| `tests/controls-line.test.tsx` | test | - | ControlsLine has no test today; follow ink render style of candidate-select tests without its mocks |
| `docs/EXTENSIONS.md` line | docs | - | Plain doc note: adapters must call `buildSystemPrompt(envelope)` |

## Metadata

**Analog search scope:** `shell/zsh`, `src/{contracts,daemon,providers,client,ui,shared}`, `tests/`, spike sources
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-08
