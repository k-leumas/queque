# [0.2.0-beta.5](https://github.com/k-leumas/queque/compare/v0.2.0-beta.4...v0.2.0-beta.5) (2026-05-30)


### Bug Fixes

* qq init zsh outputs source line instead of inlining script ([3ec5c12](https://github.com/k-leumas/queque/commit/3ec5c123431771eb5ab0ee3f6865d43459e1aea2))

# [0.2.0-beta.4](https://github.com/k-leumas/queque/compare/v0.2.0-beta.3...v0.2.0-beta.4) (2026-05-30)

# [0.2.0-beta.3](https://github.com/k-leumas/queque/compare/v0.2.0-beta.2...v0.2.0-beta.3) (2026-05-30)

# [0.2.0-beta.2](https://github.com/k-leumas/queque/compare/v0.2.0-beta.1...v0.2.0-beta.2) (2026-05-30)


# [0.2.0-beta.1](https://github.com/k-leumas/queque/compare/v0.1.0...v0.2.0-beta.1) (2026-05-30)


### Features

* add `qq init zsh` command — outputs shell integration to stdout for easy `.zshrc` setup ([5177106](https://github.com/k-leumas/queque/commit/5177106062547524c70216edead6e00eabc56dfd24))


# 0.1.0 (2026-05-23)

Initial release.

* `??` trigger via ZLE widget — type intent before `??`, get a ranked list of shell commands
* Inline selection UI with fuzzy search; selected command lands in the shell buffer, not executed
* Zellij support — opens in a floating pane when inside Zellij, inline otherwise
* Daemon/client architecture — background daemon keeps provider state warm across invocations
* Claude integration via `ANTHROPIC_API_KEY`
* Homebrew tap distribution (`brew tap k-leumas/queque && brew install queque-cli`)
