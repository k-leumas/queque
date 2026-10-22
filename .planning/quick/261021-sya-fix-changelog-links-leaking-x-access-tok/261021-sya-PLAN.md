---
phase: quick-261021-sya
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/semantic-release-user-notes.ts
  - tests/semantic-release-user-notes.test.ts
  - CHANGELOG.md
  - .wolf/anatomy.md
  - .wolf/buglog.json
  - .wolf/memory.md
autonomous: true
requirements: [quick-261021-sya]

estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "generateNotes, given the CI repositoryUrl `https://x-access-token:<token>@github.com/k-leumas/queque.git`, writes a compare link `https://github.com/k-leumas/queque/compare/v0.5.0...v0.6.0` and commit links `https://github.com/k-leumas/queque/commit/<fullHash>`. The notes contain no `x-access-token` and no `@github.com`"
    - "normalizeRepositoryUrl returns `https://github.com/k-leumas/queque` for: credential userinfo (`https://x-access-token:[secure]@...`, `https://user:pw@...`), plain user userinfo (`https://someone@...`), `git+https://...git`, `git+https://user:pw@...git`, scp-like `git@github.com:k-leumas/queque.git`, `ssh://git@github.com/k-leumas/queque.git`, `ssh://git@github.com:22/...`, `git+ssh://git@github.com/...git`, and a trailing `/`. It leaves an already-clean URL unchanged and returns an empty string for an empty string (an empty result means generateNotes leaves the links out)"
    - "CHANGELOG.md contains zero `@github.com` links. All 78 lines that had credential links now point at `https://github.com/k-leumas/queque/...` (174 lines in total), and those 78 lines are the only lines that changed (`git diff --numstat` shows 78 added and 78 removed)"
    - "Unrelated work-tree changes stay out of the commits: README.md, screen-cap-filename.mov and .wolf/hooks/_session.json are never staged"
  artifacts:
    - path: "scripts/semantic-release-user-notes.ts"
      provides: "normalizeRepositoryUrl strips git+, credential/user info, ssh and scp-like forms, .git and a trailing slash"
      contains: "export function normalizeRepositoryUrl(url: string): string"
    - path: "tests/semantic-release-user-notes.test.ts"
      provides: "normalizeRepositoryUrl cases plus a generateNotes case that passes a credential repositoryUrl"
      contains: "x-access-token"
    - path: "CHANGELOG.md"
      provides: "Release history whose compare and commit links use https://github.com/k-leumas/queque"
  key_links:
    - from: "generateNotes (scripts/semantic-release-user-notes.ts ~line 357)"
      to: "normalizeRepositoryUrl"
      via: "context.options.repositoryUrl -> normalizeRepositoryUrl -> compareUrl and formatReleaseNotes({ repositoryUrl }) -> formatCommitLine"
      pattern: "normalizeRepositoryUrl\\(context\\.options"
---

<objective>
Stop semantic-release changelog links from carrying the CI repository URL's credentials, and repair the 78 links already broken in CHANGELOG.md.

Purpose: In CI, semantic-release passes an authenticated `repositoryUrl` (`https://x-access-token:<token>@github.com/k-leumas/queque.git`). `normalizeRepositoryUrl` only strips `git+` and `.git`, so every compare link and commit link in releases 0.6.0, 0.6.1 and 0.7.0 shows how the CI authenticates. GitHub masked the token as `[secure]`, which also makes every one of those links broken.
Output: A `normalizeRepositoryUrl` that strips credentials, with unit and generateNotes tests, plus a CHANGELOG.md with clean links.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@scripts/semantic-release-user-notes.ts
@tests/semantic-release-user-notes.test.ts

Key facts (verified at planning time, 2026-10-21):
- `normalizeRepositoryUrl` sits at scripts/semantic-release-user-notes.ts ~line 296-299 (JSDoc "Strips git+ and .git from a repository URL."). Its single caller is generateNotes at ~line 357, which builds `compareUrl` and passes `repositoryUrl` to formatReleaseNotes, which passes it to formatCommitLine (`.../commit/<fullHash>`). An empty `repositoryUrl` makes generateNotes leave the links out, and that behavior must stay.
- tests/semantic-release-user-notes.test.ts already imports `normalizeRepositoryUrl` and defines `const repo = 'https://github.com/k-leumas/queque'`. `describe('helpers')` (~line 171) has a single git+ case. `describe('generateNotes')` (~line 198) has a `baseContext` whose `options.repositoryUrl` is `${repo}.git`, commits with hashes `1111111aaaa` and `2222222bbbb`, lastRelease tag `v0.5.0`, nextRelease tag `v0.6.0`, and stubs `ANTHROPIC_API_KEY` with `vi.stubEnv`.
- CHANGELOG.md has 78 lines with `https://x-access-token:[secure]@github.com/k-leumas/queque/...` (one per line, in releases 0.7.0, 0.6.1 and 0.6.0) and 96 lines that already use `https://github.com/k-leumas/queque`.
- Git hooks (lefthook): pre-commit runs `tsc --noEmit` and `biome check --write` on staged files. commit-msg runs commitlint (config-conventional, header max 100 chars).
- The work tree has unrelated uncommitted changes (README.md, screen-cap-filename.mov, .wolf/*). Stage files by explicit path only. Never use `git add -A`, `git add .` or `git commit -a`.
- User rules: no Co-Authored-By trailer in commits. Run biome on changed files before staging. Fix by adding what is missing, never by deleting the surrounding logic.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Strip credentials and ssh forms in normalizeRepositoryUrl, proven end-to-end through generateNotes</name>
  <files>scripts/semantic-release-user-notes.ts, tests/semantic-release-user-notes.test.ts</files>
  <behavior>
    In `describe('helpers')`, keep the existing git+ case and add cases where each input must equal `repo` (`https://github.com/k-leumas/queque`):
    - `https://x-access-token:[secure]@github.com/k-leumas/queque` (the masked value that is in CHANGELOG.md today)
    - `https://x-access-token:ghs_abc123@github.com/k-leumas/queque.git` (the real CI shape)
    - `https://someone@github.com/k-leumas/queque` (plain user, no password)
    - `git+https://user:pw@github.com/k-leumas/queque.git`
    - `git@github.com:k-leumas/queque.git` (scp-like)
    - `ssh://git@github.com/k-leumas/queque.git`
    - `ssh://git@github.com:22/k-leumas/queque.git`
    - `git+ssh://git@github.com/k-leumas/queque.git`
    - `https://github.com/k-leumas/queque/` (trailing slash)
    - `repo` itself (an already-clean URL comes back unchanged)
    Separately, `normalizeRepositoryUrl('')` returns `''`.
    In `describe('generateNotes')`, add one case: stub `ANTHROPIC_API_KEY` as `''`, spread `baseContext` with `options: { repositoryUrl: 'https://x-access-token:ghs_abc123@github.com/k-leumas/queque.git' }`, then assert the notes contain `# [0.6.0](https://github.com/k-leumas/queque/compare/v0.5.0...v0.6.0)` and `https://github.com/k-leumas/queque/commit/1111111aaaa`, and contain neither `x-access-token` nor `@github.com`.
  </behavior>
  <action>
    RED: add the behavior cases above to tests/semantic-release-user-notes.test.ts. Group the normalizeRepositoryUrl cases in one `it.each` table (or several `it` blocks) inside `describe('helpers')`, and put the generateNotes case inside the existing `describe('generateNotes')`, reusing `baseContext` and `repo`. Run `pnpm exec vitest run tests/semantic-release-user-notes.test.ts` and confirm the new userinfo and ssh cases FAIL while every existing case still passes.

    GREEN: rewrite `normalizeRepositoryUrl` in scripts/semantic-release-user-notes.ts. Keep the exported signature `normalizeRepositoryUrl(url: string): string` and its single caller unchanged. Build it from plain string and regex replacements, applied in this order:
    (1) trim the input;
    (2) remove a leading `git+`;
    (3) if the value has no `://` and matches the scp-like shape `user@host:owner/repo`, rewrite it to `https://host/owner/repo`;
    (4) rewrite an `ssh://` or `git://` scheme to `https://`, remember that it was converted, and drop a `:<digits>` port right after the host only for converted URLs (an https URL keeps an explicit port, for example GitHub Enterprise);
    (5) remove all user info after `://`, meaning everything from `://` up to and including the LAST `@` that comes before the first `/` of the path. A pattern like `^([a-z][a-z0-9+.-]*://)[^/]*@` replaced by the scheme group does this, because the greedy `[^/]*` reaches the last at-sign before the path;
    (6) remove a trailing `.git`;
    (7) remove a trailing `/`.
    Do NOT use `new URL()`. It throws on the scp-like form and percent-encodes odd user info. Regex passthrough keeps the empty string as `''` and returns any non-URL input unchanged instead of throwing during a release.
    Update the JSDoc to one line saying it returns a public https base URL: git+ removed, user info and credentials removed, ssh and scp-like forms converted to https, .git and trailing slash removed.

    After GREEN, run biome on the two changed files and fix any findings. Commit only these two files (stage them by path) with a conventional header of at most 100 characters, for example `fix(release): strip credentials from changelog repository links`. Do not add a Co-Authored-By trailer.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/semantic-release-user-notes.test.ts && pnpm exec tsc --noEmit && pnpm exec biome check scripts/semantic-release-user-notes.ts tests/semantic-release-user-notes.test.ts</automated>
  </verify>
  <done>Every new normalizeRepositoryUrl case and the credential generateNotes case pass, and every existing test in the file still passes. tsc and biome are clean. One commit contains exactly scripts/semantic-release-user-notes.ts and tests/semantic-release-user-notes.test.ts: `git show --stat "$(git log -1 --format=%H -- scripts/semantic-release-user-notes.ts)"` lists only those two.</done>
</task>

<task type="auto">
  <name>Task 2: Rewrite the 78 credential links in CHANGELOG.md to the public repository URL</name>
  <files>CHANGELOG.md, .wolf/anatomy.md, .wolf/buglog.json, .wolf/memory.md</files>
  <action>
    Before editing, record the baseline: the number of lines with `x-access-token` in CHANGELOG.md should be 78, and the number of lines with `https://github.com/k-leumas/queque` should be 96.

    Rewrite the links with one portable in-place substitution that works with both BSD sed (macOS) and GNU sed: `sed -E -i.bak 's#https://[^/@ )]+@github\.com/#https://github.com/#g' CHANGELOG.md && rm -f CHANGELOG.md.bak`. The `-f` is needed because the user's shell aliases `rm` to `rm -i`, which would otherwise stop and prompt. This substitution was dry-run at planning time and gave 0 / 174 / 78-78. It removes whatever user info sits between `https://` and the GitHub host. Touch nothing else in the file: no reformatting, no reordering, and leave the stray mid-file `# Changelog` heading where it is (out of scope).

    Check the result: the line count with `https://github.com/k-leumas/queque` is now 174, and `git diff --numstat -- CHANGELOG.md` prints `78	78	CHANGELOG.md`.

    OpenWolf bookkeeping, following project convention:
    - append a buglog entry to .wolf/buglog.json. error_message: changelog compare and commit links carried the CI x-access-token user info. root_cause: normalizeRepositoryUrl only stripped git+ and .git. fix: strip user info and ssh/scp forms, and rewrite the 78 existing links. tags: release, changelog, semantic-release, security;
    - append one line to .wolf/memory.md;
    - refresh the tests/semantic-release-user-notes.test.ts description in .wolf/anatomy.md so it mentions the repository-URL normalization cases.

    Stage CHANGELOG.md, .wolf/anatomy.md, .wolf/buglog.json and .wolf/memory.md by explicit path. Do NOT stage README.md, screen-cap-filename.mov or .wolf/hooks/_session.json. Run `git diff --cached --name-only` and confirm it lists exactly those four files. Commit with a conventional header of at most 100 characters, for example `docs(changelog): drop credential user info from release links`. Do not add a Co-Authored-By trailer.
  </action>
  <verify>
    <automated>C=$(git log -1 --format=%H -- CHANGELOG.md) && test "$(grep -c '@github.com' CHANGELOG.md)" -eq 0 && grep -q 'https://github.com/k-leumas/queque/compare/v0.6.1...v0.7.0' CHANGELOG.md && N=$(git diff --numstat "$C^" "$C" -- CHANGELOG.md) && test "$(printf '%s' "$N" | cut -f1,2)" = "$(printf '78\t78')" && F=$(git show --name-only --format= "$C") && ! printf '%s\n' "$F" | grep -qE '^(README\.md|screen-cap-filename\.mov)$'</automated>
  </verify>
  <done>CHANGELOG.md has zero `@github.com` matches and 174 lines with `https://github.com/k-leumas/queque`. The commit changes exactly 78 lines of CHANGELOG.md plus the three .wolf files. README.md and screen-cap-filename.mov are still unstaged in the work tree (`git status --short` still shows them).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CI semantic-release to public release artifacts | The authenticated `repositoryUrl` (GitHub App / GITHUB_TOKEN user info) enters generateNotes. Its output is published to CHANGELOG.md, the `chore(release)` commit body and the GitHub release body |
| Repository history to public readers | CHANGELOG.md is public. Any user info written into it stays visible |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261021-sya-01 | Information disclosure | normalizeRepositoryUrl / generateNotes | high | mitigate | Remove all user info (through the last at-sign before the path) for every scheme, including git+ and ssh forms that become https, before any link is built. The Task 1 generateNotes test passes a token-shaped `ghs_abc123` credential URL and asserts the notes contain neither `x-access-token` nor `@github.com` |
| T-261021-sya-02 | Information disclosure | CHANGELOG.md (releases 0.6.0, 0.6.1, 0.7.0) | medium | mitigate | Task 2 rewrites all 78 links. The automated gate requires zero `@github.com` matches. GitHub had already masked the token as `[secure]`, so no live secret was exposed, only the shape of the CI authentication |
| T-261021-sya-03 | Tampering | normalizeRepositoryUrl regex input | low | accept | Input comes only from semantic-release's own repositoryUrl (package.json or CI env), not from untrusted users. Regex passthrough never throws, so a malformed value cannot fail a release |
| T-261021-sya-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no packages. Only existing devDependencies (vitest, biome, tsc) are used |
</threat_model>

<verification>
From the repo root, after both tasks:
- `pnpm exec vitest run tests/semantic-release-user-notes.test.ts` passes.
- `pnpm exec tsc --noEmit` passes.
- `grep -c '@github.com' CHANGELOG.md` prints 0.
- `git log --oneline -- scripts/semantic-release-user-notes.ts CHANGELOG.md` shows the two new commits at the top, and `git status --short` still lists README.md and screen-cap-filename.mov as uncommitted.
</verification>

<success_criteria>
- Future releases cut in CI get compare and commit links on `https://github.com/k-leumas/queque` with no user info. The generateNotes test proves this.
- The existing CHANGELOG.md links resolve: 78 links rewritten, nothing else changed.
- Exactly two commits, each holding only the files listed for its task.
</success_criteria>

<output>
Create `.planning/quick/261021-sya-fix-changelog-links-leaking-x-access-tok/261021-sya-SUMMARY.md` when done
</output>
