# QueQue Beta Release Requirements

> Research document for distributing QueQue v0.1.0 beta across three channels.
> Repo: https://github.com/k-leumas/queque
> Binary: `qq` | Package: `queque` | Runtime: Node LTS + zsh ZLE + Zellij floating pane

---

## Summary

| Channel | Required Artefacts | Effort | Beta-Friendly | Action |
|---|---|---|---|---|
| Homebrew custom tap | `homebrew-queque` GitHub repo, `queque.rb` formula, GitHub release tag with source tarball | Medium (1–2h first time) | Yes (no approval gate) | Create `k-leumas/homebrew-queque`, write formula, tag a release |
| awesome-zsh-plugins | Public GitHub repo with `README.md` and `LICENSE`, one-line PR to unixorn/awesome-zsh-plugins | Low (~30 min) | Yes (beta projects accepted) | Open PR adding entry under Plugins section |
| Oh My Zsh plugin | Add `shell/zsh/queque.plugin.zsh` wrapper (5 lines), update README | Low (~30 min) | Yes | Create wrapper, test, update README with OMZ install section |
| Zellij community | No formal registry exists for shell integrations | Low (~15 min) | Yes | Post in zellij-org/zellij GitHub Discussions and Zellij Discord |
| Release automation | `.github/workflows/release.yml` + homebrew-releaser, npm token, PAT | Medium (2–3h setup) | Yes (one-time) | Wire semantic-release CI + homebrew-releaser so every merge auto-releases |

---

## Homebrew Tap

### What a Homebrew Tap Is

A tap is a Git repository (on GitHub) whose name starts with `homebrew-`. Homebrew clones it and treats its `Formula/` directory as a searchable package registry. Custom taps let you distribute software without waiting for homebrew-core approval.

### Tap Repository Naming

GitHub repository must be named: `homebrew-queque`
Full path: `https://github.com/k-leumas/homebrew-queque`
Short tap alias: `k-leumas/queque`

When users run `brew tap k-leumas/queque`, Homebrew automatically expands that to `k-leumas/homebrew-queque`.

### Required Repository Layout

```
homebrew-queque/
  Formula/
    queque.rb        # the formula file
  README.md          # recommended; explains what the tap provides
```

Homebrew requires the `Formula/` directory. Nothing else is mandatory.

### Formula File: Node CLI Approach

Homebrew provides a `std_npm_args` helper specifically for Node packages. The formula downloads the npm tarball directly from the npm registry and installs via `npm install` into a Homebrew-managed `libexec` directory, then symlinks the binary into `bin/`.

This is the **recommended approach** for Node CLIs distributed via npm — it is used by Vercel CLI, Netlify CLI, and similar tools.

```ruby
class Queque < Formula
  desc "ZSH assistant that opens from ?? — turns natural language into shell commands"
  homepage "https://github.com/k-leumas/queque"
  url "https://registry.npmjs.org/queque/-/queque-0.1.0.tgz"
  sha256 "<sha256-of-tarball>"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  def caveats
    <<~EOS
      QueQue requires shell integration to activate the ?? trigger.
      Add the following to your ~/.zshrc:

        source $(brew --prefix)/lib/node_modules/queque/shell/zsh/qq.zsh

      You also need ANTHROPIC_API_KEY set in your environment.
      QueQue uses Zellij for its floating pane UI (zellij must be installed).
    EOS
  end

  test do
    assert_match "queque", shell_output("#{bin}/qq --version")
  end
end
```

**Key formula fields:**

| Field | Value | Notes |
|---|---|---|
| `url` | `https://registry.npmjs.org/queque/-/queque-0.1.0.tgz` | npm registry tarball — preferred over GitHub tarballs |
| `sha256` | computed at release time | see SHA256 section below |
| `depends_on "node"` | Node LTS | Homebrew installs Node if absent |
| `std_npm_args` | Homebrew helper | installs to `libexec`, not global `node_modules` |
| `bin.install_symlink` | links `qq` binary | makes `qq` available on `$PATH` |

### Formula Naming: Beta Conventions

For a beta release, two approaches are common:

**Option A: Single versioned formula file (recommended for taps)**
Name the formula `queque.rb` but point its `url` at the beta tarball. Users pin to the tap version. When you promote to stable, update `url` + `sha256` + version.

**Option B: Separate beta formula**
Name it `queque-beta.rb` with class `QueQueBeta`. Users explicitly `brew install k-leumas/queque/queque-beta`. Useful if you want stable and beta installable side-by-side, but adds maintenance overhead.

Recommendation for QueQue v0.1.0: use Option A with the formula named `queque.rb`. The tap is already a signal that this is pre-official; no `@beta` suffix in the tap name is needed.

### Getting the SHA256

After publishing to npm (or creating a GitHub release tarball):

```bash
# From npm registry (after npm publish)
curl -sL "https://registry.npmjs.org/queque/-/queque-0.1.0.tgz" | shasum -a 256

# Or download and hash locally
curl -o queque-0.1.0.tgz "https://registry.npmjs.org/queque/-/queque-0.1.0.tgz"
shasum -a 256 queque-0.1.0.tgz
```

Copy the hex string into the formula's `sha256` field.

### Minimum GitHub Release Artefacts

Homebrew does not require GitHub releases — it pulls directly from the npm registry. However a GitHub release tag is strongly recommended for the changelog and discoverability:

1. `git tag v0.1.0` and `git push origin v0.1.0`
2. Create a GitHub Release from that tag (can be marked as Pre-release)
3. GitHub will auto-generate a source tarball — you do not need to upload anything manually

The formula's `url` points at npm, not GitHub, so the GitHub release is informational only.

### Bottle Approach vs. npm Approach

Homebrew bottles are pre-compiled binary tarballs that Homebrew hosts. For Node CLIs there is no compilation step, so bottles are not needed for the first release. Core Homebrew formulae for Node packages add bottles later to speed up install time (no npm call). For a custom tap, **skip bottles entirely** — they require infrastructure and are not worth the maintenance for a beta.

### User Install Command

```zsh
brew tap k-leumas/queque
brew install queque
```

Or in a single command:

```zsh
brew install k-leumas/queque/queque
```

### Ongoing Maintenance Burden

Every new release requires:
1. Publish the new version to npm (`npm publish`)
2. Compute `sha256` of the new tarball
3. Update `url` (version in URL) and `sha256` in `queque.rb`
4. Commit and push to `homebrew-queque`
5. Users get the update on next `brew update && brew upgrade queque`

Estimated time per release update: 5–10 minutes.

### npm Name Conflict Warning

The `queque` name on npm is currently registered at version `0.0.0` by a different author (Yuichiro Mori). Before publishing, confirm whether this package is abandoned or claim the name through npm support. If the name cannot be claimed, the Homebrew formula `url` can point to a GitHub release tarball instead of the npm registry:

```ruby
url "https://github.com/k-leumas/queque/archive/refs/tags/v0.1.0.tar.gz"
sha256 "<sha256-of-github-tarball>"
```

GitHub tarballs work fine in formulas — the npm tarball is only preferred for smaller download size (no devDependencies). For a beta, the GitHub tarball approach is acceptable.

---

## zsh Plugin Listings

### awesome-zsh-plugins (Primary Target)

**What it is:** The canonical community-maintained list of zsh plugins, frameworks, and tools. Hosted at [github.com/unixorn/awesome-zsh-plugins](https://github.com/unixorn/awesome-zsh-plugins). Over 2,500 entries; well-indexed and referenced by plugin manager documentation.

**Whether beta projects are accepted:** Yes. There is no stability requirement in the contributing guidelines. The requirements are: a `README.md`, a `LICENSE` file, and a working public GitHub repo.

**Correct section:** The `## Plugins` section. QueQue is a ZSH plugin that augments ZLE (line editor) with AI-powered command suggestions. Precedents already listed in the Plugins section include:
- `ai-cmd` — Natural language to shell commands with ghost text preview, requires Anthropic API key
- `ai-commands` — Asks GPT for CLI commands
- `claude` — AI-powered command suggestions using Claude AI

QueQue fits directly in alphabetical order under `q` in the Plugins section.

**Submission process:**
1. Fork `unixorn/awesome-zsh-plugins`
2. Add one line in alphabetical order under `## Plugins`:
   ```markdown
   - [queque](https://github.com/k-leumas/queque) - Natural language to shell command assistant triggered by typing `??` in ZSH. Uses Claude AI via `ANTHROPIC_API_KEY`. Returns the suggested command directly into your live ZSH buffer. Requires Zellij for the floating pane UI.
   ```
3. Open a PR. GitHub Actions will run lint/link checks — ensure the repo URL is public and the README and LICENSE files exist before submitting.

**PR checklist (from Contributing.md):**
- Entry is a single line ending in a period
- Alphabetically sorted in its section
- Link is the first element on the line
- No leading/trailing `zsh-plugin` in the visible link text
- Repo has a `README.md` and a `LICENSE` file

**Estimated effort:** 15–30 minutes (mostly writing the README and LICENSE if not done yet).

### zsh-users (GitHub Organization)

**Clarification:** `zsh-users` (github.com/zsh-users) is a GitHub organization that *hosts* canonical community zsh plugins (zsh-autosuggestions, zsh-syntax-highlighting, etc.). It is **not** a listing board and does not have a submission process. Getting a plugin into zsh-users requires being a widely-adopted project with existing maintainers — not applicable for a beta. **No action needed here.**

### Oh My Zsh External Plugins Wiki

**What it is:** A GitHub wiki page listing third-party plugins compatible with Oh My Zsh.

**Qualification requirement:** OMZ plugins must follow the OMZ plugin file layout: a directory with the plugin name containing a `<name>.plugin.zsh` file, optionally a `functions/` or `completions/` subdirectory. QueQue is a ZLE widget integration, not an OMZ plugin — it does not ship a `.plugin.zsh` entry point that OMZ can source via `plugins=(queque)`.

**Verdict:** QueQue does not qualify for the OMZ external plugins list in its current form. To qualify, a thin `queque.plugin.zsh` wrapper would need to be added that sources `qq.zsh` and is compatible with the OMZ plugin loading mechanism. This is a low-effort addition (5–10 lines) but is optional for the beta.

If you add the OMZ compatibility wrapper, submission is: edit the wiki page directly (requires being a GitHub wiki contributor) or open an issue asking for an addition.

### Plugin Managers (Zinit, Zplug, Antigen, Antidote)

**Clarification:** Zinit, Zplug, Antigen, and Antidote are plugin *managers*, not listing boards. Users install any public GitHub repo with them directly:

```zsh
# Zinit
zinit load k-leumas/queque

# Antidote
echo "k-leumas/queque" >> ~/.zsh_plugins.txt
antidote bundle

# Zplug
zplug "k-leumas/queque"
```

**No submission or registration is required.** As long as QueQue is a public GitHub repo with a `qq.zsh` (or a `queque.plugin.zsh` for OMZ-style managers), users can reference it. The only prerequisite is that `shell/zsh/qq.zsh` is at a predictable path and the README documents which file to source.

---

## Zellij Community (QueQue Is NOT a Zellij Plugin)

### Critical Distinction

**QueQue is NOT a Zellij plugin.** Zellij plugins are WebAssembly modules compiled from Rust, Zig, or any WASM target. They implement the Zellij plugin API (`ZellijPlugin` trait), are distributed as `.wasm` files, and are loaded inside Zellij's plugin sandbox.

QueQue *uses* Zellij as a display mechanism: when the `??` ZLE widget fires, it calls `zellij action new-pane --floating --name qq` to spawn a floating pane, then runs the `qq` Node process inside it. This is a shell integration that happens to use Zellij's floating pane feature. QueQue has no `.wasm` artifact and no Zellij plugin manifest.

**Do not submit to any Zellij plugin registry.**

### Where Zellij Community Integrations Are Listed

**awesome-zellij** (`github.com/zellij-org/awesome-zellij`) has an `# Integrations` section specifically for tools that use Zellij as a component but are not plugins:

```markdown
# Integrations

* [fzf-zellij](https://github.com/k-kuroguro/fzf-zellij) Shell script to start fzf in a Zellij floating pane.
* [zide](https://github.com/josephschmitt/zide) Zellij layouts + bash scripts to create an IDE-like file picker and editor workflow
```

QueQue belongs in this `# Integrations` section. `fzf-zellij` is a direct structural precedent: a shell script that opens a tool in a Zellij floating pane.

**Submission process for awesome-zellij:**
1. Fork `zellij-org/awesome-zellij`
2. Add one line under `# Integrations` (alphabetical order by project name):
   ```markdown
   * [queque](https://github.com/k-leumas/queque) ZSH assistant triggered by typing `??` — displays AI-powered command suggestions in a Zellij floating pane and writes the selected command back to the shell buffer. Requires `zellij >= 0.38`.
   ```
3. Open a PR.

**Zellij minimum version:** QueQue uses `zellij action new-pane --floating --name qq`. The `--floating` flag for `new-pane` was introduced in Zellij 0.38. Specify `zellij >= 0.38` in documentation.

### Zellij Discord

The Zellij Discord server ([discord.gg/CrUAFH3](https://discord.gg/CrUAFH3)) has channels for community sharing. A brief post in the relevant channel (typically `#show-and-tell` or `#plugins`) with a short description and install instructions will reach Zellij users who use floating panes for workflow tools.

**What to include in a Discord post:**
- What QueQue does in one sentence
- The `??` trigger and how it fits into terminal workflow
- Install command: `brew tap k-leumas/queque && brew install queque` (or `npm install -g queque` if npm name is resolved)
- The Zellij dependency and minimum version (`>= 0.38`)
- Screenshot or demo GIF of the floating pane in action

### Zellij GitHub Discussions

Open a new Discussion in `zellij-org/zellij` under the "Show and Tell" or "General" category. Include the same content as the Discord post. GitHub Discussions are indexed and searchable, making this more durable than Discord.

---

## Checklist: Minimum Viable Beta Launch

### Before any distribution

- [ ] Resolve npm name conflict for `queque` (confirm k-leumas owns or can claim the name)
- [ ] Ensure `README.md` exists and covers: what QueQue does, prerequisites (Node, zsh, Zellij, ANTHROPIC_API_KEY), install steps, the `??` trigger
- [ ] Ensure `LICENSE` file exists (required by awesome-zsh-plugins)
- [ ] Tag a GitHub release: `git tag v0.1.0-beta.1 && git push origin v0.1.0-beta.1`
- [ ] Optionally publish to npm: `npm publish --tag beta` (this makes `npm install -g queque@beta` work)

### Homebrew tap (Medium effort, ~1–2 hours first time)

- [ ] Create GitHub repo `k-leumas/homebrew-queque`
- [ ] Create `Formula/queque.rb` using the skeleton above
- [ ] Compute SHA256 of the release tarball and insert into formula
- [ ] Push formula to `homebrew-queque`
- [ ] Test locally: `brew tap k-leumas/queque && brew install queque`
- [ ] Verify `qq --version` works after install
- [ ] Verify `caveats` text is printed and `.zshrc` sourcing instructions are correct

### awesome-zsh-plugins (Low effort, ~30 minutes)

- [ ] Confirm README and LICENSE exist in the repo
- [ ] Fork `unixorn/awesome-zsh-plugins`
- [ ] Add one-line entry alphabetically under `## Plugins`
- [ ] Open PR; wait for GitHub Actions checks to pass
- [ ] PR is typically merged within a few days for well-formed entries

### awesome-zellij Integrations (Low effort, ~15 minutes)

- [ ] Fork `zellij-org/awesome-zellij`
- [ ] Add one-line entry under `# Integrations`
- [ ] Open PR

### Zellij Discord / GitHub Discussions (Low effort, ~15 minutes)

- [ ] Post in Zellij Discord `#show-and-tell` channel
- [ ] Open a GitHub Discussion in `zellij-org/zellij`

---

## Oh My Zsh Plugin

### Making QueQue an OMZ-Compatible Plugin

The existing `shell/zsh/qq.zsh` is a ZLE widget script, not an OMZ plugin. OMZ loads plugins by sourcing `plugins/<name>/<name>.plugin.zsh`. Adding a thin wrapper makes QueQue installable via `plugins=(queque)` in `.zshrc`.

**File to create: `shell/zsh/queque.plugin.zsh`**

```zsh
# QueQue OMZ plugin entry point
# Sources the ZLE widget integration from the same directory.
local _queque_dir="${0:A:h}"
source "${_queque_dir}/qq.zsh"
```

`${0:A:h}` resolves the directory containing the plugin file regardless of where it is installed — required for Homebrew, Zinit, and manual installs that put the plugin at non-standard paths.

**OMZ install method (manual, not the plugin manager path):**

```zsh
# In .zshrc
plugins=(... queque)
```

OMZ will look for `${ZSH_CUSTOM}/plugins/queque/queque.plugin.zsh` (user-installed) or `${ZSH}/plugins/queque/queque.plugin.zsh` (core). Users clone the repo into `$ZSH_CUSTOM/plugins/queque/`.

**Repository layout after adding the wrapper:**

```
shell/zsh/
  qq.zsh                   # existing ZLE widget
  queque.plugin.zsh        # thin OMZ entry point (new)
```

### Submitting to the OMZ External Plugins Wiki

The Oh My Zsh external plugins wiki is at:
`https://github.com/ohmyzsh/ohmyzsh/wiki/External-plugins`

**Submission process:**
1. Add the `queque.plugin.zsh` wrapper to the repo
2. Open an Issue in `ohmyzsh/ohmyzsh` requesting a wiki addition, or request edit access to the wiki directly (GitHub wiki contributors)
3. Add entry under the relevant section (AI/Developer Tools)

The wiki is not heavily maintained — the preferred route for discovery is the **awesome-zsh-plugins** PR (covered above), which is more active and widely referenced by plugin managers.

### OMZ User Install Command

```zsh
# Clone into OMZ custom plugins directory
git clone https://github.com/k-leumas/queque ${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins/queque

# Then add to .zshrc
plugins=(... queque)
```

### Checklist: OMZ Compatibility (Low effort, ~30 minutes)

- [ ] Create `shell/zsh/queque.plugin.zsh` (thin wrapper sourcing `qq.zsh`)
- [ ] Test locally: clone into `$ZSH_CUSTOM/plugins/queque`, add to plugins array, `exec zsh`
- [ ] Verify `??` trigger activates after OMZ load
- [ ] Update README with OMZ install section
- [ ] Submit awesome-zsh-plugins PR (OMZ entry in wiki is optional — PR reaches more users)

---

## Release Automation

### Existing Setup

The project already uses **semantic-release** (`package.json` includes the full plugin chain). Configured plugins:
- `@semantic-release/commit-analyzer` — determines version bump from conventional commits
- `@semantic-release/release-notes-generator` — generates changelog body
- `@semantic-release/changelog` — writes `CHANGELOG.md`
- `@semantic-release/npm` — publishes to npm
- `@semantic-release/github` — creates GitHub Release with notes
- `@semantic-release/git` — commits `CHANGELOG.md` + `package.json` back to main

**What is missing:** A GitHub Actions CI/CD workflow to run semantic-release on push to `main`.

### GitHub Actions Workflow (Minimum Viable)

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - run: pnpm test:run

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: pnpm exec semantic-release
```

**Required secrets:**
| Secret | Where to add | Notes |
|---|---|---|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | Needs `contents: write` permission |
| `NPM_TOKEN` | Settings → Secrets → Actions | Create at npmjs.com → Access Tokens → Automation token |

### Beta Release via semantic-release

To cut a beta release from a non-main branch, add a `beta` branch to `.releaserc.json`:

```json
{
  "branches": [
    "main",
    { "name": "beta", "prerelease": true }
  ],
  ...
}
```

Push commits to the `beta` branch → semantic-release cuts `1.0.0-beta.1` (or `0.2.0-beta.1`) automatically. npm gets the version tagged as `beta`. Users install with `npm install -g queque@beta`.

Alternatively, for an immediate one-off beta without a `beta` branch, publish manually:
```bash
npm version 0.1.0-beta.1 --no-git-tag-version
npm publish --tag beta
git tag v0.1.0-beta.1 && git push origin v0.1.0-beta.1
```

### Automated Homebrew Tap Update

After semantic-release publishes a new npm version, the Homebrew formula (`Formula/queque.rb`) needs its `url` and `sha256` updated. Two approaches:

**Option A: `homebrew-releaser` GitHub Action (Recommended)**

[Homebrew Releaser](https://github.com/Justintime50/homebrew-releaser) is a GitHub Action that updates your tap formula automatically after a GitHub Release is created.

Add to `.github/workflows/homebrew.yml` in the **main QueQue repo** (not the tap repo):

```yaml
name: Update Homebrew Tap

on:
  release:
    types: [published]

jobs:
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
          commit_email: your@email.com
          install: |
            system "npm", "install", *std_npm_args
            bin.install_symlink Dir["#{libexec}/bin/*"]
          test: |
            assert_match "queque", shell_output("#{bin}/qq --version")
          depends_on: '"node"'
          skip_commit: false
```

**Required:** A Personal Access Token with `repo` scope on `k-leumas/homebrew-queque`, stored as `HOMEBREW_TAP_TOKEN` in the main repo's secrets.

**Option B: Manual update script**

If `homebrew-releaser` is overkill for a beta, a simpler shell script in `scripts/update-tap.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: update-tap.sh <version>}"
TAP_DIR="${2:?Usage: update-tap.sh <version> <path-to-homebrew-queque>}"

TARBALL_URL="https://registry.npmjs.org/queque/-/queque-${VERSION}.tgz"
SHA256=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

sed -i '' \
  -e "s|url \".*\"|url \"${TARBALL_URL}\"|" \
  -e "s|sha256 \".*\"|sha256 \"${SHA256}\"|" \
  "${TAP_DIR}/Formula/queque.rb"

echo "Updated formula to v${VERSION} (sha256: ${SHA256})"
```

Run after each npm publish: `./scripts/update-tap.sh 0.1.0 ../homebrew-queque`

### Full Automated Release Flow (End-to-End)

With the GitHub Actions setup in place, the full release flow becomes:

1. **Merge to `main`** → GitHub Actions runs tests + build
2. **semantic-release analyzes commits** → determines version bump (patch/minor/major)
3. **semantic-release publishes** → npm (with `latest` tag), GitHub Release (with notes + tarball), CHANGELOG.md commit
4. **GitHub Release `published` event fires** → `homebrew-releaser` updates `Formula/queque.rb` in `k-leumas/homebrew-queque` with new `url` + `sha256`
5. **Users get updates** via `brew upgrade queque` or `npm update -g queque`

**Developer effort per release after setup:** `git push origin main` (commits do the rest).

### Checklist: Release Automation (Medium effort, ~2–3 hours total)

#### One-time setup
- [ ] Resolve npm name `queque` conflict (prerequisite for npm publishing)
- [ ] Create GitHub repo `k-leumas/homebrew-queque` with initial `Formula/queque.rb`
- [ ] Create npm Automation token at npmjs.com → add as `NPM_TOKEN` in GitHub repo secrets
- [ ] Create PAT with `repo` scope → add as `HOMEBREW_TAP_TOKEN` in GitHub repo secrets
- [ ] Create `.github/workflows/release.yml` (semantic-release CI)
- [ ] Create `.github/workflows/homebrew.yml` (homebrew-releaser trigger)
- [ ] Add `beta` branch config to `.releaserc.json` if using branch-based beta flow

#### Per-beta release
- [ ] Push commits to `beta` branch (or `main` with pre-release version)
- [ ] Confirm semantic-release created the GitHub Release and npm tag
- [ ] Confirm Homebrew formula was updated
- [ ] Run `brew upgrade queque` locally to verify

---

## Notes on npm Distribution

Even without resolving the Homebrew tap, users can install QueQue via npm once the name conflict is resolved:

```zsh
npm install -g queque           # stable
npm install -g queque@beta      # beta tag (requires npm publish --tag beta)
```

The npm install does not set up shell integration automatically — users still need to add `source` line to `.zshrc`. Document this clearly in the README and npm page description.

Beta npm tag conventions: publish with `npm publish --tag beta` so `npm install -g queque` does not install the beta by default. Only `npm install -g queque@beta` or `npm install -g queque@0.1.0-beta.1` will install the pre-release.
