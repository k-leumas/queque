# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## vitest-4-1-client-result-tests — vitest 4.1 builtin vi.mock leaks into the test file's own imports
- **Date:** 2026-11-21
- **Error patterns:** No "mkdtempSync" export is defined on the "node:fs" mock, vitest upgrade, vi.mock node:fs, strict mock factory, tests fail in 0-7 ms during beforeEach, client-result, FIFO/ShellResult contract tests
- **Root cause(s):** vitest 4.1 applies a file-level builtin `vi.mock('node:fs', factory)` to the test file's own `import * as fs from 'node:fs'` (4.0.4 only replaced it for code under test); tests/client-result.test.ts relied on the old scoping for real-fs harness work, so 57/64 tests threw in setup
- **Fix:** replace the static import with `const fs = await vi.importActual<typeof import('node:fs')>('node:fs')` after the strict mock; code under test keeps the identical mock, no assertions changed (f9076b7, merged via PR #8 as 439ac25)
- **Files changed:** tests/client-result.test.ts, .wolf/buglog.json (bug-565), .wolf/cerebrum.md, .wolf/anatomy.md, .wolf/memory.md
- **Why not caught:** the dependency-bump CI gate did catch it before merge; the latent harness reliance on undocumented mock scoping had no gate (no rule against a test file both mocking a builtin and importing it for real use)
- **Recurrence guard:** explanatory comment at the importActual binding in tests/client-result.test.ts; cerebrum Do-Not-Repeat entry (test harness that mocks a builtin must take the real module via vi.importActual); this KB pattern for future vitest upgrades
---

