---
phase: quick-261118-ubg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/smoke-homebrew-docker.sh
  - scripts/docker-homebrew-smoke-runner.sh
  - .dockerignore
  - .github/workflows/release.yaml
  - tests/homebrew-smoke-docker.test.ts
  - .wolf/anatomy.md
  - .wolf/memory.md
  - .wolf/cerebrum.md
autonomous: true
requirements: [quick-261118-ubg]

estimate:
  tokens: 75000
  raw_tokens: 75000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "The Homebrew install smoke runs on every release push (main and beta) with no Anthropic secret and no skip path: the release workflow has no conditional around it and no 'Skip Homebrew install smoke' step"
    - "Only the model is fake: the smoke container puts a `claude` shim on PATH that runs tests/fixtures/fake-claude-stream.mjs (mounted read-only at /opt/fake/fake-claude-stream.mjs, exactly as scripts/smoke-distro.sh does). The formula-shaped install, `qq init zsh`, the ZLE widget, client, daemon and Ink TUI stay the real product"
    - "The smoke passes deterministically: the expect script waits for the fake's first candidate `tldr z3` and then for the zsh prompt redraw `QQSMOKE# tldr z3  # ` that proves the accepted command reached the live buffer; QueQue error text fails it"
    - "Locally, `scripts/smoke-homebrew-docker.sh` passes end to end with no Anthropic key in the environment, and a plain `docker build` is still what it runs when QQ_SMOKE_DOCKER_CACHE is unset"
    - "A content change under src/, or a package.json version bump (what every release commit makes), rebuilds the smoke image with the `npm install` layer CACHED; cold, warm, src-change and version-bump timings are recorded in the SUMMARY"
    - "With QQ_SMOKE_DOCKER_CACHE=gha the script builds with `docker buildx build --load` and type=gha cache-from/cache-to (cache-to has ignore-error=true, so cache trouble never fails a release); any other non-empty value exits 2 with a usage error"
    - "The Docker build context holds only the files the smoke Dockerfile copies: node_modules, .git and dotenv files never reach the Docker daemon"
    - "release.yaml runs `test` (lint, typecheck, test, build; zsh jq bash tmux restored from an apt cache) and `brew-smoke` (checkout, buildx, Actions runtime, smoke script; no node, apt or pnpm) in parallel, and tag-and-changelog needs both"
  artifacts:
    - path: scripts/smoke-homebrew-docker.sh
      provides: "Key-free Homebrew-shaped smoke: deps-first layer order, version-stripped manifest stage, --no-cache flag, QQ_SMOKE_DOCKER_CACHE=gha buildx branch, fake claude mount"
    - path: scripts/docker-homebrew-smoke-runner.sh
      provides: "In-container half: writes the fake claude shim, drives zsh with expect, asserts tldr z3 reaches the buffer"
    - path: .dockerignore
      provides: "Allow-list build context (ignore everything, re-include each smoke COPY source)"
    - path: .github/workflows/release.yaml
      provides: "Parallel test and brew-smoke jobs, apt cache, buildx + gha cache wiring, tag-and-changelog needs both"
    - path: tests/homebrew-smoke-docker.test.ts
      provides: "Guards: no key in the smoke, fake claude wired, .dockerignore tracks COPY sources, gha gate, release job shape"
  key_links:
    - from: scripts/smoke-homebrew-docker.sh
      to: tests/fixtures/fake-claude-stream.mjs
      via: "docker run -v \"$ROOT_DIR/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro\""
      pattern: "fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro"
    - from: scripts/docker-homebrew-smoke-runner.sh
      to: src/providers/claude-default.ts
      via: "/usr/local/bin/claude shim; with no key the default adapter runs `claude -p` (fetchClaudeCliCandidates)"
      pattern: "exec node /opt/fake/fake-claude-stream.mjs"
    - from: .github/workflows/release.yaml
      to: scripts/smoke-homebrew-docker.sh
      via: "brew-smoke job env QQ_SMOKE_DOCKER_CACHE: gha, after docker/setup-buildx-action and crazy-max/ghaction-github-runtime"
      pattern: "QQ_SMOKE_DOCKER_CACHE: gha"
    - from: .dockerignore
      to: scripts/smoke-homebrew-docker.sh
      via: "every COPY source in the heredoc Dockerfile is re-included (guarded by tests/homebrew-smoke-docker.test.ts)"
      pattern: "!scripts/docker-homebrew-smoke-runner.sh"
    - from: .github/workflows/release.yaml
      to: "tag-and-changelog job"
      via: "needs: [test, brew-smoke]"
      pattern: "needs: [test, brew-smoke]"
---

<objective>
Speed up and harden `.github/workflows/release.yaml` while keeping the Homebrew install smoke in
every release run.

Baseline (orchestrator-measured, ~4 min total): job `test` 161 s (setup-node 7 s, apt install of
zsh jq bash tmux 24 s, Test 35 s, Homebrew install smoke 76 s), then tag-and-changelog 46 s, then
publish-npm and publish-homebrew in parallel (~32 s).

Four changes, as the user asked:
1. Split `test` into two parallel jobs: `test` (lint/typecheck/test/build) and `brew-smoke`
   (checkout + scripts/smoke-homebrew-docker.sh only, no node/apt/pnpm); tag-and-changelog needs both.
2. Docker caching for scripts/smoke-homebrew-docker.sh: install deps before copying src/shell,
   `docker buildx` with type=gha cache-from/cache-to only in CI (local runs unchanged), add a
   .dockerignore.
3. Cache the apt shell test deps (zsh jq bash tmux) in the release `test` job.
4. Run the Homebrew smoke on the fake claude (tests/fixtures/fake-claude-stream.mjs) that the
   distro smoke uses, so it needs no Anthropic secret and never skips. The live API path stays
   covered by the nightly `live` job (.github/workflows/nightly.yml).

Purpose: shorter release wall time (smoke off the critical path of lint/test, cached layers and
apt), and a release gate that cannot silently skip or depend on a secret.

Output: edited smoke scripts and release workflow, a new .dockerignore, a new guard test, and a
SUMMARY with local cold/warm build timings.

Time estimate: Task 1 ~15 min (the first image build takes 3-6 min), Task 2 ~25 min (one cold
build 3-6 min plus three warm runs of 1-2 min each and a context check), Task 3 ~10 min, final
full-suite check ~3 min. Total ~55 min.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.wolf/cerebrum.md
@.github/workflows/release.yaml
@scripts/smoke-homebrew-docker.sh
@scripts/docker-homebrew-smoke-runner.sh
@scripts/smoke-distro.sh
@scripts/smoke-distro-runner.sh
@tests/homebrew-node-pin.test.ts
@tests/install-marker-formula.test.ts

Facts already established (verified while planning, do not re-derive):
- With no usable key, `claudeDefaultAdapter` (src/providers/claude-default.ts) goes straight to
  `claude -p` via `fetchClaudeCliCandidates`; there is no auth probe, so a PATH shim is enough.
  scripts/smoke-distro-runner.sh writes that shim to /usr/local/bin/claude as
  `exec node /opt/fake/fake-claude-stream.mjs "${FAKE_CLAUDE_SCENARIO:-success}" "$@"` (mode 755).
- The fake's `success` scenario answers `tldr z3` (explanation "Show concise usage examples for
  z3") then `z3 -smt2 <file>`. After Enter the zsh buffer redraws as `tldr z3  # Show concise ...`;
  scripts/smoke-distro.exp anchors on `QQSMOKE[%#$] tldr z3  # ` for exactly this.
- tests/homebrew-node-pin.test.ts requires these substrings in scripts/smoke-homebrew-docker.sh:
  `NODE_MAJOR="$(tr -d 'v[:space:]' < .nvmrc | cut -d. -f1)"`, `--build-arg "NODE_MAJOR=$NODE_MAJOR"`,
  `FROM node:${NODE_MAJOR}-bookworm`, and no `FROM node:<digit>`. tests/install-marker-formula.test.ts
  regex-matches exactly one `printf '%s' '<json>' >"$libexec/lib/node_modules/@k-leumas/queque-cli/.install-source"`
  line. Both must keep passing unchanged.
- The release commit (`chore(release): x.y.z [skip ci]`) changes only package.json `version` and
  CHANGELOG.md, so every release run sees a package.json that differs from the previous run's.
  A deps layer keyed on raw package.json would miss the cache on nearly every release run.
- npm ignores pnpm-lock.yaml; it is copied today and stays in the deps layer key so an in-repo
  dependency bump refreshes the cached `npm install`. Fresh-from-registry resolution (what real
  `brew install` users get) is still exercised on every PR and nightly by the distro smoke
  (`pnpm pack` + `npm install -g`), so caching the brew smoke's deps does not lose that coverage.
- `crazy-max/ghaction-github-runtime@v4` exports every `ACTIONS_*` variable (including
  ACTIONS_RUNTIME_TOKEN, ACTIONS_RESULTS_URL, ACTIONS_CACHE_SERVICE_V2) to later steps; buildx's
  gha backend reads them. GitHub cache service v1 is shut down; hosted runners' buildx is new
  enough for v2. `docker/setup-buildx-action@v4` creates and selects a docker-container builder,
  which supports cache export but needs `--load` for `docker run` to see the image.
- `awalsh128/cache-apt-pkgs-action@v1` restores extracted files only; it does not run ldconfig
  triggers or postinst scripts.
- Local tooling: actionlint and shellcheck are in /usr/local/bin; Docker Desktop server 20.10.12
  with BuildKit; local buildx is 0.7.1 (too old for gha, irrelevant because local runs use plain
  `docker build`). The Claude Bash tool runs zsh, `git` is a shell function there (use
  `whence -p git`), and `bash` on PATH is macOS bash 3.2: with `set -u`, expanding an EMPTY array
  as `"${arr[@]}"` aborts with "unbound variable" in bash 3.2.
- A secret-file guard hook blocks any Bash command containing the dotenv filename; never type it
  in a shell command (the guard test checks for the old helper by function name instead).
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Homebrew smoke runs end to end on the fake claude with no key</name>
  <files>scripts/smoke-homebrew-docker.sh, scripts/docker-homebrew-smoke-runner.sh</files>
  <precondition>Docker is running locally: `docker info` exits 0.</precondition>
  <read_first>scripts/smoke-distro-runner.sh (the claude shim block), scripts/smoke-distro.exp (wait_for_candidate and the `tldr z3  # ` redraw patterns)</read_first>
  <action>
Thinnest end-to-end slice of change 4: host script, image, installed qq, zsh widget, daemon,
`claude -p` path, fake model, shell buffer. The Dockerfile layer order stays as it is in this task
(Task 2 owns caching).

In scripts/smoke-homebrew-docker.sh:
- Delete the whole Anthropic key lookup: the `read_env_local_key` function, the API_KEY resolution
  chain, and its "error: set ..." exit 2. The script must read no key from the environment or any
  file, and must not pass one into the container.
- Rewrite usage(): say the smoke installs QueQue in the Homebrew formula's shape and types
  `list files by size??` into a real zsh PTY, and that only the model is fake (the `claude` on
  PATH runs tests/fixtures/fake-claude-stream.mjs), so no API key or token is read or passed.
  Keep the QQ_SMOKE_QUERY and IMAGE_NAME entries. Do not name the Anthropic key variable anywhere
  in the file (the Task 2 guard test asserts its absence).
- In the `docker run` call drop the key `-e`, add
  `-v "$ROOT_DIR/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro"`
  (identical mount to scripts/smoke-distro.sh), keep `-e QQ_NO_UPDATE_CHECK=1` and
  `-e "QQ_SMOKE_QUERY=$QUERY"`.
- Leave the NODE_MAJOR line, the `--build-arg "NODE_MAJOR=$NODE_MAJOR"` text, both
  `FROM node:${NODE_MAJOR}-bookworm` occurrences and the formula-emulation RUN block byte-identical.

In scripts/docker-homebrew-smoke-runner.sh:
- Remove the line that requires the Anthropic key (the `: "${...:?...}"` guard).
- Before `qq init zsh` (the widget prewarms the daemon while ~/.zshrc loads, and the daemon keeps
  the PATH it started with), fail with exit 21 and a clear "smoke failed: fake claude fixture not
  mounted at /opt/fake/fake-claude-stream.mjs" message when that file is missing, then write the
  /usr/local/bin/claude shim exactly as scripts/smoke-distro-runner.sh does (same heredoc body,
  chmod 755). Add a short comment saying only the model is fake and why (same wording style as
  the smoke-distro-runner.sh header).
- In the expect script: lower `set timeout` from 75 to 40 (no network now). Replace the first
  wait after `send -- "$query??"` with: success on the literal `tldr z3`; failure exit 11 on
  `-re {(queque|QueQue): [^\r\n]*}`; timeout exit 12. Replace the post-Enter wait with: success on
  `-re {QQSMOKE[%#] tldr z3  # }` (the prompt redraw holding the accepted command); failure exit 13
  on the same QueQue error regex; timeout exit 14. Drop the old `queque .*` exp_continue branch
  and the old generic `> +...` and two-space-hash patterns: never loosen to a pattern that matches
  without `tldr z3` in the buffer. Keep the Ctrl-C, `exit`, `expect eof` tail and exit 10/20 paths.
- Update the final echo to say the Homebrew-shaped install handled `??` and returned the fake
  claude's candidate to the zsh buffer.

Then prove it and take the "before caching" baseline (old layer order) for the SUMMARY. Save
all build/run output to files under the session scratchpad and read only tails/greps of them:
1. Run `env -u ANTHROPIC_API_KEY -u anthropic_api_key ./scripts/smoke-homebrew-docker.sh`, record
   exit code and wall seconds (`date +%s` before/after). It must print "smoke passed".
2. Append one comment line to src/cli/main.ts (a real content change: BuildKit ignores mtime, so
   `touch` alone does not bust a layer), rerun the same command, record wall seconds and whether
   the `npm install --ignore-scripts` step shows DONE (re-ran) or CACHED, then restore the file
   with `whence -p git` checkout. Keep both numbers for the SUMMARY "before" row.

If the expect run fails, read the PTY transcript in the output before changing patterns; compare
with scripts/smoke-distro.exp, which passes on Debian with the same fake.

Commit: `ci(smoke): run the homebrew install smoke on the fake claude` (body: no key needed, never
skips; live API stays on the nightly live job). Run shellcheck first. No Co-Authored-By trailer
(user rule). Stage the .wolf/ changes with the code, restoring curated anatomy.md lines and
dropping auto-detected buglog.json noise per cerebrum.
  </action>
  <verify>
    <automated>bash -n scripts/smoke-homebrew-docker.sh && bash -n scripts/docker-homebrew-smoke-runner.sh && shellcheck scripts/smoke-homebrew-docker.sh scripts/docker-homebrew-smoke-runner.sh && pnpm exec vitest run tests/homebrew-node-pin.test.ts tests/install-marker-formula.test.ts && env -u ANTHROPIC_API_KEY -u anthropic_api_key ./scripts/smoke-homebrew-docker.sh</automated>
  </verify>
  <done>With no Anthropic key in the environment the smoke exits 0 and prints "smoke passed" after the zsh buffer redraws with `tldr z3  # ...`; both existing vitest guards pass; shellcheck is clean; the old-layout src-change rebuild time and npm-layer status are recorded for the SUMMARY; src/cli/main.ts is restored; one commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Cached smoke image: deps-first layers, version-stripped manifest, .dockerignore, CI-only gha cache</name>
  <files>scripts/smoke-homebrew-docker.sh, .dockerignore, tests/homebrew-smoke-docker.test.ts</files>
  <precondition>Docker is running locally: `docker info` exits 0.</precondition>
  <behavior>
    - The smoke script never names the Anthropic key (either case) and has no `read_env_local_key` helper
    - The smoke script mounts `tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro`, and the runner contains `exec node /opt/fake/fake-claude-stream.mjs` and no `:?` key guard
    - .dockerignore's first non-comment, non-blank line is `*`, and every source path of every non-`--from` COPY line in the smoke script's heredoc Dockerfile has a matching `!<path>` line
    - The script contains `docker buildx build`, `--load`, `type=gha` in both a cache-from and a cache-to value, `ignore-error=true` in the cache-to value, and the gate value `gha`; it still contains a plain `docker build` invocation
    - In the heredoc Dockerfile the `npm install --ignore-scripts` RUN comes before `COPY src ./src` and `COPY shell ./shell`, and a `COPY --from=` line feeds it the manifest
  </behavior>
  <action>
Write tests/homebrew-smoke-docker.test.ts first (red), modelled on tests/homebrew-node-pin.test.ts:
`ROOT = join(import.meta.dirname, '..')`, a `read(relPath)` helper, one `describe('Homebrew Docker
smoke', ...)` with one `it` per behavior bullet above. For the COPY check, take lines of the smoke
script matching `^COPY ` that do not start with `COPY --from=`, split on whitespace, drop `COPY`
and the last token (the destination), and expect each remaining source to appear as an exact
`!source` line in .dockerignore. For the key checks, build the forbidden names from fragments
(e.g. `['ANTHROPIC', 'API', 'KEY'].join('_')`) so the test file itself stays free of the literal
pattern a future grep might flag. Run it, confirm it fails, then implement:

1. Layer order in the heredoc Dockerfile (per the user's change 2; keep the ARG/FROM text the
   node-pin test needs):
   a. `ARG NODE_MAJOR` then a first stage `FROM node:${NODE_MAJOR}-bookworm AS manifest` that
      copies package.json and runs a `node -e` one-liner writing the same JSON minus the `version`
      field (JSON.stringify with 2-space indent, deterministic) to a file in that stage. Comment
      why: the release commit bumps only `version`, so stripping it lets BuildKit's content-keyed
      `COPY --from` reuse the npm layer across releases.
   b. Main stage `FROM node:${NODE_MAJOR}-bookworm`, the existing ENV lines and apt layer
      unchanged, `WORKDIR /src`, `COPY --from=manifest <stripped file> ./package.json`,
      `COPY pnpm-lock.yaml ./`, then `RUN npm install --ignore-scripts --loglevel=error` alone.
   c. Then `COPY package.json tsconfig.json tsup.config.ts ./` (the real manifest overwrites the
      stripped one), `COPY src ./src`, `COPY shell ./shell`, `RUN node_modules/.bin/tsup`.
   d. The formula-emulation comment and RUN block byte-identical to today.
   e. Last: `COPY scripts/docker-homebrew-smoke-runner.sh /usr/local/bin/run-queque-homebrew-smoke`,
      the chmod RUN, the unchanged CMD (runner edits no longer bust tsup or the install layers).
2. Build invocation. Add argument parsing: `-h|--help` (existing), `--no-cache` (passes
   `--no-cache` to the build, for local cold timing), anything else prints usage to stderr and
   exits 2. Read `QQ_SMOKE_DOCKER_CACHE`: unset or empty selects a plain `docker build` (the local
   path, unchanged behavior); `gha` selects `docker buildx build --load --cache-from
   "type=gha,scope=queque-homebrew-smoke" --cache-to
   "type=gha,mode=max,scope=queque-homebrew-smoke,ignore-error=true"`; any other value prints
   "error: QQ_SMOKE_DOCKER_CACHE must be unset or gha" and exits 2 (fail closed on an allow list,
   per cerebrum). Validate the flag and the variable before any docker command runs. Build the command as a bash array that always starts with the docker words and
   only ever grows with `+=`, so it is never empty (bash 3.2 plus `set -u` aborts on an empty
   array expansion). Keep `--build-arg "NODE_MAJOR=$NODE_MAJOR" -t "$IMAGE_NAME" -f - .` and the
   heredoc on the invocation line. Print one line naming the mode before building ("building with
   docker buildx + gha cache" or "building with docker build") and, after it, "image built in Ns"
   using bash `SECONDS`, so CI logs show the build time. Document `--no-cache` and
   QQ_SMOKE_DOCKER_CACHE (CI only: needs a docker-container buildx builder and the Actions runtime
   variables) in usage().
3. Create .dockerignore as an allow list: a header comment saying it scopes the build context of
   scripts/smoke-homebrew-docker.sh, must list every COPY source of that Dockerfile (guarded by
   tests/homebrew-smoke-docker.test.ts), and keeps node_modules, .git and dotenv files off the
   Docker daemon; then `*`, then one `!` line each for package.json, pnpm-lock.yaml,
   tsconfig.json, tsup.config.ts, src, shell, scripts/docker-homebrew-smoke-runner.sh.

Measure locally (each with `env -u ANTHROPIC_API_KEY -u anthropic_api_key`, output to scratchpad
files, record exit code, wall seconds, the script's "image built in Ns", and the
`npm install --ignore-scripts` step's DONE/CACHED status from the BuildKit plain log):
   A. cold: `./scripts/smoke-homebrew-docker.sh --no-cache`
   B. warm, no change: `./scripts/smoke-homebrew-docker.sh`
   C. src change: append a comment line to src/cli/main.ts, run, restore it (expect npm CACHED;
      tsup and the emulation layer re-run)
   D. version bump: change package.json `version` to a throwaway value (e.g. 9.9.9) with a
      one-off edit, run, restore it (expect npm CACHED). If D shows the npm layer re-running,
      record it and report it in the SUMMARY; do not add host-side temp files to the build context.
Then list the build context once: pipe a three-line Dockerfile (`FROM busybox`, `COPY . /ctx`,
`RUN find /ctx -mindepth 1 | sort`) to `docker build --no-cache --progress=plain -f - .` and keep
the listing: it must show only the seven allow-listed paths and the files under src/ and shell/.

Commit: `ci(smoke): cache the homebrew smoke image layers` (body: deps-first, version-stripped
manifest, CI-only gha cache, allow-list .dockerignore). Run `pnpm exec biome check` on the new
test file first. No Co-Authored-By trailer. Stage .wolf/ with the code (anatomy.md entries for
.dockerignore and the new test, curated lines restored).
  </action>
  <verify>
    <automated>bash -n scripts/smoke-homebrew-docker.sh && shellcheck scripts/smoke-homebrew-docker.sh && pnpm exec biome check tests/homebrew-smoke-docker.test.ts && pnpm exec vitest run tests/homebrew-smoke-docker.test.ts tests/homebrew-node-pin.test.ts tests/install-marker-formula.test.ts && { QQ_SMOKE_DOCKER_CACHE=bogus ./scripts/smoke-homebrew-docker.sh; test $? -eq 2; } && env -u ANTHROPIC_API_KEY -u anthropic_api_key ./scripts/smoke-homebrew-docker.sh</automated>
  </verify>
  <done>The new guard test passes along with both existing guards; QQ_SMOKE_DOCKER_CACHE=bogus exits 2; the key-free local smoke passes; scenarios A-D are measured with C and D showing the npm install step CACHED (or D's miss is reported); the context listing shows only allow-listed paths; src/cli/main.ts and package.json are restored; one commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Release workflow: parallel test and brew-smoke jobs, apt cache, gha wiring</name>
  <files>.github/workflows/release.yaml, tests/homebrew-smoke-docker.test.ts, .wolf/anatomy.md, .wolf/cerebrum.md, .wolf/memory.md</files>
  <behavior>
    - A `jobBlock(name)` helper slices release.yaml from the two-space-indented `  name:` job key to the next two-space-indented job key
    - `brew-smoke` contains `./scripts/smoke-homebrew-docker.sh`, `QQ_SMOKE_DOCKER_CACHE: gha`, `docker/setup-buildx-action@`, `crazy-max/ghaction-github-runtime@` and `contents: read`; it contains no `if:`, no `setup-node`, no `pnpm/action-setup`, no `apt-get` and no Anthropic key name
    - `test` contains `cache-apt-pkgs-action@`, `packages: zsh jq bash tmux`, `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build`; it contains no smoke script call and no Anthropic key name
    - `tag-and-changelog` contains `needs: [test, brew-smoke]`, and release.yaml no longer contains the skip step's name
  </behavior>
  <action>
Add the behavior assertions to tests/homebrew-smoke-docker.test.ts as a second describe block
(key names built from fragments as in Task 2) and confirm they fail. Then edit
.github/workflows/release.yaml (per the user's changes 1 and 3):

`test` job: remove the job-level env that injected the Anthropic secret and both Homebrew smoke
steps (the conditional run and the skip notice). Add `permissions: contents: read`. Replace the
"Install shell test dependencies" apt-get step with a step of the same name using
`awalsh128/cache-apt-pkgs-action@v1` with `packages: zsh jq bash tmux` and `version: 1` (comment:
bump `version` to rebuild the cache when the list changes). Follow it with a "Check shell test
dependencies" run step: `sudo ldconfig` (comment: a cache restore extracts files only and skips the
ldconfig trigger), then `zsh --version`, `tmux -V`, `jq --version`, `bash --version | head -n 1`,
so a bad restore fails here instead of deep in vitest. Keep checkout with fetch-depth 0,
pnpm/action-setup, setup-node with pnpm cache, frozen install, Lint, Type check, Test, Build.

New `brew-smoke` job after `test`: `runs-on: ubuntu-latest`, `timeout-minutes: 10`,
`permissions: contents: read`, `env: QQ_SMOKE_DOCKER_CACHE: gha`. Steps: `actions/checkout@v6`
with `persist-credentials: false` (default depth; the smoke needs no history);
`docker/setup-buildx-action@v4`; `crazy-max/ghaction-github-runtime@v4` (comment: exposes the
ACTIONS_* runtime variables the gha cache backend reads in a run step); "Homebrew install smoke"
with `timeout-minutes: 5` running `./scripts/smoke-homebrew-docker.sh`. No `if:` anywhere in the
job, no setup-node, pnpm or apt. Add a short job comment: the image builds qq from source in
Docker, only the model is fake, so no secret is needed and the smoke always runs.

`tag-and-changelog`: `needs: [test, brew-smoke]`. Leave every other line of tag-and-changelog,
publish-npm and publish-homebrew untouched (semantic-release keeps its own secret env; the formula
install block, depends_on and marker text are guarded by the existing tests).

Run actionlint (it also shellchecks run blocks), the vitest file, then the full gates. Update
.wolf/cerebrum.md Key Learnings with one entry: the Homebrew smoke runs on the fake claude with no
key; CI builds it with buildx + type=gha only when QQ_SMOKE_DOCKER_CACHE=gha; the deps layer is
keyed on a version-stripped package.json plus pnpm-lock.yaml; .dockerignore is an allow list that
must track the smoke Dockerfile's COPY sources. Append a .wolf/memory.md line and update
.wolf/anatomy.md for the changed files.

Commit: `ci(release): run the brew smoke as its own job and cache apt deps` (body: parallel jobs,
tag-and-changelog needs both, apt cache, gha cache wiring, smoke never skips). No Co-Authored-By
trailer. Stage .wolf/ with the code.
  </action>
  <verify>
    <automated>actionlint .github/workflows/release.yaml && pnpm exec biome check tests/homebrew-smoke-docker.test.ts && pnpm exec vitest run tests/homebrew-smoke-docker.test.ts tests/homebrew-node-pin.test.ts tests/install-marker-formula.test.ts && pnpm lint && pnpm typecheck && pnpm test:run</automated>
  </verify>
  <done>actionlint is clean; the guard test (both describe blocks) and the existing guards pass; lint, typecheck and the full vitest suite pass; release.yaml has parallel `test` and `brew-smoke` jobs with tag-and-changelog needing both, an apt cache step plus dependency check in `test`, and no secret or conditional on the smoke; cerebrum/anatomy/memory updated; one commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| host checkout -> Docker build context | Files sent to the Docker daemon or buildx builder; the local repo root holds a dotenv file with a real Anthropic key and 241 MB of node_modules |
| release job -> third-party actions | awalsh128/cache-apt-pkgs-action, docker/setup-buildx-action and crazy-max/ghaction-github-runtime run inside `test` / `brew-smoke` with the job token |
| GitHub Actions cache -> release jobs | Restored apt files and Docker layers feed the release gate |
| smoke container -> host | The container gets the fake claude fixture read-only and nothing else from the host |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261118-ubg-01 | Information disclosure | .dockerignore / build context | high | mitigate | Allow-list .dockerignore (`*`, then only the seven COPY sources) keeps dotenv files, node_modules and .git off the daemon; the guard test checks the `*` rule and every COPY source; Task 2 lists the real context to confirm |
| T-261118-ubg-02 | Information disclosure | release.yaml `test` and `brew-smoke` | medium | mitigate | The Anthropic secret is removed from `test` and never added to `brew-smoke` (fake claude); both jobs set `permissions: contents: read`; brew-smoke checkout uses `persist-credentials: false`; the guard test asserts no key name in either job block |
| T-261118-ubg-03 | Elevation of privilege | third-party actions in `test` / `brew-smoke` | medium | mitigate | Read-only job permissions and no secrets in those jobs limit what a compromised action can reach; actions are major-tag pinned like the rest of the repo; jobs with GH_TOKEN, npm OIDC or the tap token gain no new actions |
| T-261118-ubg-04 | Tampering | gha Docker layer cache / apt cache | low | accept | release.yaml runs only on push to main and beta; Actions caches written by PR refs are not readable from those branches, so only release-branch runs can write the `queque-homebrew-smoke` scope |
| T-261118-ubg-05 | Denial of service | release gate vs cache service outage | medium | mitigate | `ignore-error=true` on cache-to and non-fatal cache-from misses mean cache trouble only slows the build; the smoke still runs and gates the release |
| T-261118-ubg-06 | Tampering | smoke fidelity (passes without testing the product) | medium | mitigate | Only `claude` is faked; the expect script requires the fake's exact `tldr z3` candidate and the `QQSMOKE# tldr z3  # ` buffer redraw, and fails on QueQue error text; the formula-shaped install path stays real and byte-guarded by the existing tests |
| T-261118-ubg-07 | Information disclosure | crazy-max/ghaction-github-runtime logs ACTIONS_* values | low | accept | ACTIONS_RUNTIME_TOKEN is short-lived and job-scoped, and the job holds only `contents: read` and no secrets |
| T-261118-ubg-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new packages are installed by this plan (the image's existing `npm install` resolves the unchanged package.json), so no package-legitimacy checkpoint applies; the only new supply-chain inputs are the three GitHub Actions above, covered by T-261118-ubg-03 |
</threat_model>

<verification>
- `actionlint .github/workflows/release.yaml` is clean.
- `bash -n` and `shellcheck` pass on scripts/smoke-homebrew-docker.sh and scripts/docker-homebrew-smoke-runner.sh.
- `pnpm exec vitest run tests/homebrew-smoke-docker.test.ts tests/homebrew-node-pin.test.ts tests/install-marker-formula.test.ts` passes.
- `pnpm lint`, `pnpm typecheck` and `pnpm test:run` pass; also run the full suite on a pseudo-TTY like the pre-push hook: `script -q /dev/null pnpm test:run`.
- `env -u ANTHROPIC_API_KEY -u anthropic_api_key ./scripts/smoke-homebrew-docker.sh` passes end to end locally.
- The SUMMARY has a timing table: before (old layout, src change) from Task 1, and A cold / B warm / C src change / D version bump from Task 2, each with wall seconds, image build seconds and the npm install step's CACHED/DONE status, plus the build-context listing result.
- `git status` shows src/cli/main.ts and package.json unchanged.
</verification>

<success_criteria>
- The Homebrew smoke runs in every release run with no secret and no skip path, on the fake claude, with the real formula-shaped install.
- The release `test` and `brew-smoke` jobs run in parallel and tag-and-changelog needs both.
- The smoke image reuses its npm install layer across source changes and release version bumps locally, and CI builds it with buildx + type=gha cache while local runs stay on plain `docker build`.
- The apt shell test deps are restored from cache in the release `test` job and checked before tests run.
- The build context is limited to the Dockerfile's COPY sources.
- All guards, lint, typecheck and the full suite are green; three commits landed, each with its .wolf/ changes and no Co-Authored-By trailer.
- The SUMMARY names what can only be confirmed by the first release runs after merge: the brew-smoke log should show the gha cache being exported on the first run and imported (npm install CACHED) on the second, and the release wall time should be compared with the ~4 min baseline.
</success_criteria>

<output>
Create `.planning/quick/261118-ubg-speed-up-and-harden-the-release-workflow/261118-ubg-SUMMARY.md` when done, including the timing table and the post-merge CI checks above.
</output>
