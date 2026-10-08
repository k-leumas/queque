# Phase 9: Installed-Only Command Awareness - Research

**Researched:** 2026-10-08
**Domain:** zsh ZLE handoff, shell-word lexing of untrusted model output, prompt steering, Ink keyboard UX
**Confidence:** HIGH for the codebase seams, the handoff, and the lexer. MEDIUM for the steering wording (spike 003 only got partway). MEDIUM for the timing budget (it measured over target today, see Pitfall 1).

## Summary

Phase 9 is almost entirely in-repo work and adds **no npm dependencies**. Spikes 001–003 already proved the three mechanisms:
- a zsh `rehash` + `print -rl -- ${(k)commands}` handoff into the private session tmpdir
- a hand-written lexer that pulls every command word out of a candidate in about 3.5 µs
- prompt steering with `catalog ∩ installed`

This research found where each one plugs into the current code, plus four integration hazards the spikes didn't cover.

1. **Stale daemon (new client, old daemon).** The daemon validates every IPC line with `ipcRequestSchema.safeParse` and silently ignores lines that fail. If you add a new `installed-tools` chunk kind to `contextChunkSchema`, an old daemon (still running after `brew upgrade`) never sends `fetch-accepted`. Every `??` then pays the 800 ms ack timeout plus a cold in-process fetch. Bump the daemon capability advertised in `pong`.
2. **Function-defined tools get false flags.** `nvm` on this machine is a zsh function, not a `$commands` entry (`nvm: cmd=0, fn=1`, probed this session). Under D-01 as written, `nvm use 20` gets flagged "not installed", and `nvm` is never steered as installed. This needs a user decision (Open Question 1).
3. **Timing is over target today.** The handoff measured **~10–12 ms** on this Mac this session (2,176 commands, 26 PATH dirs). The spike measured ~7 ms. SC 2 says "no more than ~10 ms", so a hard 10 ms test would be flaky. Two fallbacks are measured below.
4. **Install-form injection.** The model's command words feed the Tab install form. A quoted word like `"rm -rf ~"` lexes as a single word that isn't installed. Only words matching a strict package-name regex may enter `<installer> <pkg…>`.

**Primary recommendation:** Build these pieces:
- one self-contained `src/shared/command-words.ts`, a TS port of spike 002's `extract.mjs` with no imports and erasable syntax only, so a Node child can run it for the fuzz test
- one `src/shared/tool-awareness.ts` holding the catalog, the alias map, the installer choice, the missing-tool check and the install-form builder
- a `_qq_write_tool_handoff` zsh helper
- an `installed-tools` envelope chunk, validated so its names must be in the catalog
- a provider-neutral `buildSystemPrompt(envelope)`
- client-side flagging right before `app.rerender`

Keep the IPC candidate contract unchanged.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried forward from spikes 001–003 (locked before discussion)
- **D-01:** zsh's `$commands` is the source of truth for what's installed. The `??` widget runs
  `rehash`, then writes `${(k)commands}` and `${(k)builtins}` (names only, a single `print -rl`, no zsh
  loops, no sorting) into the existing private session tmpdir next to `request.json`. Budget: about 7 ms.
  No Node PATH scan, no daemon-side index.
- **D-02:** Builtins (from the `$builtins` handoff, never hardcoded), reserved words, `<placeholders>`,
  `$VAR` commands and path commands (`./x.sh`) are never flagged.
- **D-03:** Command-word extraction uses the spike 002 hand lexer ported to `src/`. It must never hang or
  throw on malformed model output: clamp `indexOf` −1, and fuzz test with a hard per-input timeout.
  shell-quote and sh-syntax are rejected.
- **D-04:** Only `curated catalog ∩ installed` goes into the prompt, never the full `$commands` list
  (spike 003: the full list costs ~33× the tokens and still leaked missing tools). The catalog is a
  public tool-name allow list, so no unusual or internal binary names reach the model. This keeps the
  Phase 6 privacy posture.

#### Install steps and self-installing commands
- **D-05:** The prompt forbids install steps. Candidates must not contain `brew install … && …`
  or similar. An install command appears only when the user presses Tab on a flagged candidate (D-09).
- **D-06:** If a model candidate includes an install step anyway, there is no special handling. Its
  command words are judged like any other: a missing tool is flagged, with no "installs X" label.
- **D-07:** Cases the prompt already prevents get no dedicated handling. Examples: use-before-install
  in one command, or a wrong-OS installer like `apt` on macOS (platform is in the prompt). The user's
  rule: don't build edge-case logic for malformed output the prompt already prevents.

#### Flag presentation (CandidateSelect)
- **D-08:** A flagged candidate shows an inline mark after its last command line, using the Phase 6
  destructive-warning pattern but a **distinct glyph and colour from the yellow `⚠`**. When it is
  selected, a footer line names the missing tools (e.g. `not installed: fd, xh`). A candidate can be
  both destructive and flagged; both marks and footers must be able to show.
- **D-09:** **Tab** on a selected flagged candidate switches that row in place to the install form:
  `<installer> <pkg…> && <original command>`. Tab again reverts it. Enter inserts exactly what the row
  shows. Tab does nothing on a candidate that isn't flagged. Tab is used because Shift alone isn't
  detectable in terminals and Shift+Enter usually sends the same byte as Enter.
- **D-10:** One install covers every missing tool in the candidate: `brew install fd xh && fd … | xh …`.
- **D-11:** The installer is the platform's package manager, chosen from the same `$commands`
  handoff: `brew` on darwin; on Linux the first of `apt`, `dnf`, `pacman` found (Claude chooses
  `sudo` and `-y` conventions per manager). If no manager is found, Tab is unavailable and the footer
  reads `not installed: fd — no package manager found`.
- **D-12:** Package names come from a small **shipped** tool→package alias map (rg → ripgrep,
  magick/convert → imagemagick, nvim → neovim, http → httpie, fdfind → fd-find, …). If a tool isn't in
  the map, its own name is used (a wrong guess fails visibly when the user runs it). The map isn't
  user-extendable.
- **D-13:** Candidates keep the **model's order**. Flagged candidates aren't re-sorted, because Tab
  install makes them usable. This replaces an earlier "sink flagged to the bottom" answer from the
  same discussion.

#### Controls bar
- **D-14:** `tab install` appears in the controls bar (`src/ui/ControlsLine.tsx`) only while the
  selected candidate is flagged and an installer exists. While that row is in its install form, the
  hint reads `tab undo install` and the footer reads `will install: fd, xh`.

#### Steering prompt wording
- **D-15:** The system prompt gets the installed catalog tools plus a "standard system utilities
  are also present" clause (from spike 003), and wording like: prefer installed tools; a
  not-installed tool is acceptable when it is clearly better for the task.
- **D-16:** The prompt requires **at least one candidate that uses only installed tools**, so there
  is always a works-now option.
- **D-17:** The prompt says never to include install steps (D-05).
- **D-18:** The steering text applies to every provider path that uses `QUEQUE_SYSTEM`: the SDK,
  `claude -p --system-prompt`, and any OpenAI/Ollama adapters added by Phase 8 (whichever phase
  ships second wires it).

### Claude's Discretion
- **Curated catalog** (not discussed): where it lives (default: shipped data in `src/`, seeded from
  `.claude/skills/spike-findings-tui-llm/sources/003-prompt-steering/catalog.ts`), and its exact
  contents.
- **On/off and fallback** (not discussed): whether there's a config or env switch, and behaviour when
  the handoff files are missing (e.g. an old widget). Sensible default: skip flagging and steering
  silently and log it to debug output. Never error the `??` request.
- How the handoff file paths reach the client (a request-contract field vs a fixed name in the
  request file's directory), and the `version` bump in `src/contracts/shell.ts`.
- The exact glyph and colour for the flag mark, and the exact footer and hint copy beyond D-11/D-14.
- Whether `missingTools` lives on the candidate contract or is computed in the client at render time.
- The steering prompt's final wording.

### Deferred Ideas (OUT OF SCOPE)
- Finishing spike 003 (`QUERY_START=6`) once Anthropic credits are topped up. This would confirm the
  steering numbers; it is not a build blocker.
- A user-extendable tool→package alias map. Explicitly declined for now (D-12).
- Deriving the catalog from `brew leaves`. Mentioned in spike findings, not chosen.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ-IDs are mapped (ROADMAP: "Requirements: TBD"). The six ROADMAP success criteria (SC) and D-01..D-18 are the source of truth.

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | A tool installed earlier in the same session counts as installed on the next `??` | `rehash` before reading `$commands` in `_qq_write_tool_handoff`. Freshness probe passed this session (Pattern 1) |
| SC-2 | The handoff adds ≤ ~10 ms with ~2k commands | Measured 10–12 ms today. See Pitfall 1 for the test threshold and the two fallbacks |
| SC-3 | A missing tool is flagged and named; the candidate stays selectable and insertion-only | `missingTools()` runs in the client before `rerender`. Inline mark and footer follow the destructive pattern. Enter path unchanged (Pattern 4/5) |
| SC-4 | Builtins, reserved words, `<placeholders>`, `$VAR` and path commands are never flagged | Lexer `kind` classification (`builtin/placeholder/dynamic/path`), builtins from the handoff (Pattern 2) |
| SC-5 | Malformed output never hangs or crashes extraction | Clamp every `indexOf`, add a depth cap and a try/catch, fuzz in a child process with a hard timeout (Pattern 3) |
| SC-6 | The prompt carries only installed ∩ catalog, across every adapter | `installed-tools` chunk with a catalog-membership refine, `buildSystemPrompt()` shared by SDK and CLI. Phase 8 adapters must call it (Pattern 6) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack is locked: TypeScript on Node LTS, `pnpm`, `tsup`, `vitest`, `zod`, `cac`, `ink`, `@anthropic-ai/sdk`. **No new dependency is needed. Do not add shell-quote, sh-syntax or bash-parser (D-03).**
- Safety: commands go back to the shell buffer and are never auto-executed. The Tab install form is still insertion-only.
- Deep zsh integration through the ZLE widget. Stay inside the terminal flow.
- Do file edits through a GSD workflow (`/gsd:execute-phase`).
- OpenWolf: check `.wolf/anatomy.md` before reading files and `.wolf/cerebrum.md` (Do-Not-Repeat) before writing code. After edits, update `anatomy.md` and `memory.md`. Log bugs to `.wolf/buglog.json`. Commit `.wolf/` alongside code.
- Global user rule: presentational offsets belong in styling (Ink props such as `marginTop`), not computed in logic.
- Commit messages must respect commitlint. Subjects can't start with an acronym, and spike verdicts must be lowercase (cerebrum Do-Not-Repeat). No Co-Authored-By trailers (user memory).
- Lint changed files with biome before staging (user memory).
- Never stub dependencies in smoke or integration tests to make them pass (user memory, cerebrum 2026-06-08). The zsh tests must use real zsh and a real PATH dir.
- Inclusive terminology: write "allow list", not "whitelist" (the catalog is an allow list).
- Cerebrum learnings that apply here:
  - `pnpm test:run -- tests/x.test.ts` runs the WHOLE suite. Use `pnpm exec vitest run tests/x.test.ts`.
  - TDD RED tests that import new modules fail `tsc --noEmit` in pre-commit. Add throw-on-call stubs with the public exports first.
  - Daemon IPC handler throws must stay inside the promise chain.
  - Clamp `indexOf` −1 in hand lexers, and fuzz with a per-input timeout.
  - Do not import `src/cli/main.ts` in tests.
  - Do not pass `temperature`/`top_p`/`top_k`. Steer only through the system prompt.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fresh installed-command list (`rehash`, `$commands`, `$builtins`) | zsh widget (shell tier) | — | D-01: zsh is the source of truth. Only zsh sees the live hash table and in-session installs |
| Reading the handoff into `Set`s | Foreground client (`run-foreground.ts`) | — | Files live in the per-request tmpdir. The 20 KB set stays off IPC (CONTEXT integration note) |
| `catalog ∩ installed` computation | Foreground client | — | Needs the full set. Only the intersection crosses IPC, inside the envelope |
| Steering text and system prompt assembly | Daemon (provider adapters via `buildSystemPrompt`) | In-process fallback adapter | The daemon builds the prompt. The envelope is its only input |
| Command-word extraction and missing-tool flagging | Foreground client, after candidates arrive and before `rerender` | — | The full installed set lives only here. Costs about 3.5 µs per candidate |
| Installer and package-name choice, install form | Foreground client (`tool-awareness.ts`) | — | Uses the same `$commands` set and `process.platform` |
| Flag mark, footers, Tab toggle, controls hint | Ink UI (`CandidateSelect`, `ControlsLine`) | `modal-layout.ts` line estimate | Presentation only. Spacing goes in Ink props |
| Insertion into the shell buffer | zsh widget (`_qq_apply_result_str`) | — | Unchanged. The install form is just a longer `lbuffer` |

## Standard Stack

### Core (all already installed; nothing to add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zsh | 5.9 (local) | `rehash`, `$commands`, `$builtins` through `zsh/parameter` | D-01. Verified locally |
| Node | v24.14.1 (local) | runtime. Native TS type-stripping lets the fuzz child run the `.ts` lexer directly | Verified by a probe this session |
| ink | 7.0.1 (package.json) | `useInput` sets `key.tab` | `[VERIFIED: node_modules/ink/build/hooks/use-input.js:54]` `tab: keypress.name === 'tab',` |
| zod | 4.1.5 | new `installed-tools` chunk schema with a catalog refine | Existing contract layer |
| vitest | 4.0.4 | unit, fuzz-driver and zsh smoke tests | Existing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand lexer | shell-quote / sh-syntax / bash-parser | **Rejected by D-03.** shell-quote scored 37/40 and misses `"…$(date)…"`, `<(…)` and backticks. sh-syntax exposes only `{Pos,End}`. bash-parser is unmaintained |
| Child process for the fuzz timeout | `worker_threads` + `worker.terminate()` | Both can stop a sync infinite loop. `terminate()` killed `while(true){}` in a probe this session. `spawnSync` with `timeout` matches the spike's harness and is simpler. Use `spawnSync` |
| vitest per-test `timeout` | — | **Doesn't work for this.** A synchronous infinite loop blocks the worker's event loop, so the timer never fires `[ASSUMED]` |

**Installation:** none. `pnpm install` is unchanged.

## Package Legitimacy Audit

This phase installs **no external packages**. The gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 user types "find big files??"
          │
          ▼
 ┌──────────────────────── zsh widget (qq-question-widget) ────────────────────────┐
 │ mktemp -d /tmp/qq-sess.XXXXXX (chmod 700) → request.json                         │
 │ _qq_write_tool_handoff $tmpdir:  rehash → commands.txt, builtins.txt (~10 ms)    │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ qq client --request-file $tmpdir/request.json  (inline or zellij pane)
                 ▼
 ┌──────────────────────── foreground client (run-foreground.ts) ──────────────────┐
 │ parse request.json                                                               │
 │ readToolHandoff(dirname(requestFile)) ──missing/unreadable──▶ inventory = null   │
 │        │ (Sets: installed, builtins)                        (skip steer + flag,  │
 │        ▼                                                     debug-log only)     │
 │ gatherContext() → envelope                                                       │
 │ + extras.push({kind:'installed-tools', payload:{tools: CATALOG ∩ installed}})    │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ IPC fetch-candidates {envelope}  (only ~55 public names, never 2k)
                 ▼
 ┌──────────────────────── daemon / in-process fallback ───────────────────────────┐
 │ adapter → buildSystemPrompt(envelope) = QUEQUE_SYSTEM + steering(tools)         │
 │        → SDK `system:` | claude -p `--system-prompt` | (Phase 8 OpenAI/Ollama)  │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 │ candidates (model order, unchanged contract)
                 ▼
 ┌──────────────────────── foreground client ──────────────────────────────────────┐
 │ annotate: for each candidate → commandWords(lexHand(cmd), builtins)              │
 │           external ∉ installed → missingTools[]   (try/catch → [] on any throw)  │
 │ installer = pickInstaller(installed, platform)  (brew | apt | dnf | pacman | ∅)  │
 │ app.rerender(<CandidateSelect candidates=annotated installer=…/>)                │
 └───────────────┬──────────────────────────────────────────────────────────────────┘
                 ▼
 CandidateSelect: inline mark + footer (selected) ── Tab ──▶ row shows install form
                  ControlsLine: "tab install" / "tab undo install" (conditional)
                  Enter ──▶ onSelect(displayed command) ──▶ result → zsh LBUFFER (no exec)
```

### Recommended Project Structure
```
shell/zsh/queque.zsh             # + _qq_write_tool_handoff helper, called after request.json is written
src/shared/command-words.ts      # NEW: lexHand + commandWords (self-contained, zero imports, erasable TS only)
src/shared/tool-awareness.ts     # NEW: CATALOG, PACKAGE_ALIASES, missingTools, pickInstaller, buildInstallForm
src/client/tool-handoff.ts       # NEW: readToolHandoff(sessionDir) → ToolInventory | null
src/contracts/request.ts         # + 'installed-tools' chunk variant (catalog-refined)
src/contracts/ipc.ts             # + pong capability flag (e.g. installedTools: true)
src/daemon/server.ts             # pong advertises the new capability
src/daemon/bootstrap.ts          # replace daemons whose pong lacks the new capability
src/providers/steering.ts        # NEW: buildSteeringText(envelope), buildSystemPrompt(envelope)
src/providers/claude.ts          # system: buildSystemPrompt(envelope)
src/providers/claude-cli.ts      # --system-prompt buildSystemPrompt(envelope)
src/client/run-foreground.ts     # read handoff, push chunk, annotate before rerender
src/ui/CandidateSelect.tsx       # flag mark/footer, Tab toggle, install-form display
src/ui/ControlsLine.tsx          # conditional tab hint props
src/ui/modal-layout.ts           # line estimate counts the new footer(s) + install-form wrap
tests/fixtures/command-words-cases.ts        # 40 cases ported from spike cases.mjs
tests/fixtures/command-words-fuzz-child.mjs  # child process: imports ../../src/shared/command-words.ts
```

### Pattern 1: zsh handoff helper (D-01, SC-1/SC-2)
**What:** a top-level helper so `tests/zsh-widget.test.ts` can call it directly, the same way the suite already calls `_qq_capture_buffers` and `_qq_apply_result_str`.
**Where:** call it in `qq-question-widget` right after the `request.json` heredoc (`[VERIFIED: shell/zsh/queque.zsh:189-213]`). That block contains `tmpdir=$(mktemp -d /tmp/qq-sess.XXXXXX)`, `chmod 700 "$tmpdir"`, `req_file="$tmpdir/request.json"` and `"version": 1,`. Call it before the client launches in both the Zellij and inline branches.
```zsh
# Source: spike 001 (references/installed-command-handoff.md), probed this session under zsh -f
_qq_write_tool_handoff() {
  local dir="$1"
  zmodload zsh/parameter 2>/dev/null
  rehash                                            # drop stale table; picks up in-session installs
  print -rl -- ${(k)commands} > "$dir/commands.txt" # single expansion: no loops, no (o) sorting
  print -rl -- ${(k)builtins} > "$dir/builtins.txt"
}
```
Probe this session: a binary created after the table was primed showed `before rehash: 0`, then `after rehash: 1`. It worked under `zsh -f`, and `zsh/parameter` was loaded.

### Pattern 2: Lexer port (D-02, D-03, SC-4/SC-5)
**What:** a line-for-line TS port of `sources/002-candidate-binary-check/extract.mjs` (`lexHand`, `commandWords`, the `WRAPPERS` table, `RES_EXPECT`, `RES_LOOP`, `SHELLS`, `ASSIGN_RE`, `PLACEHOLDER_RE`, `REDIR_RE`). Leave out `fromShellQuote`, since shell-quote is rejected. Hardening to add to the port:
- every `indexOf` result is clamped (`< 0 → s.length`) before it becomes a cursor. The spike fixed the double-quote-backtick case, so audit **all** call sites: the single-quote branch in `scanBalanced` already returns `s.length`, and the word-level `'` and `` ` `` branches already clamp.
- a recursion depth cap on `commandWords` → `recurse` (e.g. depth > 32 → stop recursing). `'$('.repeat(2000)` finished in the spike, but deeper nesting could throw `RangeError`.
- a public wrapper `extractCommandWords(cmd, builtins)` that wraps everything in `try { … } catch { return [] }` and skips analysis for `cmd.length > 8192`. An internal failure then means "no flag", never a crash.
- **zero imports and erasable-only TS** (no `enum`, no `namespace`, no parameter properties). That lets `tests/fixtures/command-words-fuzz-child.mjs` do `import { … } from '../../src/shared/command-words.ts'` under Node 24's native type stripping. Verified this session: a `.mjs` child importing a `.ts` file with type annotations ran on Node v24.14.1 with exit 0. tsconfig has no `allowImportingTsExtensions`, so only the `.mjs` child may use a `.ts` specifier. `tsconfig.json` `include` covers only `.ts`/`.tsx`, so tsc never sees the `.mjs`.

Word kinds (from extract.mjs, verbatim): `'external'|'builtin'|'placeholder'|'dynamic'|'path'`. Only `external` words are checked against `installed`.

### Pattern 3: Fuzz with a hard per-input timeout (SC-5)
```ts
// tests/command-words-fuzz.test.ts — Source: spike 002 fuzz-child.mjs + find-hang.mjs
import { spawnSync } from 'node:child_process';
const child = new URL('./fixtures/command-words-fuzz-child.mjs', import.meta.url).pathname;
it('20k random inputs finish without hang or throw', () => {
  const r = spawnSync(process.execPath, [child, 'fuzz', '20000'], { timeout: 15_000, encoding: 'utf8' });
  expect(r.error).toBeUndefined();          // ETIMEDOUT here = a hang
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('fuzz ok');
});
it.each(CRAFTED_MALFORMED)('crafted %j finishes within 1 s', (s) => {
  const r = spawnSync(process.execPath, [child, 'one', s], { timeout: 1_000 });
  expect(r.error).toBeUndefined();
  expect(r.status).toBe(0);
});
// deep: child 'deep' 2000 → reports ms; assert < 100
```
Copy `CRAFTED_MALFORMED` verbatim from `find-hang.mjs`, including the minimal repro `"a" "\``. The fuzz alphabet is ``ab $()`'"|&;<>{}[]\#=\n\t-``. The child should print the current input to stderr before each case so a timeout is diagnosable, as the spike did.

### Pattern 4: Client-side annotation (SC-3, Discretion: where `missingTools` lives)
**Recommendation:** compute `missingTools` in the client and attach it to a **UI-local type**. Do **not** change `commandCandidateSchema`/`candidateListSchema`, because the daemon never sees the full installed set. Today the schema is:
```ts
// [VERIFIED: src/contracts/candidates.ts:3-6,10]
export const commandCandidateSchema = z.object({
  command: z.string().trim().min(1),
  explanation: z.string(),
});
export const candidateListSchema = z.array(commandCandidateSchema).min(1).max(5);
```
```ts
// src/shared/tool-awareness.ts (sketch)
export interface ToolInventory { installed: ReadonlySet<string>; builtins: ReadonlySet<string> }
export type DisplayCandidate = CommandCandidate & { missingTools?: readonly string[] };
export function missingTools(command: string, inv: ToolInventory): string[] {
  const seen = new Set<string>();
  for (const { word, kind } of extractCommandWords(command, inv.builtins)) {
    if (kind === 'external' && !inv.installed.has(word)) seen.add(word);
  }
  return [...seen];                       // dedupe: `docker ps | xargs docker stop` → once
}
```
Hook point: `[VERIFIED: src/client/run-foreground.ts:280-284]`
```ts
fetchCandidatesForUi(socketPath, envelope)
  .then((candidates) => {
    void appendDebugLog('client', 'candidates received', { count: candidates.length });
    app.rerender(buildCandidateElement(candidates));
```
Annotate between receipt and `rerender`. When `inventory === null`, pass the candidates through unflagged.

### Pattern 5: CandidateSelect Tab toggle and flag (D-08..D-14)
Current anchors:
- `[VERIFIED: src/ui/CandidateSelect.tsx:21,24]` `const DESTRUCTIVE_WARNING_MARK = '⚠';` and `` const DESTRUCTIVE_WARNING_TEXT = `${DESTRUCTIVE_WARNING_MARK} review carefully — this command may be destructive`; ``
- `[VERIFIED: src/ui/CandidateSelect.tsx:86-87]` state order: `const [selectedIndex, setSelectedIndex] = useState(0);` then `const [query, setQuery] = useState(initialQuery ?? '');`
- `[VERIFIED: src/ui/CandidateSelect.tsx:254-256]` inline mark: `{isLastCommandLine && destructive && ( <Text color="yellow">{` ${DESTRUCTIVE_WARNING_MARK}`}</Text> )}`

Rules:
- **Add the new `useState` (install-form toggles) AFTER the two existing ones.** `tests/candidate-select.test.tsx` mocks `useState` by call order and reads `stateValues[0]`/`stateSetters[1]` (lines 449, 576–630).
- Key the toggle state by candidate identity (`${command}::${explanation}`, the key the component already uses at line 236), **not** by visible index. The search filter re-indexes `visible`. Clear the toggles when `candidates` changes.
- Handle `key.tab` **before** `key.return` and before the generic `input` branch. Ink already passes `input === ''` for Tab, because `'tab'` is in `nonAlphanumericKeys` (`[VERIFIED: node_modules/ink/build/hooks/use-input.js:91-94]`). Even so, an explicit early `return` keeps Tab out of the filter on Kitty-protocol terminals. Shift+Tab (`\x1b[Z`) also reports `key.tab` with `key.shift`. Treat it the same (a toggle).
- Ink's App only cycles focus on Tab when focusable components exist (`[VERIFIED: node_modules/ink/build/components/App.js:290-291]` `if (!isFocusEnabled || focusablesCountRef.current === 0) return;`). CandidateSelect uses no `useFocus`, so Tab reaches our handler.
- Enter sends the **displayed** command (install form if toggled). Build the explanation fallback (`see man ${command.split(' ')[0]}`, line 170) from the **original** command, so it doesn't read `see man brew`.
- Evaluate `isDestructiveCommand` on the displayed text. Note that `DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS` includes `'\\bsudo\\b'` (`[VERIFIED: src/shared/qq-config.ts:21-28]`), so on Linux the apt/dnf/pacman install form also shows `⚠`. D-08 allows both marks. This is expected, not a bug.
- Footer copy (D-08/D-11/D-14): `not installed: fd, xh` · `not installed: fd — no package manager found` · `will install: fd, xh`.
- Glyph (Discretion): recommend `⊘` in `cyan`. It differs from the yellow `⚠` and from the `ansi256(166)` active gutter `[ASSUMED: renders single-width in common macOS terminal fonts]`.
- `ControlsLine` takes an optional prop such as `tabHint?: 'install' | 'undo install'` and renders ` tab ` / ` install ` chips in the existing style (`[VERIFIED: src/ui/ControlsLine.tsx:8-27]`, `backgroundColor="ansi256(238)"` / `"ansi256(245)"`). `candidate-select.test.tsx` mocks `ControlsLine` (line ~45), so add a small separate test for the hint.

### Pattern 6: Provider-neutral steering (D-15..D-18, SC-6)
Current anchors:
- `[VERIFIED: src/providers/claude.ts:39-40]` `export const QUEQUE_SYSTEM = 'You are QueQue, a terminal shell assistant. Return ONLY a JSON array …';`
- `[VERIFIED: src/providers/claude.ts:174]` `system: QUEQUE_SYSTEM,`
- `[VERIFIED: src/providers/claude-cli.ts:31-33]` `'--system-prompt', QUEQUE_SYSTEM, prompt,`

Create `src/providers/steering.ts`:
```ts
export function buildSystemPrompt(envelope: ContextEnvelope): string {
  const steering = buildSteeringText(filterContextEnvelope(envelope));
  return steering ? `${QUEQUE_SYSTEM}\n\n${steering}` : QUEQUE_SYSTEM;
}
// Draft wording (Discretion; D-15/16/17):
// Notable command-line tools installed on this machine (standard system utilities are also present): rg fzf bat jq …
// Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.
// At least one candidate must use only installed tools or standard system utilities.
// Never include install steps (no brew/apt/dnf/pacman install, no curl | sh) in any candidate.
```
- When the chunk is absent (old widget, missing files, kill switch), return `QUEQUE_SYSTEM` byte-for-byte. Existing behaviour and tests stay unchanged.
- Keep `QUEQUE_SYSTEM` exported. Phase 8's 08-03 (Ollama) and 08-04 (OpenAI) aren't in `src/providers/` yet (the directory has only `claude*.ts`, `detect.ts`, `index.ts`, `provider.ts`, `resolver.ts`). D-18 makes the second phase to ship do the wiring. Add a guard test: no file in `src/providers/` other than `steering.ts`/`claude.ts` passes `QUEQUE_SYSTEM` straight to a model call. Also add a line to `docs/EXTENSIONS.md` saying adapters must call `buildSystemPrompt(envelope)`.
- The CLI path puts the system prompt on argv, so it's visible in `ps`. That's the accepted risk T-08-02-07. The added text is only public catalog names, so the disclosure doesn't grow meaningfully.

### Pattern 7: Envelope chunk with structural privacy (D-04)
Existing union: `[VERIFIED: src/contracts/request.ts:74-94]` `contextChunkSchema = z.discriminatedUnion('kind', [ … z.literal('git') … z.literal('filesystem') … ])`. Add:
```ts
z.object({
  kind: z.literal('installed-tools'),
  payload: z.object({
    /** Public catalog names only — refine rejects anything outside CATALOG (D-04 structural guard). */
    tools: z.array(z.string()).max(CATALOG.length).refine((ts) => ts.every((t) => CATALOG_SET.has(t))),
  }),
}),
```
This keeps the same privacy philosophy as the D-05/D-06 comment on the union. A bug that pushed the full `$commands` list would fail schema validation instead of reaching the model. Sort the intersection in Node (sorting in zsh costs 167 ms).

### Pattern 8: Handoff discovery (Discretion: contract field vs fixed name)
**Recommendation: fixed sibling names, no `version` bump.** The client derives `commands.txt`/`builtins.txt` from `path.dirname(requestFile)`.
- The schema is `[VERIFIED: src/contracts/shell.ts:8-15]` `version: z.literal(1), ttyPath: z.string(), cwd: …, shellPid: …, lbuffer: z.string(), rbuffer: z.string()`. Bumping to `z.literal(2)` would make a **new client reject requests from an old widget** that's still loaded in a long-running shell after `brew upgrade`, and the reverse for dev setups.
- Fixed names confine reads to the chmod-700 session dir. A JSON path field would let the request file point the client at any file.
- Missing or unreadable files mean `inventory = null`: skip steering and flagging, `appendDebugLog('client','tool handoff unavailable',{reason})`, never error.
- Kill switch (Discretion): an env-only `QQ_TOOL_AWARENESS=0`, read in the client, gives `inventory = null`. It's cheap, and it's an escape hatch if flags turn out wrong (see Open Question 1). No config-file key.

### Pattern 9: Installer and install form (D-09..D-12)
```ts
const INSTALLERS = {
  brew:   (pkgs) => `brew install ${pkgs.join(' ')}`,
  apt:    (pkgs) => `sudo apt install ${pkgs.join(' ')}`,
  dnf:    (pkgs) => `sudo dnf install ${pkgs.join(' ')}`,
  pacman: (pkgs) => `sudo pacman -S ${pkgs.join(' ')}`,
};
// darwin → brew if installed.has('brew'); linux → first of apt, dnf, pacman in installed; else null.
```
- **No `-y`/`--noconfirm`** (D-11 discretion). The user runs the command themselves, and the manager's own confirmation keeps them in control `[ASSUMED: user preference; confirm]`.
- **Package-name safety:** only missing words matching `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/` become installable. If any missing word fails the regex, the row is still flagged, but the footer says so and Tab is unavailable. Model words can contain spaces or metacharacters through quoting.
- **List wrapping:** if the original command has a top-level `;`, `||`, `&` or newline op (the lexer exposes `op` tokens), emit `<installer> … && { <cmd>; }`. Otherwise `a || b` / `a; b` would run `b` even when the install fails. Pipelines `a | b` need no wrap, because `&&` binds looser than `|` `[ASSUMED: POSIX/zsh precedence; low risk]`.
- Alias map seed (D-12). Brew formulae verified to exist this session with `brew info --formula --json=v2`: ripgrep, imagemagick, neovim, httpie, fd, git-delta, bottom, difftastic, gnu-time, coreutils, ffmpeg, visidata, csvkit, miller, the_silver_searcher, kubernetes-cli, bind, ripgrep-all, tealdeer, awscli. The binary→formula links confirmed through `brew list`: `rg`→ripgrep, `delta`→git-delta, `nvim`→neovim, `magick`→imagemagick, `ag`→the_silver_searcher, `gtimeout`→coreutils, `ffprobe`→ffmpeg. The rest (`btm`→bottom, `difft`→difftastic, `http`/`https`→httpie, `vd`→visidata, `mlr`→miller, `csvlook`→csvkit, `gtime`→gnu-time, `kubectl`→kubernetes-cli, `dig`→bind, `rga`→ripgrep-all, `tldr`→tealdeer, `aws`→awscli, `convert`→imagemagick, `fdfind`→fd-find, `batcat`→bat) are `[ASSUMED]`.

### Pattern 10: Stale-daemon capability bump
- `[VERIFIED: src/daemon/server.ts:61-65]` invalid requests are dropped silently: `if (!result.success) { void appendDebugLog('daemon', 'ignored unknown request', …); continue; }`
- `[VERIFIED: src/daemon/fetch-client.ts:9]` `export const FETCH_ACK_MS = 800;`. Lines 139–143 fall back to an in-process (cold) adapter on `IpcTransportError`.
- `[VERIFIED: src/contracts/ipc.ts:34-37]` the pong is `kind: z.literal('pong'), fetchCandidates: z.literal(true).optional(),`
- `[VERIFIED: src/daemon/bootstrap.ts:211-216]` the current daemon is kept when `cap !== 'no'`.

Add `installedTools: z.literal(true).optional()` to the pong and send it from `server.ts`. Extend `pingDaemonFetchCap` so that a pong lacking the new flag returns `'no'` and gets replaced. Keep `'unknown'` (no reply) kept, so dumb test sockets survive (cerebrum).

### Anti-Patterns to Avoid
- Looping (`for k v in ${(kv)commands}`, 136 ms) or sorting (`${(ko)commands}`, 167 ms) in zsh. Add a static test asserting the widget source has neither.
- A Node PATH scan, `fs.watch`, or a daemon-side index (D-01).
- Sending the full `$commands` list or `missingTools` over IPC or to the model (D-04).
- Hardcoding builtins (D-02). Use `builtins.txt`.
- Re-sorting flagged candidates (D-13).
- Dropping flagged candidates (SC-3).
- Building "installs X" labels or use-before-install detection (D-06/D-07).
- Logging the installed list. Log counts only: `{ installed: n, builtins: n, steered: n }`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Knowing what's installed | PATH walk in Node, `which` per word | zsh `$commands` after `rehash` | D-01. zsh sees hashing rules, in-session installs and `hash` entries exactly as the shell will |
| Builtin list | hardcoded array | `${(k)builtins}` handoff | Varies with loaded modules (104 here, 103 in the spike) |
| Shell parsing | a new lexer from scratch | **port** spike 002 `extract.mjs` (40/40 cases, fuzzed) | It already handles `$()` in double quotes, `<()`, backticks, wrappers, `find -exec`, `sh -c`, placeholders. Rewriting reintroduces the −1 cursor hang |
| Fuzz timeout | in-process timer | `spawnSync(..., { timeout })` child | A sync infinite loop can't be interrupted in-process |

**Key insight:** each piece is already validated in a spike. The risk is in the seams (IPC compat, test state indexing, layout estimates, shell precedence), not in the algorithms.

## Common Pitfalls

### Pitfall 1: SC-2 timing is over budget on this machine today
**What goes wrong:** the handoff measured `rehash` 0.1–0.5 ms, refill **9.8–19.8 ms**, write 2.1–3.1 ms. Five repeated runs totalled **9.6–10.4 ms**. With interactive `zsh -i` it was 10.1 ms. The spike measured ~7 ms.
**How to avoid:**
- Make the automated test a **regression guard**: median of 5 runs < 25 ms. That catches loops and sorting, which cost 136–167 ms. Print the measured median so the verifier can compare it to the ~10 ms target by hand.
- If the user wants SC-2 met strictly, there are two measured fallbacks, and both need a decision because they modify D-01:
  - (a) an mtime fingerprint (`zstat` over `$path`: **1.4 ms** for 26 dirs). `rehash` runs only when the fingerprint changes, and the no-rehash write measured 2–5 ms. There's a 1 s mtime staleness window.
  - (b) run the handoff in a background subshell `( … ) &!` that writes `*.tmp` then `mv`. Node startup hides the ~10 ms. If the files are absent when the client reads them, it falls back to no steering.
**Warning signs:** a perceptible `??` delay, or the timing test median creeping toward the threshold.

### Pitfall 2: Old daemon rejects the new chunk
See Pattern 10. Without the capability bump, the symptom is +800 ms and a cold fetch on every `??` after an upgrade, with only `ignored unknown request` in the debug log.

### Pitfall 3: useState call order in tests
`tests/candidate-select.test.tsx` maps `useState` calls by index. Put the new state after `query`, or existing tests read the wrong values.

### Pitfall 4: Layout estimate and viewport reserve drift
`estimateCandidateSelectLines` must add 2 lines (marginTop + text) for the flag footer, alongside the existing destructive footer (`[VERIFIED: src/ui/modal-layout.ts:117-123]`, `lines += 1; // marginTop` / `lines += 1; // warning text`). It must also wrap the **displayed** (install-form) command, and it needs the toggle state and flags as new inputs. Also `[VERIFIED: src/client/run-foreground.ts:196]` `const MODAL_VIEWPORT_LINES = 16;` assumes 3 candidates and no footers. Destructive plus flag footers add 4 lines. Raise the reserve to cover both, e.g. 20, or the inline (non-Zellij) render scrolls.

### Pitfall 5: Function and alias tools flagged falsely
`nvm` is a function here (probe: `commands=0, functions=1`). Others are often functions too: `conda`, `sdk`, older `asdf`, zoxide's `z`. They'll be flagged "not installed", and they're never steered as installed. See Open Question 1.

### Pitfall 6: `buildShellBuffers` and the install form
`[VERIFIED: src/client/run-foreground.ts:31-33]` `const stripped = command.replace(/<([^>]+)>/g, '$1'); const firstAngle = command.indexOf('<');`. The install form only adds a literal prefix, so the cursor still lands on the first placeholder. Add one test: `brew install fd && fd <pattern>` → `lbuffer` ends with `fd `.

### Pitfall 7: Zellij path reads the files late
In Zellij the client starts in another pane. The widget only cleans up after the FIFO read, so the files exist. Still, read the handoff **eagerly** at client start (alongside `request.json`), not when candidates arrive.

### Pitfall 8: Steering text in the wrong prompt
D-15 puts the list in the **system** prompt. Don't add it to `buildPrompt`'s user JSON. The `claude-provider` tests assert on `messages[0].content`, so keep the user prompt byte-stable when there's no chunk.

## Code Examples

### Client handoff reader
```ts
// src/client/tool-handoff.ts — Source: spike 001 step 3
export async function readToolHandoff(sessionDir: string): Promise<ToolInventory | null> {
  if (process.env.QQ_TOOL_AWARENESS === '0') return null;
  try {
    const [c, b] = await Promise.all([
      fsp.readFile(path.join(sessionDir, 'commands.txt'), 'utf8'),
      fsp.readFile(path.join(sessionDir, 'builtins.txt'), 'utf8'),
    ]);
    const split = (s: string) => new Set(s.split('\n').filter(Boolean));
    const installed = split(c);
    return installed.size > 0 ? { installed, builtins: split(b) } : null;
  } catch (error) {
    void appendDebugLog('client', 'tool handoff unavailable', { message: String(error) });
    return null;
  }
}
```
`tests/client-result.test.ts` passes `fs/promises.readFile` through to the real implementation (`...original`). Its temp request dirs have no `commands.txt`, so the existing tests exercise the null fallback automatically. Keep it that way: don't stub the handoff there.

### zsh freshness test (SC-1, real zsh, no stubs)
```ts
const { stdout } = runZsh(`
  d=$(mktemp -d); mkdir -p $d/bin; path=($d/bin $path)
  : \${#commands}                       # prime the hash table
  print '#!/bin/sh' > $d/bin/qqfreshtool; chmod +x $d/bin/qqfreshtool
  _qq_write_tool_handoff $d
  grep -cx qqfreshtool $d/commands.txt; grep -cx cd $d/builtins.txt; rm -rf $d`);
expect(stdout.trim().split('\n')).toEqual(['1', '1']);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `QUEQUE_SYSTEM` string | `buildSystemPrompt(envelope)` = base + optional steering | Phase 9 | Every adapter must call it (D-18) |
| Candidates rendered as returned | Client annotates `missingTools` before render | Phase 9 | No contract change. UI-local type |
| Node 24: running `.ts` needs a loader | Native type stripping runs erasable-syntax `.ts` | Node 23.6+ (unflagged) `[ASSUMED: version]`; verified working on v24.14.1 | The fuzz child can import the real source |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vitest's per-test timeout can't interrupt a synchronous infinite loop | Alternatives | Low. The child-process approach is used either way |
| A2 | `⊘` renders single-width in common terminal fonts | Pattern 5 | Cosmetic misalignment. Swap the glyph |
| A3 | No `-y`/`--noconfirm` for apt/dnf/pacman is what the user wants | Pattern 9 | Extra confirmation prompt. Trivial to change |
| A4 | Binary→formula mappings not confirmed with `brew list` (btm, difft, http, vd, mlr, csvlook, gtime, kubectl, dig, rga, tldr, aws, convert, fdfind, batcat) | Pattern 9 | Wrong package in the install form. Fails visibly when run (accepted by D-12) |
| A5 | `&&` binds looser than `\|`, so pipelines need no brace wrap | Pattern 9 | Install form runs the wrong scope |
| A6 | Debian/Ubuntu names differ (e.g. `fd`→`fd-find`, `bat` binary is `batcat`). A single platform-agnostic map gives brew names on apt | Pattern 9 | Wrong apt package for a few tools. Accepted by D-12 ("fails visibly") |
| A7 | Native TS stripping has been unflagged since Node 23.6 | State of the Art | None for this repo. Verified on the installed v24.14.1 |

## Open Questions

1. **Treat zsh functions and aliases as installed for flagging and steering?**
   - What we know: `nvm` is a function here. `print -rl -- ${(k)functions:#_*} ${(k)aliases}` costs **~1.6 ms**, 494 names. The `:#_*` filter drops completion and private `_qq_*` functions. These names would stay client-side, and only catalog members would ever reach the model.
   - What's unclear: D-01 locks "commands and builtins" only.
   - Recommendation: ask the user. If yes, write a third file `functions.txt` and treat its names as installed, never installable. If no, accept the false flags as documented behaviour.
2. **SC-2 strictness.** Accept ~10–12 ms with a < 25 ms regression guard, or adopt fallback (a) or (b) from Pitfall 1? Recommendation: ship D-01 as is, record the measured median in VERIFICATION, and revisit only if the user perceives lag.
3. **Spike 003 is partial** (deferred). The steering wording is a draft. The flag is the safety net whatever the steering quality.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| zsh | handoff, zsh tests | ✓ | 5.9 | — |
| node | runtime, fuzz child (type stripping) | ✓ | v24.14.1 | — |
| pnpm | scripts | ✓ | 12.6.0 | — |
| jq | widget (existing) | ✓ | /usr/local/bin/jq | — |
| brew | darwin installer (runtime only) | ✓ | Homebrew 7.0.7 | none needed in tests (inject sets) |
| apt / dnf / pacman | Linux installer branch | ✗ (macOS host) | — | unit-test with injected `installed` sets and `platform: 'linux'` |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 (`environment: 'node'`, includes `tests/**/*.test.ts(x)`) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm exec vitest run tests/<file>.test.ts` (never `pnpm test:run -- …`, which runs the whole suite) |
| Full suite command | `pnpm test:run && pnpm typecheck && pnpm lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Binary created after hashing appears in `commands.txt`. `builtins.txt` contains `cd` | zsh smoke (real zsh) | `pnpm exec vitest run tests/zsh-widget.test.ts -t "tool handoff"` | ✅ file, ❌ cases |
| SC-1 | Widget calls `_qq_write_tool_handoff "$tmpdir"` before both client launches. No `(kv)` loop or `(ko)` sort | static source | same file | ✅ / ❌ cases |
| SC-2 | Median of 5 handoff runs < 25 ms. Median printed | zsh timing | same file `-t "handoff timing"` | ❌ |
| SC-3 | `missingTools` dedupes and names the tools. Flagged rows keep their order and stay selectable. Enter inserts the displayed text | unit + component | `pnpm exec vitest run tests/tool-awareness.test.ts tests/candidate-select.test.tsx` | ❌ / ✅ |
| SC-3 | Tab toggles the install form. Tab is a no-op on unflagged rows and never reaches the filter. No installer → Tab unavailable plus the D-11 footer. Copy per D-14 | component | `pnpm exec vitest run tests/candidate-select.test.tsx -t "install"` | ✅ / ❌ cases |
| SC-3 | ControlsLine shows `tab install` / `tab undo install` only when given | component | `pnpm exec vitest run tests/controls-line.test.tsx` | ❌ |
| SC-3 | Layout estimate counts the flag footer and install-form wrap | unit | `pnpm exec vitest run tests/modal-layout.test.ts` | ✅ / ❌ cases |
| SC-4 | 40 spike cases pass. Builtin/resword/placeholder/`$VAR`/path never `external` | unit table | `pnpm exec vitest run tests/command-words.test.ts` | ❌ |
| SC-5 | 20k fuzz in a child (15 s cap), crafted malformed inputs at 1 s each, `'$('×2000` < 100 ms, wrapper never throws | child-process fuzz | `pnpm exec vitest run tests/command-words-fuzz.test.ts` | ❌ |
| SC-6 | System prompt (SDK `system`, CLI `--system-prompt` arg) contains the steering text and only catalog names. Unchanged when the chunk is absent. Chunk schema rejects non-catalog names | unit | `pnpm exec vitest run tests/steering.test.ts tests/claude-provider.test.ts tests/claude-cli-provider.test.ts` | ❌ / ✅ / ✅ |
| SC-6 | No adapter in `src/providers/` uses `QUEQUE_SYSTEM` directly except through `buildSystemPrompt` | static guard | `pnpm exec vitest run tests/steering.test.ts -t "adapters"` | ❌ |
| Compat | Pong lacking `installedTools` is replaced. No reply is kept | unit | `pnpm exec vitest run tests/daemon-bootstrap.test.ts` | ✅ / ❌ cases |
| Fallback | Missing handoff files → no chunk, no flags, no error | unit | `pnpm exec vitest run tests/tool-handoff.test.ts tests/client-result.test.ts` | ❌ / ✅ |

### Sampling Rate
- **Per task commit:** the quick-run command for the touched test files, plus `pnpm typecheck`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** `pnpm test:run && pnpm typecheck && pnpm lint` green before `/gsd-verify-work`. Also one manual `??` after `brew install <tool>` in the same shell (SC-1 end-to-end) and a recorded handoff median (SC-2)

### Wave 0 Gaps
- [ ] `src/shared/command-words.ts`, `src/shared/tool-awareness.ts`, `src/client/tool-handoff.ts`, `src/providers/steering.ts`: throw-on-call stubs with public exports, so RED tests pass `tsc --noEmit` (cerebrum)
- [ ] `tests/fixtures/command-words-cases.ts`: port the 40 cases from `sources/002-candidate-binary-check/cases.mjs`
- [ ] `tests/fixtures/command-words-fuzz-child.mjs`: modes `fuzz N`, `one <s>`, `deep N`
- [ ] `tests/command-words.test.ts`, `tests/command-words-fuzz.test.ts`, `tests/tool-awareness.test.ts`, `tests/tool-handoff.test.ts`, `tests/steering.test.ts`, `tests/controls-line.test.tsx`
- No framework install is needed.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes (local files) | Handoff confined to the chmod-700 `mktemp -d` session dir through fixed sibling names. No path taken from JSON |
| V5 Input Validation | yes | Model output is untrusted: total, non-throwing lexer with a depth and length cap. zod `installed-tools` chunk with a catalog refine. Package-name regex before building the install form |
| V6 Cryptography | no | — |
| V8 Data Protection / privacy | yes | Only public catalog names leave the client (D-04). The full list stays off IPC, logs and the model. Debug logs carry counts only |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted or truncated model output hangs the picker | DoS | Clamped cursors, depth cap, try/catch wrapper, child-process fuzz (SC-5) |
| Quoted command word injects args into the install form (`"x -rf ~"`) | Tampering | `/^[A-Za-z0-9][A-Za-z0-9._+-]*$/` gate. Insertion-only, so the user reviews before running |
| Full `$commands` list leaks unusual or internal binary names to the provider | Info disclosure | Catalog intersection plus schema refine. `ps` exposure on the CLI path is limited to public names |
| Symlink or tmp race on handoff files | Tampering | Existing `mktemp -d` + `chmod 700` (CR-006). The files are written inside it |
| Install form chained by `;`/`\|\|` runs the user's command after a failed install | Tampering/Safety | `{ …; }` wrap when top-level list ops exist |

## Sources

### Primary (HIGH confidence)
- In-repo files read this session: `shell/zsh/queque.zsh`, `src/contracts/{shell,request,candidates,ipc}.ts`, `src/providers/{claude,claude-cli,claude-default,resolver,provider,index}.ts`, `src/client/run-foreground.ts`, `src/ui/{CandidateSelect,ControlsLine}.tsx`, `src/ui/modal-layout.ts`, `src/context/{pipeline,provider,base-context}.ts`, `src/shared/privacy-filter.ts`, `src/shared/qq-config.ts` (patterns), `src/daemon/{server,fetch-client,bootstrap}.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `lefthook.yml`, `tests/candidate-select.test.tsx` (mocks), `tests/client-result.test.ts` (fs mocks), `tests/zsh-widget.test.ts` (harness)
- `node_modules/ink/build/hooks/use-input.js`, `parse-keypress.js`, `components/App.js` (installed ink 7.0.1)
- Spike blueprint: `.claude/skills/spike-findings-tui-llm/` (SKILL.md, 3 references, sources 001–003)
- Local probes this session: zsh freshness/timing, functions/aliases cost, Node `.ts` import from `.mjs`, Worker terminate, brew formula existence and binary mapping

### Secondary (MEDIUM confidence)
- Context7 `/vadimdemedes/ink`: `useInput` key fields, Tab/Shift+Tab focus example
- zsh manual, zsh/parameter module (https://zsh.sourceforge.io/Doc/Release/Zsh-Modules.html): `commands`, `builtins`, `functions`, `aliases`, `reswords` semantics

### Tertiary (LOW confidence)
- Spike 003 steering numbers (partial run, n=6)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependencies. Versions read from package.json and the local toolchain.
- Architecture: HIGH. Every integration point was read in source and cited.
- Pitfalls: HIGH for IPC compat, state indexing and layout (read in code). MEDIUM for timing (machine-dependent).
- Steering wording: MEDIUM. Spike 003 is partial.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable in-repo domain; re-check if Phase 8 adapters land first)
