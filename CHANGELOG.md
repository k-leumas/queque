# [1.1.0](https://github.com/k-leumas/que-que/compare/v1.0.0...v1.1.0) (2026-05-02)


### Bug Fixes

* **build:** manually fix linting issues ([8149904](https://github.com/k-leumas/que-que/commit/814990466d6745e81d51bd9c7b7e1fabb4be1b3b))


### Features

* **02-01:** add request contracts ([9b96f9b](https://github.com/k-leumas/que-que/commit/9b96f9bbfecb5db0fe581b9cc42f6f0c4efa1ef1))
* **02-01:** implement classifyIntent router ([3e0b195](https://github.com/k-leumas/que-que/commit/3e0b195a38d15416137e18923c7d2cfaf5fb006a))
* **02-02:** add context pipeline and candidate selection ([3ed1520](https://github.com/k-leumas/que-que/commit/3ed1520b4377d43f9caaf89a7cf6eea3c25be508))
* **02-03:** add registry bootstrap for built-in providers ([a8b8e02](https://github.com/k-leumas/que-que/commit/a8b8e02d6589b582dd79a3ddd62fca7651dcada1))
* **ui:** add forced selector candidate mode ([908fa17](https://github.com/k-leumas/que-que/commit/908fa176bde48e01aa162227fb257a832432151f))

# 1.0.0 (2026-05-02)


### Bug Fixes

* **01:** cap per-connection buffer at 64 kb to prevent memory exhaustion (cr-03) ([0b693af](https://github.com/k-leumas/que-que/commit/0b693af21fca9647f3ef84c43687f4898e61f16b))
* **01:** check qq script exists before spawning daemon to catch missing build (wr-02) ([4726543](https://github.com/k-leumas/que-que/commit/4726543e433491904244badca8d88d05bb6bc1c3))
* **01:** clarify /dev/tty handle is a pre-flight check not a tty owner (wr-03) ([92bce4b](https://github.com/k-leumas/que-que/commit/92bce4bf42ebe6a26ea478823e9f899adeb39a00))
* **01:** document toctou window in daemon bootstrap unlink sequence (wr-01) ([a06a608](https://github.com/k-leumas/que-que/commit/a06a608ad7a250700772b141f64c616b8463287f))
* **01:** escape ttyPath and cwd through jq to prevent json injection (cr-01) ([0cdf9f7](https://github.com/k-leumas/que-que/commit/0cdf9f7513add404e4292f891959a7d0bf6c2c1d))
* **01:** validate socket path against os.tmpdir() to prevent path traversal (cr-02) ([c52f958](https://github.com/k-leumas/que-que/commit/c52f9587b073f587132bff230a4f3e12b247feb5))
* **01:** warn on unknown --result-mode values instead of silently defaulting (wr-04) ([cda875d](https://github.com/k-leumas/que-que/commit/cda875d9197f94b5aa35ec6f3f1c75fc6e974b05))
* **01:** write result file atomically via tmp+rename to prevent partial reads (wr-05) ([5d92a94](https://github.com/k-leumas/que-que/commit/5d92a94be5e84a57710fbfe22a978370aa935341))
* **ci:** guard zsh widget registration in interactive shells ([0194dcc](https://github.com/k-leumas/que-que/commit/0194dccb44e0ab998d5f52d3d5dbd771f561c430))
* **ci:** install zsh and jq for shell tests ([00e8592](https://github.com/k-leumas/que-que/commit/00e8592c9cb36d9adf298c3601a77ac7cf118a97))
* **ci:** make noninteractive zsh sourcing succeed ([3dfe93f](https://github.com/k-leumas/que-que/commit/3dfe93f776db0dc725eba006e6f0a4064bd5bf79))
* **docs:** Fix formatting of paths in SYSTEM_DESGN.md ([6ad1742](https://github.com/k-leumas/que-que/commit/6ad1742d2c6c336106d909838832ea141254051d))
* **phase-01:** revise plan prompts ([2b6f4f8](https://github.com/k-leumas/que-que/commit/2b6f4f84e6bd6d93ba4d05530419833db8f7ab66))
* **phase-1:** revise plans based on checker feedback ([475d2a9](https://github.com/k-leumas/que-que/commit/475d2a9bfbd2e558699f03833328e093696306a2))
* **release:** add semantic-release dependencies ([6c502bd](https://github.com/k-leumas/que-que/commit/6c502bd89cf3bacc255f7a1d2be66e72f0571688))
* **test:** run zsh helper tests without startup files ([07bbfb3](https://github.com/k-leumas/que-que/commit/07bbfb39f874f93a3dac123de932fba694f29d1a))


### Features

* **01-01:** implement shell and IPC contracts with socket path helper ([8ba3e29](https://github.com/k-leumas/que-que/commit/8ba3e29e2dfd4136dfc053a28af0943a694b2135))
* **01-02:** implement zsh ZLE widget with ?? trigger and result application ([6ce8139](https://github.com/k-leumas/que-que/commit/6ce813968bd109d6dfbdde30dc19dfa15379c5f2))
* **01-03:** implement daemon bootstrap, server, and CLI wiring ([faa5af3](https://github.com/k-leumas/que-que/commit/faa5af3436e9a1a030ecfc4dc4914dbe1e250587))
* **01-03:** implement foreground client loop, result writer, and client CLI wiring ([4ab40a1](https://github.com/k-leumas/que-que/commit/4ab40a12e1df966814dcf31ceac250ac68683d1e))
* **02-02:** add Task 3 — multi-candidate response and minimal selection UI ([a1e8d02](https://github.com/k-leumas/que-que/commit/a1e8d023437772205d6ec89de623fd0d07dfb504))
* add dev restart watcher ([dd774e7](https://github.com/k-leumas/que-que/commit/dd774e7d92f418dbfc3977e59fabc98e8d4ee516))
* select available claude model ([b74f2e2](https://github.com/k-leumas/que-que/commit/b74f2e26911317303208d7e344066b231ea51019))
* tighten shell bridge logging ([e8d8a1d](https://github.com/k-leumas/que-que/commit/e8d8a1d0430b85994c7c886c169e7c28409e391e))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Semantic versioning and automated changelog generation
- Automated release workflow via GitHub Actions
- Conventional Commits integration for automatic version bumping
- CI workflow for linting, type checking, testing, and building
