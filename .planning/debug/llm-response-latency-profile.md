---
status: diagnosed
trigger: "DATA_START i wish the llm response was faster DATA_END"
created: 2026-10-11
updated: 2026-10-12T04:00Z
goal: find_root_cause_only
---

## Symptoms

- expected: After the `??` modal shows its `queque ›` header and `thinking…` row (now instant, quick 261011-jbh), candidates should arrive fast enough that the wait feels short.
- actual: The instant frame appears quickly, but the user feels the time from `thinking…` to the candidates list is too long. User (verbatim): "queque shows up quickly --- i wish the llm response was faster, but this is an awesome perf improvement".
- errors: none reported.
- timeline: long-standing; noticed now that the startup blank (quick 261011-jbh) is gone and the LLM wait is the dominant remaining latency.
- reproduction: any `??` query, e.g. type `show me how to use z3??` in a plain terminal or Zellij pane.

## Scope

Profile only (diagnose; no fix applied). Break one `??` query's thinking→candidates time into stages and measure each:
- client → daemon IPC (ensureDaemon, fetch-candidates round trip, cold vs warm daemon)
- context gathering (client and daemon side)
- prompt build (system prompt incl. catalog steering + installed-tools chunk; size in tokens)
- provider path actually selected on this machine (Anthropic SDK in the daemon vs `claude -p` subprocess, which model id, max_tokens, streaming or not, prompt caching or not)
- time to first token / headers, total model time, output token count
- response parsing / zod validation and render after arrival

Deliverable: a stage-by-stage timing table (several runs, note machine load), the dominant cost(s), and ranked fix options with expected savings (e.g. faster model, prompt caching, streaming first candidate, smaller prompt, avoiding `claude -p` spawn). Measurement scaffolding belongs in the session scratchpad, not repo tests. Real provider calls are fine (they cost a few cents); do not stub the provider when measuring the real path.

## Current Focus

- bug_class: Bohrbug (deterministic per path; wall time scales with network/API variance, little with local load at load 3-6)
- hypothesis (H1): CONFIRMED — every `??` runs a fresh `claude -p` (Claude Code 2.1.285, account-default claude-opus-5-5, Claude Code default xhigh effort) in the daemon because no usable API key is reachable; the subprocess is 90-97 % of the wait.
- next_action: none in this session (diagnose-only). Orchestrator picks a fix from Resolution.ranked_fix_options.

reasoning_checkpoint:
  hypothesis: "The thinking->candidates wait is dominated by the per-query `claude -p` subprocess (median 4.87 s z3 / 3.66 s familiar): ~1.37 s Claude Code boot+shutdown, ~0.95 s time-to-headers, 0-1.8 s xhigh-effort thinking on Opus 5.5, ~1.4 s JSON generation, and nothing is shown until the process exits."
  confirming_evidence:
    - "Live daemon fetches spawn a `claude -p` child that lives for the whole 4.7-6.1 s fetch; no SDK log lines in any real session."
    - "stream-json stage timing over 26+15 runs; e2e real-widget runs put QueQue-side stages at ~0.4 s total."
    - "Variants isolate each part: --effort low removes thinking (0/15) and ~1.05 s on z3; pre-spawn removes the 0.93 s boot; stdout arrives ~0.47 s before exit."
  falsification_test: "If a fetch could be observed without a `claude` child, or QueQue-side stages exceeded ~1 s, H1 would be wrong. Neither happened (8/8 fetches had the child; client stages 61-78 ms + ~0.38 s boot)."
  fix_rationale: "n/a (diagnose-only); ranked options target the measured stages."
  blind_spots: "SDK path not measurable (no key). Candidate quality at --effort low / haiku only checked on 3 queries. Tail (8-14 s, 3/58) sub-stage not captured in a stream-json run. Daemon runs on Homebrew Node 26 while probes ran Node 24 (only affects spawn cost, ~ms). Only this machine/network."
  candidate_causes:
    - "config/environment: no API key reachable -> CLI path (CONFIRMED)"
    - "code: claude-cli argv sets no --model/--effort, text output, waits for exit (CONFIRMED, contributing)"
    - "environment: Claude Code per-process boot/shutdown (CONFIRMED, contributing)"
    - "data/prompt size or missing caching (ELIMINATED)"
    - "client/IPC/render (ELIMINATED, ~0.4 s)"
  and_gate: "yes — the ~5 s wait is the sum of independent contributors (process lifecycle + model effort/thinking + full-answer-then-exit), each removable separately; no single one explains it."

## Evidence

- timestamp: 2026-10-12T03:22Z
  checked: /tmp/qq-debug.log (QQ_DEBUG_LOG_FILE) real `??` sessions since boot (20:43 local): 21:12:18, 21:12:30 (Zellij, cwd tui-llm), 21:13:00, 21:13:11 (inline, cwd public_gsd-2), all `show me how to use z3`.
  found: zsh trigger -> client `command start` ~1 s; `command start` -> `context gathered` 17-24 ms; `context gathered` -> daemon `fetch-candidates` received 42-73 ms; daemon `request received` -> `replied candidates` 4.86 / 5.44 / 3.62 / 3.73 s; candidates -> `candidates received` (client) 2-3 ms. No `[provider] sdk path` / `request start` / `response parsed` line was logged for any of them (the SDK path logs all three; the CLI path logs nothing on success).
  implication: the LLM leg (3.6-5.4 s) is ~97 % of thinking->candidates; client/IPC/context stages total ~0.1 s. The missing provider lines point to the `claude -p` path, not the SDK.

- timestamp: 2026-10-12T03:24Z
  checked: live daemon process (ps eww / lsof), src/daemon/bootstrap.ts spawnDaemon, src/providers/claude-default.ts, src/shared/env-file.ts
  found: daemon PID 965 = `/usr/local/Cellar/node/26.3.0/bin/node dist/cli/app.js daemon` (Homebrew Node 26, not nvm 24), started 20:45:04 by a shell with `CLAUDE_DESKTOP_RESOLVING_ENVIRONMENT=1` (Claude Desktop's env-resolution login shell ran the zsh prewarm), cwd `/`, no ANTHROPIC_API_KEY in env (the user's interactive shell has none either). spawnDaemon passes no cwd/env, so the daemon inherits them from whichever shell ensured it first. claudeDefaultAdapter picks SDK only if `usableSecret(process.env.ANTHROPIC_API_KEY) ?? .env.local found by walking up from process.cwd()`; from `/` there is no `.env.local` (the repo has one, contents not read). `claude` on the daemon's PATH = /usr/local/bin/claude -> Claude Code 2.1.285 (Homebrew cask). QueQue passes no `--model`/`--effort`; ~/.claude/settings.json has no `model` and `effortLevel: "xhigh"`.
  implication: which provider path a `??` takes depends on the cwd of the first shell after boot; today it is `claude -p` with the account-default model. To be confirmed by observing a `claude` child of the daemon during a real fetch.

- timestamp: 2026-10-12T03:30Z
  checked: scratchpad ipc-fetch.mjs -> the LIVE daemon socket /tmp/qq-501.sock with the exact `??` envelope (`show me how to use z3`, cwd tui-llm, installed-tools chunk = catalog ∩ live zsh $commands/functions = 58 tools, same count as the real sessions), polling `ps` every 50 ms for children of PID 965. 3 runs, load 3.3-3.7 (12 CPUs).
  found: connect 6-7 ms, fetch-accepted 7-9 ms, candidates at 6.11 / 4.71 / 4.76 s. Every run had exactly one daemon child: `claude -p --output-format text --safe-mode --tools  --no-session-persistence --system-prompt …`, alive for the whole fetch (first seen at 0.27-0.33 s, i.e. by the first ps poll).
  implication: H1 CONFIRMED. The real path is `claude -p` (Claude Code 2.1.285) spawned per `??`. IPC is < 10 ms.

- timestamp: 2026-10-12T03:34Z
  checked: exact QueQue prompts via the repo's own buildSystemPrompt/buildPrompt (esbuild bundle of src into the scratchpad): system 1,194 chars, user 411 chars (~400 tokens together). `claude -p` with the production argv but `--output-format stream-json --verbose --include-partial-messages`, timing each event on arrival (cli-probe.mjs, daemon PATH -> /usr/local/bin/claude, cwd tui-llm). 6 runs, load 3.2-4.8.
  found: (ms from spawn; median [range]) system/init 0.93 s [0.86-1.12]; message_start 1.95 s [1.76-2.24] => API time-to-headers 0.95 s [0.84-1.35]; thinking block in 4/6 runs (first text 0.2-0.95 s after message_start when thinking ran); message_stop 4.0 s [3.29-5.30]; `result` +14 ms; process exit 4.6 s [3.74-5.69] => Claude Code shutdown after the answer 0.45 s [0.38-0.54]. Model `claude-opus-5-5` (account default — QueQue passes no --model). usage: 2 uncached + 1,002 cache-read input tokens (Claude Code adds ~600 tokens and caches the prefix), 147-306 output tokens incl. thinking; duration_api_ms 2.2-4.2 s; $0.003-0.006 per `??`.
  implication: of a ~4.6 s `claude -p`, ~1.4 s is Claude Code process overhead (boot 0.9 + shutdown 0.45) that the SDK path never pays, ~0.95 s is time-to-headers on a fresh TLS connection, 0-1 s is thinking, ~1.3-1.8 s is generating the JSON.

- timestamp: 2026-10-12T03:36Z
  checked: production argv verbatim (`--output-format text`) 3 runs, load 3.7-4.0; `claude --version` 2 runs.
  found: exit at 8.26 / 9.56 / 5.22 s (first stdout at 8.00 / 9.18 / 4.74 s — text mode prints only at the end). `claude --version` 25-29 ms.
  implication: the production path has a long tail (8-10 s) on top of the ~4.6 s median; with text output the client cannot see anything until the whole answer (incl. thinking) is done. The ~0.9 s boot is Claude Code app setup (settings/auth/init), not binary load.

- timestamp: 2026-10-12T03:45Z
  checked: `claude -p` variants, 3 runs each, stream-json timing, load 3.1-3.7.
  found: (exit s) `--effort low` (opus-5-5): 3.87 / 4.07 / 3.46, no thinking block in any run, 147-196 out tokens. `--model sonnet` (= claude-sonnet-5-5): 4.23 / 4.31 / 4.10, no thinking, 295-323 out tokens (longer explanations, ~2.1 s generation). `--model sonnet --effort low`: 5.95 / 3.87 / 7.63 (time-to-headers 2.1 / 0.75 / 4.4 s — server-side variance). `--model haiku` (= claude-haiku-4-5-20251001): 11.8 / 20.8 / 23.8 s with 1,263-3,121 thinking+output tokens and no prompt cache (802 input tokens).
  implication: inside `claude -p`, `--effort low` trims ~0.5 s median and removes the thinking tail; switching to sonnet does not help; haiku through Claude Code is far worse (it thinks at length). The fixed ~1.4 s process overhead and ~0.9 s fresh-connection time-to-headers remain in every variant.

- timestamp: 2026-10-12T03:29Z
  checked: second instance of the same dist/cli/app.js daemon (Homebrew Node 26.3.0, ANTHROPIC_API_KEY unset like the live one) started with cwd = repo root so the app's own `.env.local` walk-up finds the repo file; scratch socket /tmp/qq-prof-sdk.sock, scratch debug log; 5 fetches with the same envelope, load 3.7-3.9. (The .env.local file itself was not read.)
  found: 4.87 / 4.86 / 5.07 / 5.43 / 5.29 s; every fetch spawned `/usr/local/bin/claude -p …`; the scratch log has no `[provider] sdk path` / `request start` line.
  implication: no usable ANTHROPIC_API_KEY is reachable from the env or the repo `.env.local`, so this machine is a `/login`-only setup: the SDK path (claude-sonnet-5, warm keep-alive client) cannot run here and was not measurable without a key. Every `??` pays the `claude -p` path. Separately, the daemon's key lookup is cwd-relative and spawnDaemon inherits cwd/env from whichever shell ensured it first (here Claude Desktop's env-resolution shell in `/`), so an API-key user who keeps the key only in a project `.env.local` silently gets the CLI path too.

- timestamp: 2026-10-12T03:33Z
  checked: PRE-SPAWNED `claude -p --input-format stream-json` (prespawn-probe.mjs): spawn with QueQue's argv + system prompt, idle 4 s, then write the user prompt as one stream-json user message and close stdin. 3 default + 3 `--effort low`, load 3.9-4.6.
  found: `init` is emitted 31-42 ms after the write (boot already done while idle). write -> message_start 1.03-1.29 s (one 4.89 s server spike); write -> result default 3.79 / 3.87 / 5.86 s (thinking in 3/3), `--effort low` 2.07 / 2.67 s (+ the 6.33 s spike run); result -> exit still 0.24-0.32 s. stdin write+close worked 6/6 (no hang).
  implication: a warm, pre-spawned Claude Code process removes the ~0.93 s boot from the critical path; time-to-headers (~1 s) is server/connection-side and stays.

- timestamp: 2026-10-12T03:36Z
  checked: END-TO-END through the real zsh widget (tmux pty, `env -u ZELLIJ zsh -f -i`, `source shell/zsh/queque.zsh`, live daemon PID 965), `show me how to use z3??`, polling capture-pane every 30 ms; client stages from a scratch QQ_DEBUG_LOG_FILE, daemon stages from /tmp/qq-debug.log. 5 runs, load 4.4-5.0.
  found: instant `thinking…` frame at 0.035-0.070 s; candidates visible at 5.30 / 4.32 / 4.34 / 14.00 / 5.36 s. Per run: keypress -> client `command start` (zsh widget + bundled Node launcher boot) ~0.35-0.43 s; `command start` -> `context gathered` 19-23 ms; -> daemon `fetch-candidates` received 41-55 ms; daemon leg (= `claude -p`) 4.79 / 3.90 / 3.92 / 13.58 / 4.91 s; daemon reply -> client `candidates received` 2-3 ms. `node dist/cli/main.js --help` = 0.20-0.32 s wall at load ~5.
  implication: the `claude -p` leg is 90-97 % of the user-visible thinking->candidates wait; all QueQue-side stages together are ~0.4 s.

- timestamp: 2026-10-12T03:40Z
  checked: tail behaviour: 12 alternating `--output-format text` / `json` runs (load 4.1-6.3) + 12 more stream-json runs (load 4.4-5.7); all default-config `claude -p` legs collected this session (stream-json 26, text/json 12, direct text 3, live daemon 3, scratch daemon 5, e2e 5, user's real sessions 4).
  found: text 4.43-5.08 s, json 3.56-5.46 s — no format effect. n=58 legs: p50 4.86 s, p75 5.29 s, p90 5.57 s, max 13.58 s; 3/58 > 8 s (8.26, 9.56, 13.58 s, all text-mode where stages are invisible). Directly observed tail sources elsewhere: server time-to-headers spikes of 2.1 / 2.8 / 4.4 / 4.9 s (no thinking involved) and thinking phases up to 1.83 s. In text/json mode stdout arrives 0.36-0.62 s (median 0.47 s) before the process exits.
  implication: ~1 in 20 `??` takes 8-14 s, from API-side variance (queueing) and/or long thinking — not from QueQue. Resolving on the complete answer instead of process exit saves ~0.45 s on every query.

- timestamp: 2026-10-12T03:48Z
  checked: haiku with thinking disabled: `--model haiku --settings '{"alwaysThinkingEnabled":false}'` (2 runs) and `MAX_THINKING_TOKENS=0 --model haiku` (2 runs); `--model haiku --effort low` (3 runs). Load 3.4-4.0.
  found: thinking off: exit 2.84 / 4.00 / 4.51 / 2.88 s (median 3.44), first complete candidate 1.85-3.10 s, 121-157 output tokens, generation 0.9 s, no prompt cache (772 input tokens < Haiku 4.5's 4,096 minimum). `--effort low` does NOT stop haiku thinking: 10.6 / 41.3 / 36.4 s with 1,048-5,632 output tokens.
  implication: a faster model only helps if thinking is explicitly disabled; `--model haiku` alone is a 2-8x regression.

- timestamp: 2026-10-12T03:55Z
  checked: generality: two more queries (`find files larger than 100MB under this directory`, `undo my last git commit but keep the changes`), default vs `--effort low`, 3 runs each (load 3.9-4.5); 6 more z3 `--effort low` runs.
  found: q2/q3 default: no thinking in 6/6, boot 0.92, time-to-headers 0.93, first candidate 2.21 [2.06-2.34], generation 1.40, shutdown 0.44, exit 3.66 [3.60-4.01] s. q2/q3 `--effort low`: exit 3.64 [3.42-5.40] (the 5.40 = a 2.79 s time-to-headers spike). z3 `--effort low` (n=9): no thinking 0/9, first candidate 2.29 [2.18-2.56], exit 3.82 [3.46-4.07] s vs default z3 4.87 [3.59-5.85] (n=26, thinking 19/26). Same top candidate in every variant (`tldr z3`, `find . -type f -size +100M`, `git reset --soft HEAD~1`).
  implication: thinking (Claude Code's default effort is `xhigh`; QueQue passes no `--effort`) costs ~1 s only on less familiar queries; the fixed per-`??` floor is boot 0.9 + time-to-headers 0.95 + generation 1.2-1.4 + shutdown 0.45 ≈ 3.6 s on every query.

- timestamp: 2026-10-12T03:57Z
  checked: claude-api skill reference (shared/prompt-caching.md, model table)
  found: minimum cacheable prefix: Claude Sonnet 5 (`claude-sonnet-5`, QueQue's SDK DEFAULT_MODEL, still a valid id) 1,024 tokens; Opus 5.5 / Sonnet 5.5 512; Haiku 4.5 4,096. Opus 5.5 thinking cannot be disabled (effort is the only control); Claude Code's default effort is `xhigh`. QueQue's own request is ~400 tokens (system 1,194 chars + user ~420 chars).
  implication: prompt caching cannot help: the `claude -p` path already reads 1,002 cached tokens (2 uncached) per call, and an SDK request of ~400 tokens is below every model's minimum, so `cache_control` would silently not cache.

## Eliminated

- hypothesis: (H2) the daemon uses the Anthropic SDK path and claude-sonnet-5 generation time dominates.
  evidence: no `[provider] sdk path` line in any real session; every live-daemon fetch spawned a `claude -p` child; a daemon started with cwd = repo also took the CLI path 5/5 (no usable key in env or repo .env.local).
  timestamp: 2026-10-12T03:30Z

- hypothesis: (H3) client boot, context gathering, IPC or render are a significant part of the wait.
  evidence: e2e: keypress -> `command start` 0.35-0.43 s, client work 61-78 ms, IPC connect+ack < 10 ms, reply -> render 2-3 ms — ~0.4 s of a 4.3-5.4 s wait.
  timestamp: 2026-10-12T03:37Z

- hypothesis: `--output-format text` (vs streaming formats) causes the 8-14 s tails.
  evidence: 12 alternating text/json runs: text 4.43-5.08 s, json 3.56-5.46 s; tails also appear as time-to-headers spikes in stream-json runs.
  timestamp: 2026-10-12T03:42Z

- hypothesis: missing prompt caching / prompt size makes the request slow.
  evidence: `claude -p` usage shows 1,002 cache-read + 2 uncached input tokens on every Opus call; total input ~1k tokens; QueQue's own prompt (~400 tokens) is below the minimum cacheable prefix for every current model.
  timestamp: 2026-10-12T03:57Z

- hypothesis: switching `claude -p` to Sonnet (`--model sonnet`) is faster.
  evidence: claude-sonnet-5-5 exit 4.10-4.31 s (median 4.22) vs Opus default 4.87 / Opus `--effort low` 3.82: no thinking, but 295-323 output tokens (longer explanations) -> 2.1 s generation.
  timestamp: 2026-10-12T03:45Z

## Resolution

- root_cause: Every `??` on this machine runs a fresh `claude -p` subprocess (Claude Code 2.1.285) inside the daemon, because no usable ANTHROPIC_API_KEY is reachable (`/login`-only setup), so claudeDefaultAdapter never takes the warm SDK path. That subprocess is 90-97 % of the thinking->candidates wait. Its median 4.87 s (z3) / 3.66 s (familiar queries) is: (1) Claude Code process overhead paid per query — boot 0.93 s + shutdown after the answer 0.44 s = ~1.37 s (~28 %); (2) model time on the account-default `claude-opus-5-5`: time-to-headers on a fresh connection ~0.95 s, thinking 0-1.8 s (median 0.8 s on z3 in 19/26 runs, none on familiar queries) caused by Claude Code's default `xhigh` effort (QueQue passes no `--model`/`--effort`), and generating the full JSON (~150-260 tokens incl. explanations) ~1.2-1.4 s; (3) `--output-format text` + execFileAsync waiting for process exit, so nothing reaches the UI until the whole answer is done and the process has shut down. Server-side time-to-headers spikes (2-5 s) and long thinking produce a ~1-in-20 tail of 8-14 s. QueQue-side stages (zsh widget, bundled Node client boot, context, IPC, render) total ~0.4 s.
- timing_table: |
    Stage (`show me how to use z3`, cwd tui-llm, 58 steered tools)      median [range]            n   load (12 CPUs)
    keypress -> instant `thinking…` frame (zsh)                          0.06 s [0.035-0.07]       5   4.4-5.0
    keypress -> client `command start` (zsh + Node bundle boot)          ~0.38 s [0.35-0.43]       5   4.4-5.0
    `command start` -> `context gathered` (request, handoff, intent)     21 ms [19-23]             5   4.4-5.0
    `context gathered` -> daemon `fetch-candidates` received             45 ms [41-55]             5   4.4-5.0
    IPC connect + fetch-accepted (scratch IPC client)                    7 ms [6-13]               8   3.3-3.9
    daemon -> `claude -p` child spawned                                  < 0.3 s (ps poll bound)   8   3.3-3.9
      claude -p boot (spawn -> system/init)                              0.93 s [0.84-1.46]        26  3.2-5.7
      time-to-headers (init -> message_start)                            0.98 s [0.87-1.99]        26  3.2-5.7
      thinking (message_start -> first text; 19/26 runs)                 0.80 s [0-1.83]           26  3.2-5.7
      first text -> first complete candidate                             0.49 s [0.30-0.70]        20  3.2-5.7
      generation (first text -> message_stop; 119-345 out tokens)        1.43 s [1.14-1.98]        26  3.2-5.7
      shutdown (result -> process exit)                                  0.44 s [0.38-0.66]        26  3.2-5.7
      = claude -p spawn -> exit                                          4.87 s [3.59-5.85]        26  3.2-5.7
    daemon `claude -p` leg, all default-config observations              p50 4.86 / p90 5.57 / max 13.58 s   58  3.2-6.3
    daemon reply -> client `candidates received` (zod + state)           2-3 ms                    9   3.7-5.0
    keypress -> candidates visible (e2e)                                 5.30 s [4.32-14.00]       5   4.4-5.0
    familiar queries (find/git), claude -p spawn -> exit                 3.66 s [3.60-4.01]        6   3.9-4.5
    Cost: $0.003-0.007 per `??` (Opus 5.5, 1,002 cached + 2 uncached input tokens).
- dominant_costs: (1) model API time on Opus 5.5 at Claude Code's default xhigh effort (time-to-headers ~1 s + thinking 0-1.8 s + ~1.4 s JSON generation, ≈ 70 %); (2) per-query Claude Code process lifecycle (boot 0.93 + shutdown 0.44 ≈ 1.37 s, ≈ 28 %, and the larger share on familiar queries); (3) waiting for the whole answer + process exit before showing anything (text output + execFileAsync).
- ranked_fix_options: |
    Expected savings vs today's median (z3 e2e ~5.3 s; familiar queries ~4.1 s). Measured unless marked "est.".
    1. `--effort low` on the claude -p argv (2 argv entries; tests). Removes Claude Code's xhigh thinking: z3 exit 4.87 -> 3.82 s (-1.05 s, n=26 vs 9) and the 0-1.8 s thinking variance; familiar queries ~0 (they do not think). Same top candidates on 3 queries. Smallest change, biggest median win on less familiar queries. Blind spot: candidate quality on hard queries.
    2. Resolve on the finished answer, not process exit (stream-json `result` event, or end of the JSON array on stdout). -0.44 s [0.38-0.66] on EVERY query, no IPC/UI change. Note: never feed `--output-format json`/stream-json envelopes into parseCandidates (cerebrum) — parse the events.
    3. Stream the first candidate (stream-json + `--include-partial-messages`, incremental array parse, new IPC partial message + pong capability bump, CandidateSelect grows the list). First row visible at 3.32 s [2.25-4.17] vs exit 4.87 (-1.55 s, z3); familiar 2.21 vs 3.66 (-1.45 s); with #1: 2.29 s. Medium effort (IPC shape change, Zellij pane growth / filter hold interplay).
    4. Keep one pre-spawned `claude -p --input-format stream-json` warm in the daemon (spawn the next one after each use; prompt via stdin). Hides boot: -0.93 s [0.84-1.46]; measured write->result 2.07-2.67 s with `--effort low`. Side benefit: the prompt leaves argv (closes accepted risk T-08-02-07, `ps` disclosure); stdin write+close worked 6/6. Medium-high effort: lifecycle/idle cost, system prompt fixed at spawn (respawn when the installed-tools steering changes), auth expiry, crash handling.
    5. Faster model with thinking explicitly off: `--model haiku --settings '{"alwaysThinkingEnabled":false}'` -> exit 3.44 s median (n=4), first candidate 2.47 s (-1.4 s). Quality trade-off vs Opus 5.5. Warning: `--model haiku` alone or with `--effort low` = 10-41 s (it thinks for 1-5.6k tokens). `--model sonnet` gives no gain (4.22 s).
    6. Shorter output (e.g. cap explanations at ~12 words; generation is ~1.4 s for ~150-260 tokens at ~115 tok/s). est. -0.4-0.7 s; trades away explanation detail (core value). Matters less once #3 lands.
    7. API-key SDK path (already implemented; daemon keeps a warm keep-alive client): est. skips the ~1.37 s Claude Code lifecycle + the ~600-token Claude Code preamble; not measurable here (no key) and a billing change for a `/login` user. If pursued, fix the latent bug first: the daemon finds `.env.local` relative to its inherited cwd (spawnDaemon passes no cwd/env; today's daemon was spawned by Claude Desktop's env-resolution shell in `/`), so an API-key user with the key only in a project `.env.local` silently gets the CLI path.
    8. Prompt caching / smaller prompt: ~0. claude -p already reads 1,002 cached tokens per call; QueQue's ~400-token request is below every model's minimum cacheable prefix (1,024 for claude-sonnet-5, 512 Opus/Sonnet 5.5, 4,096 Haiku 4.5); prefill of ~1k tokens is not where the time goes (est.).
    Not worth it: client/IPC/render (~0.4 s total, 2-3 ms after arrival).
    Combined #1+#2+#3+#4: est. first candidate ~1.7-2.0 s after the keypress (0.4 client + ~1.0 time-to-headers + ~0.3 first candidate) vs ~5.3 s today; full list ~3 s.
- fix: not applied (diagnose-only session)
- verification: n/a (diagnose-only). Measurement scaffolding and raw JSONL results are in the session scratchpad (build-envelope.mjs, ipc-fetch.mjs, cli-probe.mjs, prespawn-probe.mjs, e2e-tmux.py, summarize.py; live-daemon/sdk-daemon/cli-stream/cli-text/cli-variants/fmt/prespawn/cross/e2e .jsonl).
- files_changed: []

## Specialist Review

- specialist_hint: typescript (typescript-expert review, read-only; `claude --help` on 2.1.285 checked, no live calls)
- verdict: LOOKS_GOOD. Fixes #1 (`--effort low`) and #2 (resolve on the stream-json `result` event) are the right first step. Both stay inside claude-cli.ts / claude-exec.ts with no IPC change. 2.1.285 `--help` lists `--effort <low|medium|high|xhigh|max>`, `--output-format stream-json` and `--include-partial-messages`.
- pitfalls to handle when applying:
  - `--verbose`: help text doesn't mention it, but earlier `-p` builds refused `--output-format stream-json` without it. Pass it, or confirm with one live call.
  - Write a new streaming spawn helper rather than bending `execFileAsync`. Read lines with `readline` (or utf8 encoding plus a carry-over buffer) so lines and multi-byte UTF-8 survive chunk splits. Skip non-JSON lines. Validate only the `type === 'result'` event with zod. Avoid `Buffer.concat` on every chunk; keep a running byte count instead.
  - Pass only `result.result` into parseCandidates. Its prose fallback (src/providers/claude.ts:73-75) would otherwise turn raw NDJSON or an error string ("Not logged in · Please run /login") into a command in the shell buffer. Check `is_error`/`subtype` first.
  - Keep the error contract. claude-default.ts classifies failures by `code`/`killed`/`signal` and runs `AUTH_FAILURE_RE` over stdout/stderr. On `is_error`, reject with an error carrying the result text and stderr (keep collecting stderr, with a size cap).
  - After the `result` event: resolve and clear the timer, let the child exit on its own, with a backup kill (`setTimeout(() => child.kill(), 2000).unref()`). Don't SIGTERM immediately, because that could cut off credential or telemetry writes. Keep a `settled` guard so the later `close` can't reject.
  - Cancellation: `LLMAdapter.fetchCandidates(envelope)` takes no AbortSignal, so Esc or a client disconnect leaves `claude` running (and billing) until the 25 s budget runs out. Add an optional `signal` and pass it to `spawn({ signal })`. #3 and #4 need it too.
- side notes:
  - `--bare` would cut boot time, but it reads only ANTHROPIC_API_KEY (never OAuth), so /login users can't use it.
  - For #4, `buildSystemPrompt(envelope)` (installed-tools steering) and `cwd: envelope.base.cwd` change per request. A warm process needs that context in the user turn, or a respawn when it changes.
  - `--effort low` quality evidence is 3 queries. Add a small regression set before making it the default; consider making it configurable.
