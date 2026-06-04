---
slug: isDirectRun-symlink-regression
created: 2026-06-04
status: in-progress
---

# Quick Task: isDirectRun Symlink Regression Tests

Add regression tests for bug-159 (commit a46d7a5 / 319b4231): `isDirectRun` in
`src/cli/main.ts` used a bare `process.argv[1]` path that never matched
`import.meta.url` when invoked via a Homebrew symlink, causing `main()` to never
be called in production.

## Fix (already applied)

```diff
- ? import.meta.url === new URL(`file://${process.argv[1]}`).href
+ ? import.meta.url === new URL(`file://${fs.realpathSync(process.argv[1])}`).href
```

## Tests to add

File: `tests/main-direct-run.test.ts`

1. `returns true when argv[1] equals the real path` — dev / npm-global scenario
2. `returns false without realpathSync when argv[1] is a symlink` — documents pre-fix failure
3. `returns true with realpathSync resolving symlink to real path` — the fix
4. `returns false when argv[1] is undefined` — guard branch
5. `matches src/cli/main.ts URL format` — URL construction sanity check
