---
phase: quick-260529-ntf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/release.yaml
  - .github/workflows/homebrew.yml
  - .releaserc.json
autonomous: true
requirements: [release-automation]
must_haves:
  truths:
    - "Push to main triggers the existing release job via the updated workflow"
    - "Push to beta triggers a pre-release via semantic-release"
    - "A published GitHub Release triggers homebrew-releaser to update the tap formula"
    - ".releaserc.json names both main and beta as release branches"
  artifacts:
    - path: ".github/workflows/release.yaml"
      provides: "CI that tests + releases on push to main or beta"
    - path: ".github/workflows/homebrew.yml"
      provides: "Homebrew tap update triggered on release published"
    - path: ".releaserc.json"
      provides: "semantic-release config with beta prerelease branch"
  key_links:
    - from: ".github/workflows/release.yaml"
      to: "pnpm exec semantic-release"
      via: "Release job step"
      pattern: "pnpm exec semantic-release"
    - from: ".github/workflows/homebrew.yml"
      to: "Justintime50/homebrew-releaser@v1"
      via: "release.types[published] trigger"
      pattern: "homebrew-releaser"
    - from: ".releaserc.json"
      to: "beta branch"
      via: "branches array"
      pattern: "\"prerelease\": true"
---

<objective>
Wire release automation for QueQue: update the existing release workflow to also fire on the beta branch, add a homebrew-releaser workflow that fires when a GitHub Release is published, and extend .releaserc.json with beta prerelease config.

Purpose: Every merge to main or beta automatically produces a versioned release (npm + GitHub Release). Every GitHub Release automatically updates the Homebrew tap formula without manual intervention.
Output: Updated release.yaml, new homebrew.yml, updated .releaserc.json.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update release.yaml — add beta branch trigger and fix action versions</name>
  <files>.github/workflows/release.yaml</files>
  <action>
    Edit the existing .github/workflows/release.yaml. Two changes:

    1. Add `beta` to the push branches list so both jobs run on beta pushes:
       ```
       on:
         push:
           branches:
             - main
             - beta
       ```

    2. In both the `test` job and the `release` job, upgrade the pnpm setup action from `pnpm/action-setup@v2` to `pnpm/action-setup@v4`. The pinned version in the `with.version` field stays `10.33.2`.

    3. In the `release` job, change `npx semantic-release` to `pnpm exec semantic-release` so the locally installed version from node_modules is used (avoids npx fetching a different version).

    Do not change any other steps, permissions, timeout values, job names, or environment variables. The `NPM_TOKEN` and `GITHUB_TOKEN` env vars on the Release step must remain exactly as they are.

    Secrets documentation (add as a YAML comment block above the `release` job's `env:` block):
    ```yaml
    # Required secrets (set in repo Settings → Secrets → Actions):
    # NPM_TOKEN — npmjs.com Automation token (Tokens → Generate New Token → Automation)
    # GITHUB_TOKEN — auto-provided by GitHub Actions; no manual setup needed
    ```
  </action>
  <verify>
    <automated>grep -n "beta\|pnpm/action-setup@v4\|pnpm exec semantic-release" /Users/samuel/dev/tui-llm/.github/workflows/release.yaml</automated>
  </verify>
  <done>
    release.yaml has `beta` in the branches list, both pnpm setup steps use @v4, and the release step calls `pnpm exec semantic-release`. The file is valid YAML (yamllint or cat output confirms no parse errors).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create homebrew.yml — automated tap formula update on release published</name>
  <files>.github/workflows/homebrew.yml</files>
  <action>
    Create .github/workflows/homebrew.yml with the following exact content. Do not add any jobs or steps beyond what is shown.

    Trigger: `on.release.types: [published]` — fires when a GitHub Release transitions to published state (including releases created by semantic-release).

    The workflow uses Justintime50/homebrew-releaser@v1. Required inputs:
    - homebrew_owner: k-leumas
    - homebrew_tap: homebrew-queque
    - github_token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
    - commit_owner: k-leumas
    - commit_email: samuelkimama@protonmail.com
    - install: the two-line npm install block using std_npm_args and libexec bin symlink
    - test: assert_match on `qq --version`
    - depends_on: '"node"' (double-quoted node string, which renders as `depends_on "node"` in the Ruby formula)
    - skip_commit: false

    Add a comment above the job explaining the required secret:
    ```yaml
    # Required secret: HOMEBREW_TAP_TOKEN
    # Create a GitHub Personal Access Token with `repo` scope on k-leumas/homebrew-queque.
    # Add it to this repo: Settings → Secrets → Actions → New repository secret.
    ```

    Full file content:

    ```yaml
    name: Update Homebrew Tap

    on:
      release:
        types: [published]

    jobs:
      # Required secret: HOMEBREW_TAP_TOKEN
      # Create a GitHub Personal Access Token with `repo` scope on k-leumas/homebrew-queque.
      # Add it to this repo: Settings → Secrets → Actions → New repository secret.
      homebrew:
        runs-on: ubuntu-latest
        steps:
          - name: Release to Homebrew tap
            uses: Justintime50/homebrew-releaser@v1
            with:
              homebrew_owner: k-leumas
              homebrew_tap: homebrew-queque
              github_token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
              commit_owner: k-leumas
              commit_email: samuelkimama@protonmail.com
              install: |
                system "npm", "install", *std_npm_args
                bin.install_symlink Dir["#{libexec}/bin/*"]
              test: |
                assert_match "queque", shell_output("#{bin}/qq --version")
              depends_on: '"node"'
              skip_commit: false
    ```
  </action>
  <verify>
    <automated>grep -c "homebrew-releaser\|HOMEBREW_TAP_TOKEN\|k-leumas/homebrew-queque" /Users/samuel/dev/tui-llm/.github/workflows/homebrew.yml</automated>
  </verify>
  <done>
    .github/workflows/homebrew.yml exists, triggers on release published, references HOMEBREW_TAP_TOKEN, uses Justintime50/homebrew-releaser@v1, and has the correct install/test blocks.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update .releaserc.json — add beta prerelease branch</name>
  <files>.releaserc.json</files>
  <action>
    Replace the `branches` array in .releaserc.json. The current value is `["main"]`. Replace it with:

    ```json
    "branches": [
      "main",
      { "name": "beta", "prerelease": true }
    ]
    ```

    Leave the entire `plugins` array exactly as-is. No other changes.

    After this change the file should read:

    ```json
    {
      "branches": [
        "main",
        { "name": "beta", "prerelease": true }
      ],
      "plugins": [
        "@semantic-release/commit-analyzer",
        "@semantic-release/release-notes-generator",
        [
          "@semantic-release/changelog",
          {
            "changelogFile": "CHANGELOG.md"
          }
        ],
        "@semantic-release/npm",
        "@semantic-release/github",
        [
          "@semantic-release/git",
          {
            "assets": ["CHANGELOG.md", "package.json"],
            "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
          }
        ]
      ]
    }
    ```
  </action>
  <verify>
    <automated>node -e "const c = JSON.parse(require('fs').readFileSync('/Users/samuel/dev/tui-llm/.releaserc.json','utf8')); console.log(JSON.stringify(c.branches)); if (!c.branches.some(b => b.name === 'beta' && b.prerelease === true)) process.exit(1);"</automated>
  </verify>
  <done>
    .releaserc.json is valid JSON, branches array contains both "main" and the beta prerelease object, and the plugins array is unchanged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions → npm registry | NPM_TOKEN grants publish rights; token exposed in job env |
| GitHub Actions → homebrew-queque repo | HOMEBREW_TAP_TOKEN grants write access to the tap repo |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-ntf-01 | Tampering | NPM_TOKEN in Actions env | mitigate | Token is Actions secret (masked in logs); scoped to Automation token type (publish only, no account access) |
| T-ntf-02 | Tampering | HOMEBREW_TAP_TOKEN scope | mitigate | Create PAT scoped to `repo` on `homebrew-queque` only; do not use a broad org-level token |
| T-ntf-03 | Elevation | persist-credentials: false | mitigate | Already set in release job checkout; prevents GITHUB_TOKEN leaking to git remote URL |
| T-ntf-SC | Tampering | Justintime50/homebrew-releaser@v1 | accept | Third-party action pinned to v1 major tag; action has 1k+ stars and is actively maintained; risk accepted for beta phase |
</threat_model>

<verification>
After all three tasks complete:

1. `cat .github/workflows/release.yaml` — confirm beta in branches, pnpm/action-setup@v4 in both jobs, `pnpm exec semantic-release` in release step.
2. `cat .github/workflows/homebrew.yml` — confirm trigger is `release: types: [published]`, uses Justintime50/homebrew-releaser@v1, contains HOMEBREW_TAP_TOKEN reference.
3. `node -e "console.log(JSON.stringify(require('./.releaserc.json').branches, null, 2))"` — confirm output includes main and beta prerelease object.
4. Verify no YAML parse errors: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yaml'))" && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/homebrew.yml'))"`.
</verification>

<success_criteria>
- release.yaml fires on both `main` and `beta` pushes, uses pnpm/action-setup@v4, and invokes semantic-release via pnpm exec.
- homebrew.yml fires on GitHub Release published events and delegates to homebrew-releaser with the correct tap coordinates and install/test blocks.
- .releaserc.json branches array includes the beta prerelease entry alongside main, and the full plugin chain is preserved.
- Required secrets are documented in comments within the workflow files: NPM_TOKEN and HOMEBREW_TAP_TOKEN.
</success_criteria>

<output>
Create `.planning/quick/260529-ntf-implement-release-automation-workflows-a/260529-ntf-SUMMARY.md` when done.
</output>
