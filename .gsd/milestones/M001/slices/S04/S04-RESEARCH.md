# Phase 03.1: Monocle-style Interface and Interactivity — Research

**Researched:** 2026-05-13
**Domain:** Ink 7 TUI component design — keyboard input, dynamic re-render, ANSI 256 colors, loading state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** If `request.lbuffer` is non-empty when the modal opens, candidates are pre-filtered by that text on first render. Selected index resets to 0 after the pre-filter is applied.
- **D-02:** If `request.lbuffer` is empty, all LLM-returned candidates are shown without filtering. The search box shows the placeholder copy (`type to filter…`).
- **D-03:** The existing fast-accept bypass (1 candidate → direct buffer write, no modal) is **removed**. The modal always shows regardless of how many candidates the provider returns.
- **D-04:** The best candidate is first in the list (index 0, preselected on load). Sort order is owned by the provider — `CandidateSelect` renders candidates as received, no UI-side re-ranking.
- **D-05:** The modal opens **immediately** with a spinner (before `fetchCandidates` returns). The raw ANSI `"QueQue is thinking..."` pre-modal text in `run-foreground.ts` is removed.
- **D-06:** `CandidateSelect` receives `candidates: CandidateList | null`. When `null`, renders the spinner zone. When `CandidateList`, renders candidate rows. Error state per UI-SPEC copywriting contract.
- **D-07:** `run-foreground.ts` passes `candidates={null}` on first render, then pushes the resolved `CandidateList` into the already-rendered Ink modal via a nullable prop update (`rerender()` — Claude's discretion on exact mechanism).

### Claude's Discretion

- React state/ref pattern for propagating the candidate update into the already-rendered Ink modal
- `SearchInput`, `ControlsLine`, `LoadingSpinner` component internals (UI-SPEC defines the external contract)
- `MODAL_CHROME_LINES` constant update in `renderModal` to account for search zone, gaps, and controls zone
- Filter algorithm internals (case-insensitive substring per UI-SPEC §Live Search)
- Selected index reset behavior when filter produces 0 matches

### Deferred Ideas (OUT OF SCOPE)

- `Ctrl+F` toggle (floating/tiled mode) — UI-SPEC explicitly defers to future phase
- `Ctrl+R` toggle (filter type) — UI-SPEC explicitly defers to future phase
- Full fuzzy matching (vs. substring) — Phase 4 scope per REQUIREMENTS TUI-01

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TUI-01 | Trigger opens a fuzzy-finder-style TUI with initial keyboard focus in the input area | `useInput` captures all keystrokes immediately; no focus management component needed |
| CMD-03 | User can navigate command candidates with keyboard-only controls and confirm a selection | Existing `useInput` navigation preserved; `key.return` / `key.escape` handled |
| SAFE-01 | Errors and provider failures surface cleanly without mutating the shell buffer | Error state renders inside Ink modal; `Esc` triggers `writeShellResult({kind:'cancel'})` |

</phase_requirements>

---

## Summary

This phase is a pure TUI refactor — no new npm packages, no new backend logic. All work happens in `src/ui/` and `src/client/run-foreground.ts`. The visual contract is fully specified in `03.1-UI-SPEC.md`; this research focuses on the Ink 7 API mechanics needed to implement it correctly.

Three Ink 7 capabilities are central to the implementation:

1. **`rerender()`** — Ink's `render()` returns a `{ rerender, unmount }` instance. Calling `rerender(<Component newProp={value} />)` pushes updated props into the already-rendered component tree. This is the correct mechanism for D-07 (render modal with `candidates={null}`, then `rerender` with resolved `CandidateList`). No React ref or external state is needed.

2. **`useInput` printable character capture** — The `input` parameter in `useInput((input, key) => {...})` receives every printable character typed. Guard `if (input && !key.ctrl && !key.meta)` to append to a query string. `key.backspace` handles deletion. This drives the live search feature (D-01/D-02).

3. **ANSI 256 color via `ansi256(N)` string format** — Ink 7's `colorize.js` parses the string `"ansi256(166)"` and calls `chalk.ansi256(166)()`. Pass this string directly to `color` or `backgroundColor` props. No import of chalk is needed in component code.

**Primary recommendation:** Use `rerender()` for the loading-to-candidates transition (D-07). Keep all keyboard state inside a single `useInput` handler in `CandidateSelect`. Implement `LoadingSpinner` with `useState` + `useEffect` interval — no external spinner package.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loading indicator / spinner | Frontend (Ink component) | — | Pure render concern; `LoadingSpinner` replaces ANSI stdout write |
| Live search filter | Frontend (Ink component) | — | Client-side filter over `CandidateList`; no re-query to provider |
| Candidate display | Frontend (Ink component) | — | `CandidateSelect` renders what it receives; no sorting |
| Modal-first async render | Foreground client (`run-foreground.ts`) | Frontend (Ink) | `renderModal` launches Ink; `rerender()` pushes resolved data in |
| Provider call | Foreground client | Provider (`claude.ts`) | Unchanged; `fetchCandidates` called after modal opens |
| Shell result write | Foreground client | — | `writeShellResult` called from `onSelect`/`onCancel` callbacks |

---

## Standard Stack

### Core (all existing — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ink` | 7.0.1 | TUI rendering, component model, input | Already installed; locked in CLAUDE.md |
| `react` | 19.2.0 | Component state, hooks, JSX | Ink's renderer; already installed |
| Node `setInterval` | native | Spinner animation timer | UI-SPEC mandates no third-party spinner |

[VERIFIED: package.json in project root]

### No New Packages

The UI-SPEC npm safety gate is explicit: no new packages for this phase. The implementation uses only `ink`, `react`, and native Node timers. [VERIFIED: 03.1-UI-SPEC.md §Npm Package Safety]

---

## Architecture Patterns

### System Architecture Diagram

```
  zsh widget trigger
        |
  run-foreground.ts (llm path)
        |
        |-- renderModal(stdin, stdout, 0, buildElement) ----> Ink render()
        |   [candidates=null, initialQuery=lbuffer]             returns { rerender, unmount }
        |
        |-- gatherContext() + ensureDaemon() in parallel
        |
        |-- fetchCandidates(envelope) -----> Claude API
        |              |
        |    resolved CandidateList
        |              |
        |-- rerender(<CandidateSelect candidates={list} .../>)
        |
  user interaction (useInput inside CandidateSelect)
        |
   Enter: writeShellResult({kind:'replace-buffer'}) --> unmount()
   Esc:   writeShellResult({kind:'cancel'})          --> unmount()
```

### Recommended Project Structure

```
src/ui/
├── Modal.tsx          # Modified: width 62→80, passes search slot to children
├── CandidateSelect.tsx # Modified: candidates nullable, search state, monocle palette
├── SearchInput.tsx    # New: SEARCH: {query} row
├── ControlsLine.tsx   # New: key badge + action text
└── LoadingSpinner.tsx # New: dot-cycle spinner
```

### Pattern 1: `rerender()` for Loading → Candidates Transition (D-07)

**What:** Ink's `render()` returns a `rerender` function. Call it after `fetchCandidates` resolves to push updated props into the live component tree. The component's `useState` and render cycle handle the rest normally.

**When to use:** Any time the modal must display before data is available. This is the canonical Ink pattern for async data arrival into an already-displayed component.

```typescript
// Source: https://github.com/vadimdemedes/ink/blob/master/readme.md [VERIFIED: Context7 /vadimdemedes/ink]
async function renderModal(
  stdin: tty.ReadStream,
  stdout: tty.WriteStream,
  buildElement: (unmount: () => void) => React.ReactElement,
): Promise<void> {
  // ... scroll viewport to create blank zone ...

  await new Promise<void>((resolve) => {
    let app: ReturnType<typeof render>;

    const unmount = () => {
      app.unmount();
      resolve();
    };

    // First render: candidates=null → spinner shown
    app = render(buildElement(unmount), { stdin, stdout });
  });
}

// Caller in run-foreground.ts (llm path):
let rerenderModal: ((el: React.ReactElement) => void) | undefined;

await new Promise<void>((resolve) => {
  let app: ReturnType<typeof render>;
  const unmount = () => { app.unmount(); resolve(); };

  app = render(
    React.createElement(CandidateSelect, {
      candidates: null,
      initialQuery: request.lbuffer,
      onSelect: async (cmd) => { await writeShellResult(...); unmount(); },
      onCancel: async () => { await writeShellResult(...); unmount(); },
    }),
    { stdin, stdout }
  );
  rerenderModal = (el) => app.rerender(el);
});

// After fetchCandidates resolves (before await above completes):
rerenderModal?.(React.createElement(CandidateSelect, {
  candidates: resolvedList,
  initialQuery: request.lbuffer,
  onSelect: ...,
  onCancel: ...,
}));
```

**Implementation note for D-07:** The `rerender` call and the `fetchCandidates` await must be structured so they run concurrently with the rendered modal. The correct pattern is to start the modal render as a non-awaited Promise, capture `rerender`, resolve data, call `rerender`, then `await` the modal Promise. Alternatively, use a wrapper component with `useState` that accepts a setter via a ref — both are valid. `rerender()` is simpler and does not require any ref leakage.

### Pattern 2: Printable Character Capture in `useInput`

**What:** The `input` argument in `useInput((input, key) => {...})` carries the character string for every printable keystroke. Guard with `!key.ctrl && !key.meta` to exclude control sequences.

**When to use:** Live search query accumulation (D-01/D-02) — append to query state on any printable character.

```typescript
// Source: https://github.com/vadimdemedes/ink/blob/master/readme.md [VERIFIED: Context7 /vadimdemedes/ink]
useInput((input, key) => {
  if (key.escape) { onCancel(); return; }
  if (key.upArrow) { /* move selection */ return; }
  if (key.downArrow) { /* move selection */ return; }
  if (key.return) { /* accept */ return; }
  if (key.backspace) {
    setQuery(q => q.slice(0, -1));
    return;
  }
  // Printable character: append to query
  if (input && !key.ctrl && !key.meta) {
    setQuery(q => q + input);
  }
});
```

**Key fact:** Arrow keys, Enter, Escape, and Backspace all set their respective `key.*` flags to `true`. They do NOT appear as printable `input`. The guard `!key.ctrl && !key.meta` is sufficient — no need to also exclude arrow keys by string matching.

### Pattern 3: ANSI 256 Colors via `"ansi256(N)"` String

**What:** Ink 7's `colorize.js` parses the string `"ansi256(N)"` and calls `chalk.ansi256(N)`. Pass this string directly to `color` or `backgroundColor` props on `<Text>`.

**When to use:** UI-SPEC palette entries that use ANSI 256 indices (166 for orange glyph, 238 for key badge bg, 245 for controls text bg).

```tsx
// Source: node_modules/ink/build/colorize.js [VERIFIED: direct inspection]
// Regex: /^ansi256\(\s?(\d+)\s?\)$/

<Text color="ansi256(166)">┌></Text>          // orange selection glyph
<Text backgroundColor="ansi256(238)" color="white">esc</Text>  // key badge
<Text backgroundColor="ansi256(245)" color="black"> cancel </Text>  // controls text
```

**Named colors still work as-is** — `"green"`, `"cyan"`, `"white"`, `"black"` are resolved via `chalk[color]`. No change needed for existing `cyan` border or `dimColor` usage.

### Pattern 4: `useEffect` Interval for Spinner

**What:** Use React's `useEffect` with `setInterval` to cycle through dot states at 200ms. Clear the interval on unmount.

**When to use:** `LoadingSpinner` component while `candidates === null`.

```tsx
// Source: React docs + UI-SPEC §Animation / Loading State [ASSUMED - standard React pattern]
const FRAMES = ['thinking…', 'thinking.', 'thinking..', 'thinking…'];

export function LoadingSpinner(): ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame(f => (f + 1) % FRAMES.length);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <Text dimColor>{FRAMES[frame]}</Text>
  );
}
```

### Pattern 5: Filter Algorithm (Case-Insensitive Substring)

**What:** Per UI-SPEC §Live Search — filter is case-insensitive prefix/substring match. Apply to command text (not explanation).

```typescript
// [ASSUMED - trivial JS, no library needed]
function filterCandidates(candidates: CandidateList, query: string): CandidateList {
  if (!query) return candidates;
  const lower = query.toLowerCase();
  return candidates.filter(c => c.command.toLowerCase().includes(lower));
}
```

**Selected index reset:** When the filtered list changes, reset `selectedIndex` to 0. If filtered list is empty, show the `"no matches — try a different query"` copy from UI-SPEC copywriting contract.

### Anti-Patterns to Avoid

- **Using `useStdin` directly for input:** `useInput` is the correct Ink abstraction for keyboard handling. `useStdin` requires manual raw mode and data event parsing.
- **Importing chalk in component files:** Ink's `<Text color="ansi256(N)">` handles ANSI 256 internally. Adding a chalk import to component code couples the component to a transitive dependency.
- **Using `ink-spinner` package:** UI-SPEC explicitly forbids new packages. The spinner is implemented with `useState` + `useEffect` — no external package.
- **Writing to `stdout` directly for the loading indicator:** `showLoadingIndicator` in the current `run-foreground.ts` writes raw ANSI to stdout before Ink opens. D-05 removes this pattern. After this phase, all visual output is owned by Ink.
- **Forgetting to clear `setInterval` in `useEffect` cleanup:** Terminal processes don't automatically garbage-collect intervals. Failing to return the cleanup function leaks the timer into the process after the spinner unmounts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push updated props into live Ink component | Custom event emitter / React context / ref-passed setState | `app.rerender(newElement)` | Ink's official API for updating root props after initial render |
| ANSI 256 color rendering | Manual `\x1b[38;5;166m` escape sequences | `color="ansi256(166)"` on `<Text>` | Ink 7 handles via chalk; avoids raw escape sequences in component code |
| Spinner animation | External `ink-spinner` package | `useState` + `useEffect` interval | UI-SPEC npm safety gate; native approach is 5 lines |
| Keyboard input buffering | Raw TTY `stdin.on('data')` | `useInput` hook | Ink manages raw mode and input routing automatically |

---

## Common Pitfalls

### Pitfall 1: `MODAL_CHROME_LINES` Under-count Causes Viewport Clip

**What goes wrong:** The `renderModal` function scrolls the terminal by `viewportRows - modalHeight - 1` lines to create a blank zone. If `MODAL_CHROME_LINES` is too small, the modal overflows its reserved zone and overwrites prior terminal history, or is partially hidden below the viewport.

**Why it happens:** The current value is `7` (2 border + title + separator + body marginTop + footer marginTop + footer). Adding search zone, gap between search and results, and the monocle controls zone increases the fixed chrome significantly.

**New count:**
```
Border top:          1
Title row:           1
Separator row:       1
Search zone:         1
Gap (search→results):1
[candidate rows]:    dynamic
Gap (results→controls):1
Controls zone:       1
Border bottom:       1
= 9 fixed chrome lines
```
So `MODAL_CHROME_LINES = 9` (up from 7). The `renderModal` signature must pass `candidateCount` separately from the chrome constant.

**Warning signs:** Modal content scrolled off-screen, or prior terminal lines overwritten.

### Pitfall 2: `candidates` Prop Change Does Not Reset `selectedIndex` Automatically

**What goes wrong:** When `rerender()` pushes a resolved `CandidateList` into the already-rendered `CandidateSelect`, React does not automatically reset internal state. The `selectedIndex` from the loading phase (always 0) is fine — but if D-01 filters on first render and the filtered list is shorter, the selectedIndex must reset to 0 explicitly.

**Why it happens:** React state persists across re-renders unless explicitly reset. A `useEffect([candidates])` dep array trigger is the correct place to reset `selectedIndex` to 0 when `candidates` transitions from `null` to a non-null `CandidateList`.

**How to avoid:**
```typescript
useEffect(() => {
  setSelectedIndex(0);
}, [candidates]); // reset when candidates arrive
```

### Pitfall 3: `useInput` Fires When `candidates === null`

**What goes wrong:** During the loading state, the user may press keys. If `useInput` handlers reference `candidates` without null-guarding, runtime errors occur (e.g., `candidates.length` on null).

**Why it happens:** `useInput` is active for the full lifetime of the component, including the loading state.

**How to avoid:** Guard all `candidates` references inside `useInput`:
```typescript
if (key.upArrow && candidates) {
  setSelectedIndex(...);
  return;
}
```
Or use early return: `if (!candidates) return;` at the top of the key handler for navigation/accept keys.

### Pitfall 4: `rerender()` Called After `unmount()`

**What goes wrong:** If `fetchCandidates` throws and the error handler calls `unmount()` before `rerender()` executes (due to race conditions), a no-op `rerender` call could happen after unmount.

**Why it happens:** `fetchCandidates` rejects → error path writes cancel result and calls `unmount()` → the `rerender` reference is stale.

**How to avoid:** Check a mounted flag or capture the rejection before `rerender` is called. Alternatively, handle the error state inside the component by passing an `error` prop instead of unmounting from the catch block.

### Pitfall 5: Existing Test `"shows immediate loading feedback"` Expects Raw ANSI

**What goes wrong:** `tests/client-result.test.ts` line 299 asserts `writeStreamWrites.join("").toContain("QueQue is thinking...")`. After D-05 (remove raw ANSI, use Ink spinner), the raw ANSI write no longer happens. This test will fail.

**Why it happens:** The test was written to verify the existing `showLoadingIndicator` function. D-05 replaces that function with a modal-first Ink render.

**How to avoid:** The test for loading state must be updated. The new assertion should verify that the modal renders immediately (i.e., `rerender` is called with a non-null `CandidateList` after the promise resolves), not that the raw ANSI string appears. The `writeStreamWrites` mock captures Ink's output — assert that output includes spinner text or that the mock component is rendered with `candidates={null}` first.

---

## Code Examples

### CandidateSelect Props Signature Change

```typescript
// [VERIFIED: 03.1-CONTEXT.md — D-06 contract]
interface Props {
  candidates: CandidateList | null;  // null = loading state
  initialQuery?: string;             // pre-populate search from lbuffer (D-01/D-02)
  onSelect: (command: string) => void;
  onCancel: () => void;
}
```

### SearchInput Component (Internal Contract)

```tsx
// Source: UI-SPEC §Component Inventory + §Copywriting Contract [CITED: 03.1-UI-SPEC.md]
// External contract: renders SEARCH: {query} row; query state managed by parent CandidateSelect
interface SearchInputProps {
  query: string;  // controlled — state lives in CandidateSelect
}

export function SearchInput({ query }: SearchInputProps): ReactElement {
  return (
    <Box>
      <Text color="cyan" bold>SEARCH: </Text>
      <Text>{query || ''}</Text>
      {!query && <Text dimColor>type to filter…</Text>}
    </Box>
  );
}
```

### ControlsLine Component

```tsx
// Source: UI-SPEC §Copywriting + Color table [CITED: 03.1-UI-SPEC.md]
export function ControlsLine(): ReactElement {
  return (
    <Box>
      <Text backgroundColor="ansi256(238)" color="white" bold> ↑↓ </Text>
      <Text backgroundColor="ansi256(245)" color="black"> select </Text>
      <Text> · </Text>
      <Text backgroundColor="ansi256(238)" color="white" bold> enter </Text>
      <Text backgroundColor="ansi256(245)" color="black"> accept </Text>
      <Text> · </Text>
      <Text backgroundColor="ansi256(238)" color="white" bold> esc </Text>
      <Text backgroundColor="ansi256(245)" color="black"> cancel </Text>
    </Box>
  );
}
```

### Selection Glyph Update

```tsx
// Source: UI-SPEC §Selection Glyph Contract [CITED: 03.1-UI-SPEC.md]
// Replace ❯ with ┌> (active first line), keep │  for active continuation rows
// This phase renders each candidate as a single-line row, so only ┌> matters.
{active ? (
  <Text color="ansi256(166)">┌> </Text>
) : (
  <Text>{'   '}</Text>  // 3 spaces = ┌> + space width
)}
```

### run-foreground.ts — Modal-First Async Pattern

```typescript
// Conceptual structure for D-05/D-07 [CITED: 03.1-CONTEXT.md]
// Remove showLoadingIndicator; open modal before fetchCandidates resolves

const { rerender, unmount: inkUnmount } = render(
  buildInitialElement(unmountCallback),  // candidates=null
  { stdin, stdout }
);

// Concurrently fetch
fetchCandidates(envelope, request.rbuffer).then(candidates => {
  rerender(buildResolvedElement(candidates, unmountCallback));
}).catch(err => {
  rerender(buildErrorElement(unmountCallback));
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `❯` selection glyph | `┌>` (box-drawing + arrow) | Phase 03.1 | Matches monocle visual language |
| Raw ANSI loading text (`\r\x1b[2KQueQue is thinking...`) | Ink spinner inside modal | Phase 03.1 | All terminal output owned by Ink; no pre-modal ANSI writes |
| Single-candidate fast-accept bypass (D-03 removes) | Modal always shows | Phase 03.1 | Consistent UX regardless of candidate count |
| `candidates: CandidateList` (non-nullable) | `candidates: CandidateList \| null` | Phase 03.1 | Enables modal-first render before provider responds |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useEffect` cleanup in `LoadingSpinner` will be called when `CandidateSelect` transitions from loading to candidates state | Code Examples §LoadingSpinner | If wrong, interval leaks; spinner may re-appear or cause state updates on unmounted component |
| A2 | The spinner text copy `thinking…` / `thinking.` / `thinking..` cycles correctly with `FRAMES` array | Code Examples | Trivial — worst case is off-by-one in dot count |

**All critical claims are VERIFIED or CITED. Only two low-risk implementation detail assumptions remain.**

---

## Open Questions (RESOLVED)

1. **`rerender()` vs wrapper-component setState for D-07**
   - RESOLVED: Use `rerender()` — implemented in Plan 03 Task 2. `rerender()` is simpler and avoids ref leakage. UI-SPEC defers the choice to Claude's discretion; `rerender()` is the default with a thin wrapper-component fallback if test infrastructure requires it.

2. **Test update scope for `"shows immediate loading feedback"` test**
   - RESOLVED: Replace with modal-result assertion — implemented in Plan 01 Task 2. The raw ANSI assertion (`"QueQue is thinking..."`) is replaced with a check that the modal renders successfully and resolves to a non-null CandidateList.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — phase uses only existing installed packages and native Node APIs).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.4 |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test:run` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TUI-01 | Modal opens immediately with spinner before candidates arrive | unit | `pnpm test:run -- --reporter=verbose tests/client-result.test.ts` | ✅ (needs update) |
| D-03 | Single-candidate case renders modal, not fast-accept | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (needs update) |
| D-06 | `CandidateSelect` renders spinner when `candidates=null` | unit/smoke | manual TTY test | ❌ Wave 0 |
| SAFE-01 | Provider error renders error state, Esc writes cancel result | unit | `pnpm test:run -- tests/client-result.test.ts` | ✅ (needs update) |

### Sampling Rate

- **Per task commit:** `pnpm test:run`
- **Per wave merge:** `pnpm test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/candidate-select.test.tsx` — unit test for `CandidateSelect` with `candidates=null` (spinner) and `CandidateList` (candidate rows), keyboard nav, filter behavior. Requires Ink test renderer or mock of `render`.
- [ ] Update `tests/client-result.test.ts` line 299 — replace `"QueQue is thinking..."` assertion with modal-first behavior assertion.
- [ ] Update `tests/client-result.test.ts` — remove/update single-candidate fast-accept test (D-03 removes that path).

---

## Security Domain

This phase introduces no new input surfaces, no authentication, no storage, no network calls beyond the existing `fetchCandidates`. The `useInput` handler processes keyboard characters locally and never writes them to disk or sends them to the provider. No ASVS categories apply beyond what was already covered in earlier phases.

---

## Sources

### Primary (HIGH confidence)
- `/vadimdemedes/ink` (Context7) — `useInput` keyboard API, `rerender()` instance method, `Text` component color props
- `node_modules/ink/build/colorize.js` — Direct inspection confirming `ansi256(N)` string format support
- `node_modules/ink/package.json` — Confirmed ink 7.0.1 with chalk ^5.6.2 dependency
- `03.1-UI-SPEC.md` — Visual and interaction contract for all component details
- `03.1-CONTEXT.md` — Implementation decisions D-01 through D-07
- `src/ui/CandidateSelect.tsx`, `src/ui/Modal.tsx`, `src/client/run-foreground.ts` — Existing implementation baseline

### Secondary (MEDIUM confidence)
- `https://github.com/vadimdemedes/ink/blob/master/readme.md` — `render()` / `rerender()` API reference (cited via Context7)

### Tertiary (LOW confidence)
- None — all claims verified against source code or official documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via package.json and node_modules inspection
- Architecture: HIGH — based on direct Ink 7 source inspection and existing codebase patterns
- Pitfalls: HIGH — derived from reading existing test assertions and Ink internals
- Color format: HIGH — verified via colorize.js regex inspection

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (Ink 7 is stable; chalk 5 ANSI 256 format unlikely to change)