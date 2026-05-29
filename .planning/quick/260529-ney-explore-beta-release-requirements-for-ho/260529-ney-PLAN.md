---
phase: quick-260529-ney
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md
autonomous: true
requirements: [BETA-DIST-01]

must_haves:
  truths:
    - "A document exists that details exact steps and artefacts needed for each distribution channel"
    - "Homebrew tap requirements are covered: formula file, binary packaging approach, versioning"
    - "zsh plugin listing requirements are covered: which registries exist, submission format, what qualifies as a zsh plugin"
    - "Zellij distinction is documented: QueQue uses Zellij but is not a Zellij plugin — correct listing channels are identified"
    - "Beta-specific caveats are noted per channel (e.g. pre-release tags, beta formula naming)"
  artifacts:
    - path: ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md"
      provides: "Research document covering all three distribution channels"
  key_links: []
---

<objective>
Research and document the exact requirements for distributing QueQue as a beta release across three channels: a Homebrew custom tap, zsh plugin listing boards, and the correct listing venue given QueQue uses Zellij but is not a Zellij plugin.

Purpose: Give the developer a clear, actionable checklist per channel so beta testers can find and install QueQue.
Output: BETA-RELEASE-REQUIREMENTS.md in the quick task directory.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Project name: queque
Binary: qq  (dist/cli/main.js, Node ESM)
Version: 0.1.0
Repo: https://github.com/k-leumas/queque
Runtime: Node LTS + TypeScript, bundled with tsup
Shell integration: zsh ZLE widget (triggers on `??`)
TUI: Ink + Zellij floating pane
Provider: Anthropic Claude API (ANTHROPIC_API_KEY)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Research Homebrew tap requirements for a Node-based CLI beta</name>
  <files>.planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md</files>
  <action>
    Use web search (WebFetch) and your knowledge to research the following, then begin writing the document.

    Homebrew tap requirements:
    - What a custom tap repo must look like (naming convention: homebrew-queque, Formula/ directory layout).
    - Formula file structure for a Node.js CLI distributed via npm/GitHub releases — key fields: url, sha256, version, depends_on :node, install block that calls system "npm", "install", "--prefix", prefix, "--global", name or equivalent.
    - Alternative: bottle approach vs. node formula approach. Since QueQue is a Node ESM package, document whether `brew install` should call `npm install -g` inside the formula or package a pre-built binary via `pkg`/`bun compile`.
    - How to publish a beta/pre-release: convention for beta formula naming (queque-beta.rb vs. versioned file), whether `@beta` suffix in tap name is common.
    - Minimum required GitHub release artefacts (tagged release, source tarball or dist tarball, SHA256 checksum).
    - How a user installs from a custom tap: `brew tap k-leumas/queque && brew install queque`.
    - Ongoing maintenance burden: each new beta release requires updating url + sha256 in the formula and creating a new GitHub release tag.

    Fetch https://docs.brew.sh/Formula-Cookbook for authoritative formula structure, and https://docs.brew.sh/Taps for tap setup. Use WebFetch.

    Document findings in ## Homebrew Tap section of BETA-RELEASE-REQUIREMENTS.md.
  </action>
  <verify>
    <automated>test -f ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md" && grep -q "Homebrew" ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md"</automated>
  </verify>
  <done>BETA-RELEASE-REQUIREMENTS.md exists and contains a ## Homebrew Tap section with formula structure, tap naming, and installation command for a user.</done>
</task>

<task type="auto">
  <name>Task 2: Research zsh plugin listing boards and Zellij community listing</name>
  <files>.planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md</files>
  <action>
    Continue writing the document by researching:

    zsh plugin listing boards:
    - awesome-zsh-plugins (unixorn/awesome-zsh-plugins on GitHub): submission process — open a PR adding an entry under the correct category. Identify the correct category for a shell-enhancement tool (likely "Utilities" or "Tools for Developers"). Document: entry format (name, link, description), whether beta projects are accepted, the PR checklist if any.
    - zsh-users (GitHub org): this is a plugin hosting org, not a listing board — clarify this distinction in the document so there is no confusion.
    - Oh My Zsh external plugins list (at ohmyz.sh or GitHub wiki): document submission method and whether a zsh widget/integration qualifies or if OMZ plugins must ship as OMZ-compatible plugin files (functions/ or completions/ layout).
    - Zinit/Zplug/Antigen: these are plugin managers, not listing boards — QueQue does not need to do anything special for them beyond being a public GitHub repo that users can reference.

    Zellij clarification:
    - QueQue is NOT a Zellij plugin (WASM-based). It uses Zellij floating panes as a display mechanism.
    - Research where Zellij community tips/integrations are listed (zellij-org/zellij GitHub Discussions, zellij.dev community page, the zellij Discord). There is no formal Zellij plugin registry for shell integrations.
    - Document the correct path: post in zellij Discussions or the community Discord as a "workflow/integration" rather than submitting to any plugin registry.
    - Note what information to include in such a post (what QueQue does, install instructions, the Zellij dependency being `zellij >= 0.38` or appropriate minimum version).

    Fetch https://github.com/unixorn/awesome-zsh-plugins (README) via WebFetch to confirm submission instructions. Fetch https://zellij.dev/documentation/ briefly to confirm there is no WASM-plugin registry for integrations.

    Append ## zsh Plugin Listings and ## Zellij Community (Not a Plugin) sections to the document.

    At the top of the document, write a ## Summary table with columns: Channel, Required Artefacts, Effort (Low/Medium/High), Beta-Friendly (Yes/No/Partial), and a one-line Action for each channel. This gives a fast orientation before the detailed sections.
  </action>
  <verify>
    <automated>grep -q "awesome-zsh-plugins" ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md" &amp;&amp; grep -q "Zellij" ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md" &amp;&amp; grep -q "Summary" ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md"</automated>
  </verify>
  <done>Document contains ## Summary table, ## zsh Plugin Listings section, and ## Zellij Community section. Each section includes actionable steps and beta-specific notes.</done>
</task>

</tasks>

<verification>
After both tasks complete, verify the document is coherent and complete:
- `cat ".planning/quick/260529-ney-explore-beta-release-requirements-for-ho/BETA-RELEASE-REQUIREMENTS.md"` — read the full document and confirm all three channels are covered, the Summary table is present, and instructions are actionable.
- Confirm the Zellij section correctly explains QueQue is NOT a Zellij plugin and points to the right community venues.
</verification>

<success_criteria>
BETA-RELEASE-REQUIREMENTS.md exists and contains:
1. A Summary table covering all three channels with effort, beta-friendliness, and one-line action per channel.
2. A ## Homebrew Tap section with: tap repo naming, formula file skeleton for a Node CLI, beta release approach, minimum GitHub release artefacts, user install command.
3. A ## zsh Plugin Listings section covering: awesome-zsh-plugins PR submission, OMZ external plugins, and clarification that plugin managers (Zinit etc.) need no special action.
4. A ## Zellij Community section clarifying QueQue is a shell integration not a WASM plugin, and directing to Discussions/Discord as the correct submission path.
</success_criteria>

<output>
Create `.planning/quick/260529-ney-explore-beta-release-requirements-for-ho/260529-ney-SUMMARY.md` when done.
</output>
