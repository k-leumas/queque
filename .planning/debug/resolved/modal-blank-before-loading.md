---
status: resolved
trigger: "DATA_START modal opens quickly but nothing shows up for a long time; when content finally appears the LLM call is still waiting, making the UI feel very unresponsive DATA_END"
created: 2026-10-11
updated: 2026-10-11
---

## Symptoms

- expected: As soon as the `??` modal opens, it shows content immediately (the `queque ›` header and a loading/spinner state) and stays responsive while the LLM call is in flight; candidates replace the loading state when they arrive.
- actual: The modal (pane/area) opens quickly but stays blank for a long time. When content finally appears it is the loading/spinner state — the LLM call is still pending at that point — so the blank gap is not the LLM latency itself. User (verbatim, to the expected-behaviour confirmation): "the modal still doesn't show something right away".
- errors: none reported.
- timeline: started recently — around Phase 9 (installed-only tool awareness: zsh handoff of $commands/$builtins/functions, installed-tools chunk, catalog steering) and/or today's Zellij fixes (09-06 render-phase arrival reset + serialized resize queue; quick 261011-e43 pane cursor-row headroom; quick 261011-f9o held pane height while filtering).
- reproduction: every `??` query (not only the first in a shell), both inside a Zellij floating pane and in a plain terminal (inline modal). E.g. type `show me how to use z3??`.

## Current Focus

- bug_class: Bohrbug (deterministic: every `??` pays the same startup path; its wall time scales with CPU contention)
- hypothesis: CONFIRMED (H1) — see reasoning_checkpoint.
- next_action: TDD — add tests/bundle-startup.test.ts (builds the CLI with the real tsup config into a temp dir; asserts the bundle statically imports only Node built-ins and that `node <bundle> --help` runs). Run it RED against the current config, then change tsup.config.ts (noExternal all deps, `react-devtools-core` -> stub alias, createRequire banner) and run it GREEN; rebuild dist; re-run the first-frame probe.

reasoning_checkpoint:
  hypothesis: "The `??` modal is blank before the loading frame because dist/cli/main.js statically imports its dependencies (ink and its ~dozens of ESM/CJS files, yoga, react, zod, @anthropic-ai/sdk, cac) from node_modules; Node must resolve, stat, read and compile every one of those files (~2.5 s CPU) before any client code runs, so nothing is written to the pane until then. Under today's CPU contention (load 150-770 on 12 CPUs) that becomes 4-17 s of blank pane."
  confirming_evidence:
    - "Probe of the real client in a pty: 85-90 % of time-to-first-frame is before `command start` (4.5-6.7 s of 4.8-7.4 s), CPU 2.6-3.1 s; client pre-render work 0.1-0.2 s."
    - "Debug log: qq_cmd -> command start 1-3 s before 16:40Z, 10-17 s after, in both Zellij and inline runs; Phase 9 stages ~10-20 ms."
    - "`import('ink')` alone costs ~2.2 s CPU unbundled; cpu-prof shows it is ESM loader file work (read/open/stat/resolve/compile)."
    - "Same code bundled into one file: --help CPU 3.0 -> 1.3 s; real-client first frame 3.6-5.2 s -> 1.45-2.5 s at the same load."
  falsification_test: "If a bundled build did not move the first visible frame earlier (or `command start` stayed > 2 s CPU), H1 would be wrong. It moved ~2.5x earlier and CPU dropped by ~1.7 s."
  fix_rationale: "Bundling every dependency into dist/cli/main.js removes the per-file module loading that dominates time-to-first-frame, without changing any runtime behaviour or design decision (D-05/D-07: the spinner still lives in the Ink modal, which is still opened before the fetch)."
  blind_spots: "Cannot control machine load; even bundled, ~1.3 s CPU remains before the frame and becomes several seconds at load 400+. Homebrew/npm install path not exercised here (bundle still resolves only Node built-ins, so it should be independent of node_modules). Did not test Node 26 (Homebrew node) — only nvm Node 24.14.1 which the widget/daemon use. Cold-daemon spawn path (ensureDaemon before render) can still add up to ~2 s on the first `??` after a rebuild/reboot."
  candidate_causes:
    - "code/build: unbundled ESM dist -> per-file loading of node_modules before the first frame (CONFIRMED, primary)"
    - "environment: CPU contention (load 150-770) multiplies startup CPU 3-10x (CONFIRMED, contributing; explains 'started recently')"
    - "code: pre-render awaits (ensureDaemon, gatherContext) + first Ink render (~0.3-0.5 s CPU; minor)"
    - "data: Phase 9 handoff read / catalog chunk (eliminated, ~10-20 ms)"
  and_gate: "yes — the 10-17 s blank needs (1) ~2.5 s CPU of module loading before the first frame AND (2) heavy CPU contention. With normal load the same code gave a 1-3 s blank. Only (1) is fixable in code; the fix shrinks it ~2.5x."

## Evidence

- timestamp: 2026-10-11T19:05Z
  checked: /tmp/qq-debug.log, per-session stage gaps (scratchpad parse.py) for every `??` since 2026-10-10
  found: zsh `qq_cmd=` log -> client `command start` (= Node boot + module graph load + cac parse; the widget does nothing heavy in between, only mkfifo) was 1.0-3.0 s for every session up to 10-11 15:46Z, then 9.7-17.4 s for every session from 10-11 16:40Z on (both Zellij and the one inline run at 18:30Z: 17.4 s). `command start` -> `context gathered` (request read, tool handoff read, ensureDaemon, intent, gatherContext, installed-tools chunk) stays 0.2-0.5 s. `context gathered` -> daemon `fetch-candidates` received (TTY streams, raw-mode probe, render(), connect) went 0.1 s -> 0.7-1.5 s. The LLM leg also tripled (6 s -> 19-48 s, incl. a 26 s daemon fetch timeout + in-process fallback).
  implication: The blank gap is dominated by process start before `command start`, not by Phase 9 data work (handoff read + catalog chunk are < 20 ms in the log). Everything slowed by a similar factor at the same moment, which points at CPU contention rather than a code change.

- timestamp: 2026-10-11T19:08Z
  checked: git log 10-11 09:46-10:40 local (between the last fast and first slow session); tsup.config.ts / package.json history
  found: only 261011-e43 commits (a one-constant pane-headroom change + tests/docs) in that window; tsup config and dependencies unchanged since 10-07.
  implication: No code or build change explains the 5-10x jump in startup time.

- timestamp: 2026-10-11T19:10Z
  checked: uptime / ps (machine load)
  found: load averages 399 -> 772 -> 314 during this session on a 12-CPU machine; ~230 runnable processes, mostly Opera (43) and Chrome (28) renderer helpers, Docker hyperkit at 85% CPU.
  implication: CPU starvation multiplies any CPU-bound startup work ~5-10x in wall time.

- timestamp: 2026-10-11T19:12Z
  checked: CPU cost of the client's import graph (`/usr/bin/time -p`, node v24.14.1, same machine)
  found: `node -e 0` 0.24 s user; `import('ink')` 1.70 s user + 0.5 s sys (wall 2.8-16.8 s depending on load); `import('react')` 0.28 s; `node dist/cli/main.js --help` (loads the whole graph, does nothing) 2.0 s user + 0.55 s sys, wall 2.9-22.7 s. NODE_ENV=production makes no difference. dist/cli/main.js statically imports ink, react, zod, @anthropic-ai/sdk and cac at top level for every subcommand.
  implication: ~2.5 s of CPU is spent just loading modules before any client code runs; the client's first frame cannot appear before that. Under load this is the 10-17 s blank.

- timestamp: 2026-10-11T19:14Z
  checked: --cpu-prof of `import('ink')`
  found: time is spread over ESM loader machinery — native read 990 ms, compileSourceTextModule 800 ms, resolve/finalizeResolution 500 ms, internalModuleStat 480 ms, undici lazy require 360 ms, open 320 ms, CJS wrapSafe 300 ms, string-width module init 250 ms, yoga 120 ms (8.7 s wall profile under load). Individually, ink/build/index.js costs ~1.1 s CPU on top of its heaviest deps (yoga 0.28 s, es-toolkit 0.3 s).
  implication: The cost is per-file module loading/compiling (many small ESM files), i.e. reducible by fewer files (bundling), a compile cache, or not loading what the client does not need before the first frame.

- timestamp: 2026-10-11T19:27Z
  checked: Real `node dist/cli/main.js client` in a tmux pty (inline mode, ZELLIJ unset), 3 runs, with a scratchpad preload probe that timestamps node boot, the client's own debug-log stages and the first tty write that contains visible text; IPC redirected to a scratch daemon that answers ping/fetch like the real one (measurement only, no repo test). Load avg 150-270.
  found: preload (node boot) 0.38-0.48 s, CPU 0.35 s -> `command start` 4.5-6.7 s, CPU 2.6-3.1 s -> `context gathered` +0.1-0.2 s -> first visible frame +0.2-0.6 s (first frame at 4.8 / 5.4 / 7.4 s). The inline reserve newlines are the first tty write and come immediately before the frame. ~85-90 % of time-to-first-frame is spent before `command start`, i.e. loading the module graph.
  implication: H1 confirmed: the loading frame is late because the whole statically-imported dependency graph must load before any client code runs. Phase 9 work (handoff read ~10 ms, catalog chunk ~10 ms) and the Zellij resize code (only acts after the frame) are not the cause; the inline path shows the same gap.

- timestamp: 2026-10-11T19:41Z
  checked: Experimental single-file bundle (esbuild, all deps inlined, `react-devtools-core` aliased to a stub, createRequire banner) vs. current dist, `--help` CPU (user+sys), 4 interleaved runs each, output verified (17 lines, rc 0)
  found: current dist 2.73-3.14 s CPU; bundle 1.16-1.36 s; bundle + NODE_COMPILE_CACHE 1.13-1.31 s; `node -e 0` 0.31-0.34 s. Module-graph CPU drops from ~2.6 s to ~0.95 s. A compile cache alone does nothing for the unbundled dist (2.99 vs 3.00 s): the cost is file resolution/stat/read per module, not compilation. NODE_ENV=production at build time does not change load CPU (V8 lazy parsing).
  implication: Bundling dependencies removes ~1.7 s CPU of per-file module loading from every `??`.

- timestamp: 2026-10-11T19:48Z
  checked: Interleaved real-client first-frame probe, current dist vs. experimental bundle (3 pairs, load 135-200)
  found: current dist first visible frame at 4.17 / 5.20 / 3.62 s (CPU 2.65-3.01 s); bundle at 2.49 / 1.51 / 1.45 s (CPU 1.30-1.41 s). The bundled client drew the loading frame and then received and rendered candidates normally.
  implication: Bundling makes the loading frame appear ~2.5x sooner under the same load. Remaining time is Node boot (~0.33 s CPU), ink+yoga init in the bundle (~0.55 s), zod/sdk/cac (~0.2 s), pre-render client work (~0.1 s) and the first render (~0.2-0.3 s).

- timestamp: 2026-10-11T19:50Z
  checked: Path-sensitive code under a single-file bundle
  found: only `import.meta.url` users are main.ts isDirectRun, init.ts (`../../shell/<shell>`) and bootstrap.ts spawnDaemon (re-execs the same file) — all relative to dist/cli/main.js, unchanged by bundling. ink's reconciler only imports devtools when DEV=true AND `import.meta.resolve('react-devtools-core')` succeeds; esbuild hoists devtools.js's static `import devtools from 'react-devtools-core'` to top level, so it must be aliased to a stub (keeping it external crashed the bundle with ERR_MODULE_NOT_FOUND at startup). CJS deps (react, signal-exit, ws) need a real `require` (createRequire banner).
  implication: Bundling is safe for runtime paths if the build adds the devtools alias and the createRequire banner.

## Eliminated

- hypothesis: Phase 9 installed-tools work (handoff file read, catalog ∩ installed, strict zod validation) blocks the first render.
  evidence: debug log shows `tool handoff read` and `installed-tools chunk` within ~10-20 ms of the previous stage in every session; probe shows `command start` -> `context gathered` 0.1-0.2 s total.
  timestamp: 2026-10-11T19:30Z

- hypothesis: Today's Zellij changes (09-06 render-phase reset + resize queue, 261011-e43 headroom, 261011-f9o hold) hide or delay the loading frame.
  evidence: they act on layout reports/resizes after Ink has drawn; the inline (non-Zellij) path has the same blank gap (log 18:30Z inline run: 17.4 s before `command start`; tmux inline probe 4.8-7.4 s to first frame).
  timestamp: 2026-10-11T19:30Z

- hypothesis: ensureDaemon (tryConnect + ping) or gatherContext is the main delay.
  evidence: `ensure start` -> `daemon ensured` 60-210 ms in the slow-era logs, daemon always `already running`; probe: whole pre-render client section 0.1-0.2 s.
  timestamp: 2026-10-11T19:30Z

- hypothesis: A code/build change around 10:40 local made startup 5-10x slower.
  evidence: only a one-constant pane-headroom commit in that window; tsup config and dependency versions unchanged since 10-07; the daemon-side LLM leg (separate long-lived process) slowed by a similar factor at the same time, which a client code change cannot do.
  timestamp: 2026-10-11T19:30Z

## Resolution

- root_cause: dist/cli/main.js statically imported its whole dependency graph (ink and its many small ESM/CJS files, yoga, react, zod, the Anthropic SDK, cac) from node_modules. Node had to resolve, stat, read and compile every file (~2.5 s CPU) before any client code ran, so the pane/inline area stayed blank until then. Heavy CPU contention (load 150-770 on 12 CPUs) multiplied that into 4-17 s of blank modal.
- fix: quick 261011-jbh. LD-1: the zsh widget paints the `queque › <lbuffer>` header and a `thinking…` row the moment `??` fires, before Node starts (inline: reserve + fresh ESC 7 + CSI J + frame + ESC 8 right after the qq lookup; Zellij: a 0700 session-dir `instant-frame.txt` catted by a `/bin/sh` pane wrapper that then execs the unchanged client argv). The client writes the byte-identical reserve itself and arms a one-shot takeover that inserts the surface clear (its own save + erase, or CSI H + erase in Zellij) into Ink's first visible write. `QQ_INSTANT_FRAME=0` turns the paint off. LD-2: dist/cli/main.js is now a built-in-only launcher that enables Node's module compile cache in `${XDG_CACHE_HOME:-~/.cache}/queque/node-compile-cache` (0700, owner/permission checked, silent on failure) and then imports dist/cli/app.js, a single bundle with every dependency inlined (tsup noExternal, react-devtools-core and ws's optional native add-ons aliased to local shims, createRequire banner). @anthropic-ai/sdk is imported lazily inside getAnthropicClient.
- verification: automated — tests/zsh-widget.test.ts `instant frame` z1-z10, tests/candidate-select-layout.test.tsx `instant frame takeover` t1-t6 (real widget bytes + real Ink frame replays: one header, no residue, no extra scroll), tests/bundle-startup.test.ts b1-b6 (built-in-only loads, startup without node_modules, 0700 cache populated, fail-safe cache locations). Live check: the user confirmed on 2026-10-11 that the `queque ›` frame shows up right away ("queque shows up quickly"). The remaining wait is the LLM call.
- files_changed: shell/zsh/queque.zsh, src/client/instant-frame.ts, src/client/run-foreground.ts, src/cli/launcher.ts, src/shims/react-devtools-core.ts, src/shims/optional-native-module.ts, src/providers/claude.ts, tsup.config.ts, tests/zsh-widget.test.ts, tests/candidate-select-layout.test.tsx, tests/bundle-startup.test.ts
