---
status: partial
phase: 08-zero-config-install-and-provider-detection
source: [08-VERIFICATION.md]
started: 2026-10-18T02:50:00Z
updated: 2026-10-19T07:30:21.662Z
---

## Current Test

[testing complete]

## Tests

### 1. DECISION: accept or reject the roadmap/locked-decision divergence for ROADMAP SC #2 ('Ollama running locally gets a working qq with zero extra steps') and the OPENAI_API_KEY half of SC #3
expected: Either add the suggested overrides (or amend ROADMAP.md SC #2/#3 and the Phase 8 goal line) to record that Ollama/OpenAI are one explicit `qq init provider` step by design (D-01, D-04, D-14), or reopen auto-detection as a gap
result: pass
note: "Accepted by design (option 1). ROADMAP.md Phase 8 goal, summary line, SC #2 and SC #3 amended 2026-10-19 to say Ollama/OpenAI take one `qq init provider` step (D-01, D-04, D-14)."

### 2. Live Claude /login: on macOS, with claude on PATH, logged in via `claude /login`, no ANTHROPIC_API_KEY, no provider.json, trigger ?? in zsh
expected: Ranked candidates within 25s, no provider question, and the debug log shows `provider selected {provider: claude, source: default}`
result: pass

### 3. Live Ollama pin (08-03 human-check): with `ollama list` showing a model, run `qq init provider`, press 3 then Enter, then trigger ?? in zsh
expected: Candidates appear. The debug log shows `provider selected {provider: ollama, source: pin}` and an `ollama request` line with model/status/durationMs only.
result: pass
note: "User wish: i wish there was a way to see the logs and see communication with ollama (recorded under Deferred Follow-Ups)"

### 4. Live OpenAI pin (08-04 human-check): export OPENAI_API_KEY in ~/.zshrc before the queque source line, open a new terminal, run `qq init provider`, pick 2, then trigger ??
expected: Candidates come from api.openai.com, and the debug log shows provider openai source pin. A bad key gives the static HTTP 401 copy with no key fragment.
result: skipped

### 5. Logged-out Claude hint (08-06 human-check): `claude /logout`, no ANTHROPIC_API_KEY, no provider.json, trigger ?? in zsh
expected: One QueQue line above the prompt naming `claude /login`, ANTHROPIC_API_KEY, and `qq init provider`. The typed query is restored in the buffer. If the real logged-out stdout does not match AUTH_FAILURE_RE, the neutral WR-01 copy appears instead, without the picker hint.
result: pass

### 6. Picker restarts the real daemon (08-05 human-check): with a daemon running, run `pnpm build && node dist/cli/main.js init provider` with QQ_PROVIDER_FILE set to a scratch absolute path, press Enter
expected: The Claude menu item is first, the pin file is -rw------- inside a 0700 directory, 'Restarted the QueQue daemon' is printed, and `lsof`/`ps` shows a new daemon pid with cwd = $HOME
result: pass

### 7. Under-60s end-to-end (08-05 human-check): claude logged out, no keys, Ollama running with one model. Trigger ?? (fails with the hint), run `qq init provider`, press 3, Enter, trigger ?? again
expected: Wall time from the failed ?? to candidates on screen is under 60 seconds
result: pass

### 8. unverified-prohibition, human review recommended (08-06, judgment tier): 'MUST NOT document runtime auto-detection as the provider selector or describe a Claude to OpenAI to Ollama fallthrough'
expected: Read docs/EXTENSIONS.md lines 16-45 and README.md lines 40-100 and confirm no auto-detection selector or vendor fallthrough is described
result: pass

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

## Deferred Follow-Ups

- test: 3
  idea: "i wish there was a way to see the logs and see communication with ollama"
  deferred_at: 2026-10-19
