---
created: 2026-11-15
title: "Update notifier: tell users a new qq exists and how to upgrade"
area: daemon
source: chat design discussion, 2026-11-15
---

## Problem

Nothing tells users a newer qq is out. Homebrew tap users only get it on `brew upgrade`;
npm users only on a manual reinstall. Stale-daemon replacement after an upgrade already works
(bug-473, `daemon outdated` in doctor); this is about prompting the upgrade itself.

## Goal

A quiet, once-a-day hint naming the exact upgrade command for how *this* qq was installed,
or no command at all when we can't know. A wrong command is worse than none.

## Behavior

- **Check lives in the daemon** so `??` never waits on it. At most once per 24 h, fetch
  `https://registry.npmjs.org/@k-leumas/queque-cli/latest` with a ~1.5 s timeout. Cache
  `{ checkedAt, latest, enginesNode }` in the existing qq state dir (XDG cache on Linux,
  `~/Library/Caches` on macOS). Any error → silent, retry next window.
- **Compare** with semver against the running version. If newer, also compare `engines.node`
  with `process.version`; if the user's Node is too old, the hint says
  `qq X needs Node N+; you have M` instead of an upgrade command.
- **Show** one dim line in the client (ControlsLine or after the result), max once per day:
  `qq 0.10.0 available · brew upgrade queque`.
- **`qq doctor`** gets an "update available" row (latest, install method, command).
- **Skip entirely** when `QQ_NO_UPDATE_CHECK=1`, `CI` is set, or stdout is not a TTY.
  Document the opt-out in the README next to the telemetry section.

## Install-method detection — `detectInstall(): { method, upgradeCommand | null }`

Answers "who installed qq", not "which package manager exists" — do NOT reuse
`pickInstaller()` (an npm install on Arch would wrongly get `pacman`). Reuse its installer
IDs / `LINUX_INSTALLER_ORDER` naming where it fits. Resolve `realpath` of the binary, then:

1. **Marker file** next to `dist/` (`.install-source`, JSON `{ source, upgrade }`) written by
   the Homebrew formula's `install` block and any future distro package (AUR, OBS, .deb).
   If present, print `upgrade` verbatim. Add the write to the formula in `homebrew.yml` /
   `release.yaml`.
2. **Path match** (no marker):
   - `/Cellar/queque/` → `brew upgrade queque` (macOS and Linuxbrew)
   - `~/.volta` → `volta install @k-leumas/queque-cli`
   - pnpm global dir → `pnpm add -g @k-leumas/queque-cli`
   - `.nvm` / `fnm` / other npm global → `npm i -g @k-leumas/queque-cli@latest`
     (nvm/fnm: note it upgrades that Node version only; non-writable global dir → suggest a
     user npm prefix rather than `sudo`)
   - `/nix/store` → no hint
3. **Package-owner query**, only when the path is under `/usr` and unmatched. First that
   succeeds wins; run once in the daemon and cache:
   - `dpkg -S <path>` → `sudo apt install --only-upgrade queque`
   - `rpm -qf <path>` → frontend from `/etc/os-release` (`ID`/`ID_LIKE`): suse → `sudo zypper up queque`,
     fedora/rhel → `sudo dnf upgrade queque`
   - `pacman -Qo <path>` → `pacman -Qm queque` foreign = AUR ("update via your AUR helper",
     no command); else `sudo pacman -Syu`
   - unowned → npm fallback
4. **Distro-packaged installs** (marker or owner query hit): wording is
   "upstream X released; your package may not have it yet" — packages lag npm.
5. **Unknown** → `qq X available` + release link, no command.

## Out of scope

Self-updating, native Windows (WSL is covered by the Linux path; if a `/mnt/c/` Node is
detected, warn instead of hinting), `qq upgrade` command (follow-up; would stop the daemon
first, needed on Windows for file locks).

## Acceptance

- Unit tests for `detectInstall()` with faked realpaths, markers, and owner-command outputs
  for every row above (brew mac/linux, volta, pnpm, nvm, system npm, nix, dpkg, rpm on suse
  and fedora, pacman repo and AUR, unknown).
- Tests for: 24 h cache, offline/timeout is silent, opt-out env, non-TTY skip, engines
  mismatch message, once-per-day display.
- Distro CI matrix and vitest never hit the registry (env opt-out set).
- `qq doctor` shows the row; README documents the opt-out.
