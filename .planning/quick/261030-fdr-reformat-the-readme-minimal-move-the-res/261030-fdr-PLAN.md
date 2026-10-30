---
phase: quick-261030-fdr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - CONTRIBUTING.md
  - docs/PROVIDERS.md
  - docs/INSTALL.md
  - docs/USAGE.md
  - docs/CONFIGURATION.md
  - docs/PRIVACY.md
  - docs/SYSTEM_DESIGN.md
  - tests/docs-links.test.ts
  - .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs
  - .wolf/anatomy.md
  - .wolf/memory.md
  - .wolf/cerebrum.md
autonomous: true
requirements: [quick-261030-fdr]

estimate:
  tokens: 60000
  raw_tokens: 60000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A new user who opens README.md on GitHub or npmjs.com sees, in order: the H1, the unchanged badge block, the two-line Before/Now pitch, the demo gif, Install (Homebrew first, npm second, both followed by `qq init zsh && source ~/.zshrc` and the warning not to redirect its output into ~/.zshrc), a short Choose a provider step, a short Usage step (type intent, `??`, pick, Enter, Esc cancels), and a More list linking every peripheral doc. The README is at most 75 lines and says the 'copy-pasting ... is dead' tagline once, in the H1"
    - "Every line of the old README (commit b45f6db) still exists, verbatim apart from link targets and heading level, in README.md or one of docs/INSTALL.md, docs/PROVIDERS.md, docs/USAGE.md, docs/PRIVACY.md, docs/CONFIGURATION.md. The only lines dropped are six decorative or duplicate ones named in Task 3"
    - "Every relative link and every #anchor in README.md, CONTRIBUTING.md and docs/*.md resolves to an existing file and heading. tests/docs-links.test.ts fails `pnpm test:run` if one breaks"
    - "README.md links to repo docs only through absolute https://github.com/k-leumas/queque/blob/main/... URLs, because the npm package ships README.md without docs/ (package.json `files` is unchanged), so the links also work on npmjs.com"
    - "CONTRIBUTING.md's Claude Provider section links to docs/PROVIDERS.md#claude-default and docs/PROVIDERS.md#after-changing-your-key-or-settings instead of README anchors (one of which, #authentication, was already broken)"
    - "docs/PRIVACY.md also covers the opt-in anonymous telemetry (`qq telemetry`), and every telemetry claim matches the source files named in Task 3"
    - "tests/readme-badges.test.ts still passes: the badge block stays byte-identical directly under the H1"
  artifacts:
    - path: "README.md"
      provides: "Minimal new-user README: H1, badges, pitch, demo gif, Install, Choose a provider, Usage, More"
      contains: "blob/main/docs/PROVIDERS.md"
    - path: "docs/INSTALL.md"
      provides: "Homebrew install, npm install with Requirements, the `qq init zsh` note"
      contains: "Node.js 24 or newer"
    - path: "docs/PROVIDERS.md"
      provides: "The old Choose a provider section verbatim: Claude (default), OpenAI or Ollama (beta), After changing your key or settings"
      contains: "## After changing your key or settings"
    - path: "docs/USAGE.md"
      provides: "The old Usage section verbatim, with Installed-tool awareness and Inside Zellij"
      contains: "## Installed-tool awareness"
    - path: "docs/PRIVACY.md"
      provides: "The old Privacy defaults section verbatim plus an Anonymous telemetry section"
      contains: "qq telemetry"
    - path: "docs/CONFIGURATION.md"
      provides: "The old Configuration reference table verbatim"
      contains: "privacy.redactLogKeys"
    - path: "tests/docs-links.test.ts"
      provides: "Offline guard: relative links and anchors in README.md, CONTRIBUTING.md and docs/*.md resolve; README uses absolute GitHub URLs for docs and links each peripheral doc"
      contains: "blob/main/"
    - path: ".planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs"
      provides: "One-off preservation check: every old README line (git show b45f6db:README.md) exists in the new README + docs set"
      contains: "b45f6db"
  key_links:
    - from: "README.md (More list, Install, Choose a provider)"
      to: "docs/INSTALL.md, docs/PROVIDERS.md, docs/USAGE.md, docs/PRIVACY.md, docs/CONFIGURATION.md"
      via: "absolute https://github.com/k-leumas/queque/blob/main/docs/<FILE>.md links; tests/docs-links.test.ts maps them back to local files and anchors"
      pattern: "github.com/k-leumas/queque/blob/main/docs/"
    - from: "CONTRIBUTING.md (Claude Provider section)"
      to: "docs/PROVIDERS.md headings Claude (default) and After changing your key or settings"
      via: "relative links docs/PROVIDERS.md#claude-default and docs/PROVIDERS.md#after-changing-your-key-or-settings"
      pattern: "docs/PROVIDERS.md#"
    - from: "docs/CONFIGURATION.md (effort row, daemon restart link)"
      to: "docs/PROVIDERS.md#after-changing-your-key-or-settings"
      via: "docs-relative link"
      pattern: "PROVIDERS.md#after-changing-your-key-or-settings"
    - from: "docs/PRIVACY.md (catalog names bullet)"
      to: "docs/USAGE.md#installed-tool-awareness"
      via: "docs-relative link"
      pattern: "USAGE.md#installed-tool-awareness"
---

<objective>
Reformat README.md so a new user sees only what they need to install QueQue and get a first command, in a clean minimal layout. Everything else moves, verbatim, into peripheral docs under docs/ that the README links to.

Final README shape (top to bottom): the H1 `# QueQue — copy-pasting shell commands is dead`, the existing badge block byte-identical, the **Before:**/**Now:** pitch, the demo gif, `## Install`, `## Choose a provider`, `## Usage`, `## More`.

New docs files: docs/INSTALL.md (Homebrew, npm, Requirements, the init note), docs/PROVIDERS.md (the whole old Choose a provider section), docs/USAGE.md (the old Usage section with Installed-tool awareness and Inside Zellij), docs/PRIVACY.md (the old Privacy defaults section, plus telemetry), docs/CONFIGURATION.md (the old Configuration reference).

Decisions (planner discretion, the orchestrator's guidance is not locked):
- Links from README.md to repo docs are absolute `https://github.com/k-leumas/queque/blob/main/<path>` URLs. package.json `files` ships README.md but not docs/, and npmjs.com renders the README, so relative links to docs/ are not reliable there. package.json stays unchanged. Links between files inside docs/ and from CONTRIBUTING.md stay relative, because those files are only read on GitHub. The demo gif keeps its existing relative `assets/demo.gif` path (unchanged; out of scope).
- Content moves verbatim. Only link targets change, and `###` subsections become `##` in their new page. Facts are never dropped or reworded in the docs files; the README's short steps restate facts from the old README without adding new ones.
- docs/PRIVACY.md gains an Anonymous telemetry section. The old README never mentioned telemetry, but `qq telemetry` shipped in phase 10, and a privacy page that lists what leaves the machine is incomplete without it. Each claim must be confirmed in source.
- The duplicate tagline (an H4 under the Now line repeating the H1) and the "Welcome to the future" line around the inline brew command are dropped; the brew command moves into the Install code block.
- A permanent vitest guard (tests/docs-links.test.ts) checks links and anchors, because this task moves every anchor the repo links to. A one-off preservation script in the quick-task directory proves no old README line was lost.
- Pre-existing broken relative links in docs/SYSTEM_DESIGN.md (six source links missing `../`) are fixed, so the guard can scan all of docs/.

Purpose: a first-time visitor reaches a working `??` in under a minute of reading; detail stays one click away.

Output: the reshaped README.md, five new docs files, fixed CONTRIBUTING.md and docs/SYSTEM_DESIGN.md links, tests/docs-links.test.ts, and the preservation script. Three commits (one per task), no push.

Time: Task 1 about 10 min, Task 2 about 8 min, Task 3 about 12 min; about 30 min total. Each targeted vitest run takes under 10 s; `pnpm exec tsc --noEmit` about 20 s.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@README.md
@CONTRIBUTING.md
@tests/readme-badges.test.ts

Facts gathered while planning (re-check with grep, do not re-derive):
- Base commit for the old README: b45f6db (HEAD when this plan was written). `git show b45f6db:README.md` is the reference copy.
- package.json `files` is `dist`, `shell`, `README.md`, `LICENSE`. docs/ is not shipped.
- References into README anchors found repo-wide (src, shell, scripts, tests, docs, .github, CONTRIBUTING.md): only CONTRIBUTING.md line 118, two links, `README.md#authentication` (already broken; no such heading exists) and `README.md#after-changing-your-key-or-settings`. No src/, shell/ or scripts/ message names a README section.
- Old README in-file anchor links: the Requirements bullet links the Choose a provider heading; the Privacy catalog bullet links Installed-tool awareness; the Configuration table's `effort` row links After changing your key or settings. The README also links docs/config.example.json (twice), docs/EXTENSIONS.md and docs/SYSTEM_DESIGN.md relatively.
- docs/SYSTEM_DESIGN.md lines 94, 124, 125, 195, 196, 197 link `shell/zsh/queque.zsh`, `src/client/run-foreground.ts`, `src/client/result-writer.ts`, `src/daemon/bootstrap.ts`, `src/daemon/server.ts`, `src/daemon/fetch-client.ts` relative to docs/, where they do not exist. All six exist at the repo root.
- tests/readme-badges.test.ts parses badges from README.md; it does not check position, but the badge block must stay directly under the H1, byte-identical.
- commitlint: `@commitlint/config-conventional` (header max 100, subject must start lowercase, body lines max 100). lefthook pre-commit runs `tsc --noEmit` and `biome check --write` on staged js/ts/json/yml. Biome ignores .planning and .wolf and does not lint markdown.
- OpenWolf's post-Edit/Write hook rewrites the edited file's .wolf/anatomy.md line and appends an `auto-detected` entry to .wolf/buglog.json. Restore curated anatomy lines and drop those auto entries before each commit (cerebrum).
- The working tree has an untracked `screen-cap-filename.mov`. Never stage it: always `git add` explicit paths.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Link guard test (red), then move Choose a provider to docs/PROVIDERS.md end to end (green), commit</name>
  <files>tests/docs-links.test.ts, docs/PROVIDERS.md, README.md, CONTRIBUTING.md, docs/SYSTEM_DESIGN.md</files>
  <read_first>
    - README.md (whole file; the Choose a provider section runs from its H2 to the line before `## Usage`)
    - tests/readme-badges.test.ts (style to mirror: `resolve(__dirname, '..')`, node:fs, descriptive expect messages)
    - CONTRIBUTING.md line 118
    - docs/SYSTEM_DESIGN.md lines 94, 124-125, 195-197
  </read_first>
  <behavior>
    - Scans README.md, CONTRIBUTING.md and every docs/*.md. Lines inside fenced code blocks are ignored, and inline code spans are removed from each line before links are extracted.
    - Extracts every markdown link and image target from `[text](target)` and `![alt](target)`.
    - A target starting with `https://github.com/k-leumas/queque/blob/main/` maps to the local path after that prefix: the file must exist, and a `#anchor` must match a heading slug in that file.
    - Any other http, https or mailto target is skipped.
    - A bare `#anchor` must match a heading slug in the same file.
    - Any other target is a path relative to the scanning file's directory (URL-decoded, anchor stripped): it must exist, and a `#anchor` must match a heading slug of that markdown file.
    - Heading slugs follow GitHub: headings outside code fences, markdown link syntax reduced to its text, lowercased, every character that is not a letter, mark, number, connector punctuation, hyphen or space removed, spaces turned into hyphens, and repeated slugs suffixed -1, -2 in order. Examples: `## Claude (default)` gives `claude-default`, `### OpenAI or Ollama (beta)` gives `openai-or-ollama-beta`, `### Phase 7 — Local learning` gives `phase-7--local-learning`.
    - README rule: a README link target that is not http(s), not a bare `#anchor` and does not start with `assets/` fails, with a message saying README.md ships alone in the npm package, so docs must be linked with `https://github.com/k-leumas/queque/blob/main/<path>`.
    - README index rule: for each name in a REQUIRED_DOCS constant, README.md must contain at least one link whose target, with any `#anchor` removed, equals `https://github.com/k-leumas/queque/blob/main/docs/<name>`. In this task REQUIRED_DOCS is `['PROVIDERS.md']`; Tasks 2 and 3 extend it.
    - Each failure message names the file, the target and what to fix.
  </behavior>
  <action>
RED: create tests/docs-links.test.ts implementing the behavior above in the style of tests/readme-badges.test.ts (vitest describe/it, node:fs, node:path, a ROOT constant from `resolve(__dirname, '..')`, a REPO_BLOB constant `https://github.com/k-leumas/queque/blob/main/`). Write the slug function and link extractor as small named helpers; no new dependencies. Run `pnpm exec vitest run tests/docs-links.test.ts` and confirm it fails for the real reasons: CONTRIBUTING.md's two README anchor links (one heading does not exist), the six docs/SYSTEM_DESIGN.md source links, the README's relative docs/ links, and the missing PROVIDERS.md link. If it passes, the test is wrong; fix the test.

GREEN, in this order:
1. Create docs/PROVIDERS.md. First line `# Choose a provider`, then a blank line and `[Back to README](../README.md)`, then the old README's Choose a provider section body copied verbatim (the intro paragraph through the end of the restart code block before `## Usage`). Promote the three `###` subsections to `##`: `## Claude (default)`, `## OpenAI or Ollama (beta)`, `## After changing your key or settings`. Copy every paragraph, list item, quote and code block byte-for-byte, including the blank line between the two bullet lists in the last subsection.
2. In README.md replace that whole section with a short `## Choose a provider` step that restates only old-README facts in at most four lines: Claude is the default; if you already use Claude Code (signed in with `claude /login`) or have an Anthropic API key (`ANTHROPIC_API_KEY`), there is nothing to set up; to use OpenAI or a local Ollama model instead (both in beta), run `qq init provider`; then a link with text `Choose a provider` to `https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md` for keys, models and restarting the daemon.
3. Repoint the README links that pointed into the moved section: the Requirements bullet's link (keep link text `Choose a provider`) to `https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md`, and the Configuration table's `daemon restart` link to `https://github.com/k-leumas/queque/blob/main/docs/PROVIDERS.md#after-changing-your-key-or-settings`.
4. Make the README's remaining relative repo links absolute, keeping their link text: both `docs/config.example.json` links, `docs/EXTENSIONS.md` and `docs/SYSTEM_DESIGN.md` become `https://github.com/k-leumas/queque/blob/main/docs/...`. These sections move in Tasks 2 and 3; until then the README must still work on npmjs.com.
5. Add `## More` as the last README section with one bullet: the `Choose a provider` link to the absolute PROVIDERS.md URL plus a short description (Claude Code login, API keys, OpenAI and Ollama (beta), restarting the daemon).
6. CONTRIBUTING.md line 118: change the target `README.md#authentication` to `docs/PROVIDERS.md#claude-default` and `README.md#after-changing-your-key-or-settings` to `docs/PROVIDERS.md#after-changing-your-key-or-settings`. Keep the link texts and the rest of the line unchanged.
7. docs/SYSTEM_DESIGN.md: prefix the six source-file link targets with `../` (link text unchanged).
Do not touch the H1 or the badge block.

Run `pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts` until green. Run `pnpm exec biome check tests/docs-links.test.ts` and `pnpm exec tsc --noEmit`; fix any finding in the test file.

Bookkeeping and commit: add .wolf/anatomy.md entries for docs/PROVIDERS.md and tests/docs-links.test.ts (in their directory sections, matching neighbouring format), update the README.md description, restore any curated line the hook rewrote, drop hook-added `auto-detected` entries from .wolf/buglog.json, and append one line to .wolf/memory.md. Then `git add` exactly tests/docs-links.test.ts docs/PROVIDERS.md README.md CONTRIBUTING.md docs/SYSTEM_DESIGN.md .wolf/anatomy.md .wolf/memory.md (plus .wolf/buglog.json only if it has a real change) and commit with `docs(readme): move provider setup into docs/PROVIDERS.md` and a short body (lines at most 100 chars) that mentions the new link guard and the CONTRIBUTING and SYSTEM_DESIGN link fixes. No Co-Authored-By trailer (user rule). Never `--no-verify`. If a hook fails, fix the cause and make a new commit attempt.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts && grep -F -q 'QueQue talks to Claude in one of two ways. You only need one.' docs/PROVIDERS.md && grep -F -q '## After changing your key or settings' docs/PROVIDERS.md && grep -F -q 'docs/PROVIDERS.md#claude-default' CONTRIBUTING.md && grep -F -q 'blob/main/docs/PROVIDERS.md' README.md && pnpm exec biome check tests/docs-links.test.ts</automated>
  </verify>
  <done>The link guard failed for the four real reasons before the move and passes after it. docs/PROVIDERS.md holds the old section verbatim with `##` subsections. README.md has the short Choose a provider step and a More list, and none of its links are relative except `assets/demo.gif`. CONTRIBUTING.md and docs/SYSTEM_DESIGN.md links resolve. Badge test green. One commit landed with the .wolf files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Move Install, Usage and Configuration into docs/ and give the README its Install and Usage steps, commit</name>
  <files>docs/INSTALL.md, docs/USAGE.md, docs/CONFIGURATION.md, README.md, tests/docs-links.test.ts</files>
  <read_first>
    - README.md (as left by Task 1)
    - docs/PROVIDERS.md (heading names, for links)
  </read_first>
  <behavior>
    - REQUIRED_DOCS in tests/docs-links.test.ts becomes `['INSTALL.md', 'PROVIDERS.md', 'USAGE.md', 'CONFIGURATION.md']`. Before the README edits it fails, naming the three missing links; after them it passes.
  </behavior>
  <action>
RED: extend REQUIRED_DOCS as in the behavior block, run `pnpm exec vitest run tests/docs-links.test.ts`, and confirm it fails only on the three missing README links.

GREEN:
1. Create docs/INSTALL.md: `# Install`, blank line, `[Back to README](../README.md)`, then `## Homebrew` with a shell code block holding `brew install k-leumas/tap/queque` followed by `qq init zsh && source ~/.zshrc`; then `## Install via npm` (the old details summary text) holding `### Requirements` with the four old bullets verbatim (the provider bullet's link text stays `Choose a provider`, target `PROVIDERS.md`) and the old npm code block verbatim; then `## Set up zsh` holding the old NOTE body verbatim, as a GitHub note block (`> [!NOTE]` and then the `> After install, run ...` line).
2. Create docs/USAGE.md: `# Usage`, blank line, `[Back to README](../README.md)`, then the old Usage section body verbatim from its first sentence through the end of the Inside Zellij subsection, with `### Installed-tool awareness` and `### Inside Zellij` promoted to `##`.
3. Create docs/CONFIGURATION.md: `# Configuration reference`, blank line, `[Back to README](../README.md)`, then the old Configuration reference body verbatim: the Copy sentence (link text `docs/config.example.json`, target `config.example.json`), the full field table (the `daemon restart` target becomes `PROVIDERS.md#after-changing-your-key-or-settings`), and the closing System design sentence (link text `docs/SYSTEM_DESIGN.md`, target `SYSTEM_DESIGN.md`). Keep every escaped pipe in the table cells exactly.
4. Reshape the top of README.md. Keep the H1, the badge block, and the **Before:** and **Now:** lines as they are. Delete the H4 line right under the Now line that repeats the H1 tagline, and the "Welcome to the future" line together with its backtick-wrapped brew line. Keep `![QueQue demo](assets/demo.gif)`. Replace the old NOTE block and the whole npm details block with `## Install`: a shell code block with `brew install k-leumas/tap/queque` and `qq init zsh && source ~/.zshrc`; one sentence saying `qq init zsh` wires up the `??` keybinding and adds the QueQue source line to the end of `~/.zshrc` itself, so do not redirect its output into the file; one line "Or with npm (needs zsh, Node.js 24 or newer and jq):" followed by a shell code block with `npm install -g @k-leumas/queque-cli` and `qq init zsh && source ~/.zshrc`; and a link with text `Install` to `https://github.com/k-leumas/queque/blob/main/docs/INSTALL.md` for the full requirements.
5. Replace the README's Usage section (through the end of Inside Zellij) with a short `## Usage`: the old first sentence and its three-example code block verbatim, then at most three sentences restating old facts: a picker opens in the terminal; move with the arrow keys and press `Enter`; the command lands in your buffer exactly as shown, ready to run or edit, and QueQue never runs it for you; `Esc` cancels and restores what you typed. End with a link with text `Usage` to the absolute docs/USAGE.md URL (filtering, destructive-command warnings, installed-tool awareness, Zellij).
6. Replace the README's Configuration reference section with nothing (it now lives in docs/CONFIGURATION.md).
7. The Privacy section stays in README.md until Task 3. Repoint its Installed-tool awareness link to `https://github.com/k-leumas/queque/blob/main/docs/USAGE.md#installed-tool-awareness` (link text unchanged).
8. Extend `## More` so it lists, in this order: Install (requirements, Homebrew and npm), Choose a provider, Usage (the picker, installed-tool awareness, Zellij), Configuration (link text `Configuration`, target the absolute docs/CONFIGURATION.md URL; the config.json fields). All targets absolute.
Section order in README.md is now: H1, badges, Before/Now, gif, Install, Choose a provider, Usage, Privacy defaults, More.

Run `pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts` until green, then `pnpm exec biome check tests/docs-links.test.ts`.

Bookkeeping and commit as in Task 1: anatomy entries for docs/INSTALL.md, docs/USAGE.md and docs/CONFIGURATION.md, refreshed README.md and tests/docs-links.test.ts descriptions, hook damage repaired, one .wolf/memory.md line. `git add` exactly the five task files plus the changed .wolf files, commit `docs(readme): move install, usage and config details into docs/` with a short wrapped body. No trailer, no `--no-verify`.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts && grep -F -q 'QQ_PANE_HEIGHT' docs/USAGE.md && grep -F -q 'privacy.redactLogKeys' docs/CONFIGURATION.md && grep -F -q 'jqlang.github.io/jq' docs/INSTALL.md && grep -F -q 'brew install k-leumas/tap/queque' README.md && test "$(grep -c -F 'QQ_PANE_WIDTH' README.md)" = 0 && test "$(grep -c -F 'sensitivePathPatterns' README.md)" = 0 && test "$(grep -c -i 'copy-pasting' README.md)" = 1</automated>
  </verify>
  <done>docs/INSTALL.md, docs/USAGE.md and docs/CONFIGURATION.md hold their old sections verbatim. README.md opens with the H1, badges, pitch, gif and an Install section with brew first, then npm. The tagline appears once. Usage is a short step. The config table and the Zellij and tool-awareness detail are gone from the README. Link guard and badge test green. One commit landed with the .wolf files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Move Privacy into docs/PRIVACY.md with a telemetry section, finish the More index, prove nothing was lost, commit</name>
  <files>docs/PRIVACY.md, README.md, tests/docs-links.test.ts, .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs, .wolf/cerebrum.md</files>
  <precondition>`git cat-file -e b45f6db:README.md` succeeds (the base README is reachable).</precondition>
  <read_first>
    - README.md (as left by Task 2)
    - src/client/telemetry-consent.ts (prompt text and when it is shown)
    - src/shared/telemetry-config.ts (`telemetryBlockedBy`, where the choice and the install id are stored)
    - src/cli/commands/telemetry.ts (`qq telemetry status|on|off|show` output)
    - src/client/telemetry-events.ts and src/daemon/telemetry-buffer.ts (event families and their fields, flush and drop behavior)
    - src/shared/telemetry-endpoint.ts (host, empty-key behavior)
    - .planning/phases/10-linux-distro-ci-harness-and-anonymous-telemetry/10-CONTEXT.md decisions D-05 to D-12 and D-22 (intent only; source wins on any difference)
  </read_first>
  <behavior>
    - REQUIRED_DOCS becomes `['INSTALL.md', 'PROVIDERS.md', 'USAGE.md', 'PRIVACY.md', 'CONFIGURATION.md']`; it fails before the README's More list links PRIVACY.md and passes after.
    - check-readme-moved.mjs exits 0 only when every old README line is found in the new set, and prints each missing line otherwise.
  </behavior>
  <action>
RED: extend REQUIRED_DOCS as in the behavior block and confirm `pnpm exec vitest run tests/docs-links.test.ts` fails only on the missing PRIVACY.md link.

GREEN:
1. Create docs/PRIVACY.md: `# Privacy defaults`, blank line, `[Back to README](../README.md)`, then the old Privacy defaults body verbatim from the insertion-only paragraph through the EXTENSIONS sentence. Link targets become docs-relative, link texts unchanged: Installed-tool awareness goes to `USAGE.md#installed-tool-awareness`, `docs/config.example.json` to `config.example.json`, `docs/EXTENSIONS.md` to `EXTENSIONS.md`.
2. Append `## Anonymous telemetry` to docs/PRIVACY.md, a short section in the page's plain style. Write a claim only after confirming it in the read_first source files; leave out anything you cannot confirm. Expected points, to check against source: it is off unless you say yes; a one-time prompt after your first accepted `??` asks the question in src/client/telemetry-consent.ts (quote it), default No, asked once, answer saved in `~/.config/qq/config.json`; it is never asked without a terminal; `DO_NOT_TRACK`, `QQ_TELEMETRY=0` (and the other off values `telemetryBlockedBy` accepts) or `CI` keep it off whatever the config says; what is sent is only the allow list of event families and their fields as defined in source (error kind and provider kind; per-`??` outcome, candidate count and provider kind; environment shape fields), and never commands, queries, paths, error messages, stack traces or timings; identity is a random install id created when you opt in, and `qq telemetry off` deletes it; the daemon sends batches to PostHog Cloud EU, and drops a batch that fails to send, with no disk queue; `qq telemetry status|on|off|show`, where `show` prints the pending and last sent batches byte for byte. Use "allow list", never the older term.
3. Delete the Privacy defaults section from README.md.
4. Finish README `## More`, all targets absolute `https://github.com/k-leumas/queque/blob/main/...`: Install, Choose a provider, Usage, Privacy (link text `Privacy`; what leaves your machine, debug logging, telemetry), Configuration, then one bullet linking `System design` (docs/SYSTEM_DESIGN.md) and `Extensions` (docs/EXTENSIONS.md) for architecture and extension seams, and one bullet linking `Contributing` (CONTRIBUTING.md). Final README section order: H1, badges, Before/Now, gif, Install, Choose a provider, Usage, More. Read the README top to bottom once: no duplicate sentences, no leftover blank-line runs longer than one, at most 75 lines.
5. Create .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs, a standalone node ESM script with no dependencies. It reads the old README with `execFileSync('git', ['show', 'b45f6db:README.md'])` and builds a corpus from README.md, docs/INSTALL.md, docs/PROVIDERS.md, docs/USAGE.md, docs/PRIVACY.md and docs/CONFIGURATION.md (paths relative to `git rev-parse --show-toplevel`). The same normalizer runs on each old line and on each corpus line: replace every `](...)` link target with `]()`, strip a leading `> `, strip leading heading markers (`#` runs plus a space), collapse whitespace runs to one space, trim. Skip old lines that are fence markers or shorter than 3 characters after normalization. A constant ALLOWED_DROPS lists exactly six old lines, compared trimmed: `#### Copy-pasting commands from the browser is dead.`, `Welcome to the **future** –`, `> [!NOTE]`, `<details>`, `</details>`, `<summary>Install via npm</summary>`. Every other old line must appear as a substring of the newline-joined normalized corpus. Print each missing line, exit 1 if any are missing, otherwise print the checked line count and exit 0. Never add entries to ALLOWED_DROPS to make it pass: a missing line means content was lost, so move it into the right docs file.
<!-- planner-discipline-allow: Copy-pasting -->
6. Run the script and the tests (see verify) until green.

Bookkeeping and commit: anatomy entries for docs/PRIVACY.md and the script (under the quick-task directory section, matching neighbours), refreshed README.md and tests/docs-links.test.ts descriptions, hook damage repaired. In .wolf/cerebrum.md replace the stale Key Learning that says the README provider section is "Choose a provider" with anchor `#choose-a-provider` with: provider docs live in docs/PROVIDERS.md (anchors `#claude-default`, `#openai-or-ollama-beta`, `#after-changing-your-key-or-settings`); and add one learning: README.md ships alone in the npm package, so README links to repo docs are absolute `https://github.com/k-leumas/queque/blob/main/` URLs, docs-to-docs links are relative, and tests/docs-links.test.ts enforces both plus every anchor. Append one .wolf/memory.md line. `git add` exactly docs/PRIVACY.md README.md tests/docs-links.test.ts, the script, .wolf/cerebrum.md, .wolf/anatomy.md, .wolf/memory.md (plus buglog only if it has a real change), and commit `docs(readme): move privacy into docs/PRIVACY.md and finish the docs index` with a short wrapped body that mentions the telemetry section. No trailer, no `--no-verify`, no push.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts && node .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs && awk 'END { exit NR > 75 }' README.md && test "$(grep -c -i 'copy-pasting' README.md)" = 1 && test "$(grep -c -F 'QQ_DEBUG_LOG_FILE' README.md)" = 0 && grep -F -q 'qq telemetry off' docs/PRIVACY.md && grep -F -q 'DO_NOT_TRACK' docs/PRIVACY.md && grep -F -q 'USAGE.md#installed-tool-awareness' docs/PRIVACY.md && pnpm exec tsc --noEmit && pnpm exec biome check tests/docs-links.test.ts</automated>
  </verify>
  <done>docs/PRIVACY.md holds the old privacy section verbatim plus a source-checked telemetry section. README.md is at most 75 lines in the final order, with a More list linking all five new docs, System design, Extensions and Contributing through absolute URLs. The preservation script passes against b45f6db with only the six allowed drops. Link guard, badge test, typecheck and biome are green. cerebrum records the new doc locations and the absolute-link rule. Three commits total, nothing pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Docs to reader's trust | Users decide what to install and what to opt into based on the README and the privacy page |
| npmjs.com rendering | The npm package ships README.md alone; the README is rendered on npmjs.com, away from docs/ |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261030-fdr-01 | Information disclosure | docs/PRIVACY.md telemetry section | medium | mitigate | Task 3 writes each telemetry claim only after confirming it in src/client/telemetry-consent.ts, src/shared/telemetry-config.ts, src/cli/commands/telemetry.ts, src/client/telemetry-events.ts, src/daemon/telemetry-buffer.ts and src/shared/telemetry-endpoint.ts, so the page never says less leaves the machine than actually does; unconfirmed claims are left out |
| T-261030-fdr-02 | Repudiation | Facts lost in the move (e.g. what never leaves the machine, the insertion-only promise) | medium | mitigate | check-readme-moved.mjs compares every line of `git show b45f6db:README.md` against the new README + docs set, with only six named decorative lines allowed to drop |
| T-261030-fdr-03 | Tampering | Broken links hiding setup or safety guidance (the do-not-redirect `qq init zsh` warning, provider restart steps) | low | mitigate | The do-not-redirect warning stays inline in the README Install step; tests/docs-links.test.ts fails CI on any dangling relative link or anchor and on any relative README link that would break on npmjs.com |
| T-261030-fdr-SC | Tampering | npm/pip/cargo installs | low | accept | No packages are installed: the test uses vitest, node:fs and node:path, the script uses node built-ins |
</threat_model>

<verification>
- `pnpm exec vitest run tests/docs-links.test.ts tests/readme-badges.test.ts` passes.
- `node .planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/check-readme-moved.mjs` exits 0.
- README.md is at most 75 lines, says the tagline once, and keeps the badge block byte-identical under the H1 (`git diff b45f6db -- README.md` shows no change in lines 3 to 12).
- `pnpm exec tsc --noEmit` and `pnpm exec biome check tests/docs-links.test.ts` pass.
- `git log --oneline -3` shows three `docs(readme): ...` commits with no Co-Authored-By trailer; `git status --short` shows only `screen-cap-filename.mov` untracked.
</verification>

<success_criteria>
- A new user can install, wire up `??`, pick a provider and run a first query from README.md alone.
- Every old README fact lives in README.md or one of the five new docs files.
- No relative link or anchor in README.md, CONTRIBUTING.md or docs/*.md is broken, and README docs links work on npmjs.com.
- docs/PRIVACY.md documents opt-in telemetry accurately.
</success_criteria>

<output>
Create `.planning/quick/261030-fdr-reformat-the-readme-minimal-move-the-res/261030-fdr-SUMMARY.md` when done
</output>
