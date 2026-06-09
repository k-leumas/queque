## [0.3.3](https://github.com/k-leumas/queque/compare/v0.3.2...v0.3.3) (2026-06-09)

## [0.3.2](https://github.com/k-leumas/queque/compare/v0.3.1...v0.3.2) (2026-06-09)

## [0.3.1](https://github.com/k-leumas/queque/compare/v0.3.0...v0.3.1) (2026-06-09)

# [0.3.0](https://github.com/k-leumas/queque/compare/v0.2.13...v0.3.0) (2026-06-09)


### Bug Fixes

* **build:** add src/ path to paths watched by the build dashboard script ([1e59602](https://github.com/k-leumas/queque/commit/1e59602c84ced74cb2b54058b9f99b557c7fec34))
* cap modal width at terminal columns to fix title stacking in zellij ([58a1b96](https://github.com/k-leumas/queque/commit/58a1b969198078dd4f890eb6bd32c0b38179cc54))
* prevent Ink raw mode crash and fix env-file CWD search in production ([c34d242](https://github.com/k-leumas/queque/commit/c34d242bd854d95ffc882776c41593073972f2a2))
* prevent title repeat in zellij modal by setting flexGrow={0} ([0807ead](https://github.com/k-leumas/queque/commit/0807ead047f09aea602be50510afaf9700fedb3c))
* surface provider errors visibly in terminal on ?? ([dae2aba](https://github.com/k-leumas/queque/commit/dae2abab6f5d35dd8b3f3eac1949b7ac51ef33df))
* use plain print for error so ZLE positions error message above next prompt ([b3fbb85](https://github.com/k-leumas/queque/commit/b3fbb8584c231530fda216a5ac8747faa91fd473))
* write errors to TTY directly so they are always visible ([8fee954](https://github.com/k-leumas/queque/commit/8fee954423c014229c87bd7928fa2a8c71f11bd8))


### Features

* embed git SHA + version in bundle; show dev badge in TUI ([e8d94bb](https://github.com/k-leumas/queque/commit/e8d94bb8298bffd385533e97f9c19a8258f26222))

## [0.2.13](https://github.com/k-leumas/queque/compare/v0.2.12...v0.2.13) (2026-06-04)


### Bug Fixes

* resolve symlink in isDirectRun check so Homebrew binary invokes main ([a46d7a5](https://github.com/k-leumas/queque/commit/a46d7a5a52087a7532a2e1c096430a30319b4231))

## [0.2.12](https://github.com/k-leumas/queque/compare/v0.2.11...v0.2.12) (2026-06-04)


### Bug Fixes

* err only logs in prod + add guard for zsh install script append zhrc ([ef82529](https://github.com/k-leumas/queque/commit/ef825293f2aa6123d65d89b8e575b616f255244b))
* resolve biome lint errors and tighten lefthook to staged files ([9f926c6](https://github.com/k-leumas/queque/commit/9f926c66bde83c5348bc9b4bb55d3134ed328ede))

## [0.2.11](https://github.com/k-leumas/queque/compare/v0.2.10...v0.2.11) (2026-05-30)


### Bug Fixes

* skip lefthook install when not in a git repo ([8035e23](https://github.com/k-leumas/queque/commit/8035e23b03b463adf61f230baa128ffba79dfa29))

## [0.2.10](https://github.com/k-leumas/queque/compare/v0.2.9...v0.2.10) (2026-05-30)


### Bug Fixes

* build dist before npm global install in homebrew formula ([6a4b60d](https://github.com/k-leumas/queque/commit/6a4b60d3c4bce091990a382e8128fcb975ca3fa5))

## [0.2.9](https://github.com/k-leumas/queque/compare/v0.2.8...v0.2.9) (2026-05-30)


### Bug Fixes

* symlink qq binary directly from npm libexec path in homebrew formula ([3736a05](https://github.com/k-leumas/queque/commit/3736a05228d69378a5a307b1a40befb758e657f1))

## [0.2.8](https://github.com/k-leumas/queque/compare/v0.2.7...v0.2.8) (2026-05-30)


### Bug Fixes

* use whence -p in widget to bypass qq shell function when resolving binary ([dcc1623](https://github.com/k-leumas/queque/commit/dcc1623e4f70651b6a6bd0231686d5207a2f936b))

## [0.2.7](https://github.com/k-leumas/queque/compare/v0.2.6...v0.2.7) (2026-05-30)

## [0.2.6](https://github.com/k-leumas/queque/compare/v0.2.5...v0.2.6) (2026-05-30)

## [0.2.5](https://github.com/k-leumas/queque/compare/v0.2.4...v0.2.5) (2026-05-30)

## [0.2.4](https://github.com/k-leumas/queque/compare/v0.2.3...v0.2.4) (2026-05-30)

## [0.2.3](https://github.com/k-leumas/queque/compare/v0.2.2...v0.2.3) (2026-05-30)

## [0.2.2](https://github.com/k-leumas/queque/compare/v0.2.1...v0.2.2) (2026-05-30)

## [0.2.1](https://github.com/k-leumas/queque/compare/v0.2.0...v0.2.1) (2026-05-30)

# [0.2.0](https://github.com/k-leumas/queque/compare/v0.1.0...v0.2.0) (2026-05-30)


### Features

* add qq init command and rename shell script to queque.zsh ([c7a1b56](https://github.com/k-leumas/queque/commit/c7a1b560e50cd14e18f4380758406ecc1699c0e9))

# 1.0.0 (2026-05-23)


### Bug Fixes

* **01:** cap per-connection buffer at 64 kb to prevent memory exhaustion (cr-03) ([0b693af](https://github.com/k-leumas/que-que/commit/0b693af21fca9647f3ef84c43687f4898e61f16b))
* **01:** check qq script exists before spawning daemon to catch missing build (wr-02) ([4726543](https://github.com/k-leumas/que-que/commit/4726543e433491904244badca8d88d05bb6bc1c3))
* **01:** clarify /dev/tty handle is a pre-flight check not a tty owner (wr-03) ([92bce4b](https://github.com/k-leumas/que-que/commit/92bce4bf42ebe6a26ea478823e9f899adeb39a00))
* **01:** document toctou window in daemon bootstrap unlink sequence (wr-01) ([a06a608](https://github.com/k-leumas/que-que/commit/a06a608ad7a250700772b141f64c616b8463287f))
* **01:** escape ttyPath and cwd through jq to prevent json injection (cr-01) ([0cdf9f7](https://github.com/k-leumas/que-que/commit/0cdf9f7513add404e4292f891959a7d0bf6c2c1d))
* **01:** validate socket path against os.tmpdir() to prevent path traversal (cr-02) ([c52f958](https://github.com/k-leumas/que-que/commit/c52f9587b073f587132bff230a4f3e12b247feb5))
* **01:** warn on unknown --result-mode values instead of silently defaulting (wr-04) ([cda875d](https://github.com/k-leumas/que-que/commit/cda875d9197f94b5aa35ec6f3f1c75fc6e974b05))
* **01:** write result file atomically via tmp+rename to prevent partial reads (wr-05) ([5d92a94](https://github.com/k-leumas/que-que/commit/5d92a94be5e84a57710fbfe22a978370aa935341))
* **03:** add confidence field to classifyIntent call (cr-01) ([aef66e1](https://github.com/k-leumas/que-que/commit/aef66e1506ca3595dd26a52608de7d2b1021db46))
* **03:** add TODO for daemon socket auth (CR-005) ([a3b09a3](https://github.com/k-leumas/que-que/commit/a3b09a355e72b217d42753f4367fedbec6ad6925))
* **03:** await writeShellResult in fetch catch handler (wr-01) ([aca8436](https://github.com/k-leumas/que-que/commit/aca843678e02b8c0d61f0b6854a91df82afbff6e))
* **03:** CR-001/IN-001 fix stale DEFAULT_MODEL, CR-007 add API timeout, WR-007 guard suggestShellResult ([52f1787](https://github.com/k-leumas/que-que/commit/52f17877cf962c9337d0aefdb5a5d165d860b4b6))
* **03:** CR-002 guard Enter handler against empty visible list ([03973ea](https://github.com/k-leumas/que-que/commit/03973ea1e16a37b57d3630e24d7ab9c5ee78b31d))
* **03:** CR-003 validate cwd in shell schema and git-context provider ([b3d7c42](https://github.com/k-leumas/que-que/commit/b3d7c4284a04dd089803e873968df494ba647a4b))
* **03:** CR-004 check buffer size before appending chunk ([bee3a95](https://github.com/k-leumas/que-que/commit/bee3a95196c16b09c174c86f83069112b5d94328))
* **03:** CR-006/IN-002 secure tmpdir for FIFO, top-level cleanup fn ([5d934f0](https://github.com/k-leumas/que-que/commit/5d934f0cc80d77e3f547d9a88ffcae22378898af))
* **03:** guard jq calls in replace-buffer case of widget (wr-03) ([03e1331](https://github.com/k-leumas/que-que/commit/03e1331caa6fb2e1d4e9657331b78013d6ebf5cc))
* **03:** IN-003 mock rerender to exercise candidate-arrival render path ([3095f5c](https://github.com/k-leumas/que-que/commit/3095f5c34e0a96a25989d4b8b43c521b50b5afbc))
* **03:** IN-004 route unknown result-mode warning to debug log ([b23a234](https://github.com/k-leumas/que-que/commit/b23a2344c47191bb8c2bc62e347316cc0c5d6177))
* **03:** increase max_tokens to 1024 for 3-candidate responses (cr-02) ([972258c](https://github.com/k-leumas/que-que/commit/972258cd51169fd6cdbc5fb2eb4e4e01d4ed7d86))
* **03:** replace unlinkSync with rmSync to clean temp dirs in tests (wr-04) ([6ff5ee9](https://github.com/k-leumas/que-que/commit/6ff5ee961bedd3adfcfa26d7f27b376ec29364d6))
* **03:** separate JSON parse and schema errors in parseCandidates (wr-02) ([94c9f67](https://github.com/k-leumas/que-que/commit/94c9f67bdbfbd4291888b103e3014e7917af7a20))
* **03:** update tests for bootstrap relocation and socket path validation ([6bbf0d6](https://github.com/k-leumas/que-que/commit/6bbf0d60a798d3bee0edbe88016eb8170b3a1a95))
* **03:** WR-001 cache env-file reads per process lifetime ([704ad45](https://github.com/k-leumas/que-que/commit/704ad450a22d01b8cc5f50f864dac62854c3786a))
* **03:** WR-002 move bootstrapBuiltins to CLI startup ([ef4f8bb](https://github.com/k-leumas/que-que/commit/ef4f8bb03885e11776afa09012a4b2fce917dc03))
* **03:** WR-003 validate socket parent dir is exactly /tmp ([636f552](https://github.com/k-leumas/que-que/commit/636f55255b0b1c3ff8cd7bc9bac846dcb31b4594))
* **03:** WR-004 unescape git C-string octal sequences in porcelain paths ([0c5f2b3](https://github.com/k-leumas/que-que/commit/0c5f2b36a948cf80b0be03621ed2567acb5972e5))
* **03:** WR-005 guard onSelect/onCancel against double-invocation ([9d115d8](https://github.com/k-leumas/que-que/commit/9d115d86262426feb58382e71aa06c7e72211abc))
* **03:** WR-006 user-private debug log path and mode 0600 ([8151874](https://github.com/k-leumas/que-que/commit/81518741281b3d140f487de97b5ac76be14f442b))
* **03:** WR-008 remove stale esbuild-build.mjs from wrong project ([3316549](https://github.com/k-leumas/que-que/commit/3316549a635fb7d40d6936575b4c5751f81659b8))
* **04:** validate QQ_RESULT_FILE path and guard empty lbuffer in result apply ([b87a0fc](https://github.com/k-leumas/que-que/commit/b87a0fc39ea6e20aaf04bcdade87109230e8bb77))
* **build-dashboard:** hoist _stripAnsiRe above await main to fix TDZ error ([84ad43d](https://github.com/k-leumas/que-que/commit/84ad43d7642e8d5e44918c4ccab491210a5bd415))
* **build-dashboard:** remove stray literal and guard against EPIPE on watchman stdin ([436406c](https://github.com/k-leumas/que-que/commit/436406c3034c9eed7764d8114a1ced33299dc62a))
* **build-dashboard:** replace watchman -j subprocess with net.Socket daemon connection ([d59946b](https://github.com/k-leumas/que-que/commit/d59946b2384ce333942e729fae3f446246a8a2bd))
* **build-dashboard:** status column width off due to double ansi compensation ([c393152](https://github.com/k-leumas/que-que/commit/c39315210216426551deb013dd3c7540d991f0b8))
* **build-dashboard:** use system watchman daemon instead of spawning isolated server ([f947c5b](https://github.com/k-leumas/que-que/commit/f947c5bb12bfda8ba09c7e5a5691a794010ef144))
* **build:** manually fix linting issues ([8149904](https://github.com/k-leumas/que-que/commit/814990466d6745e81d51bd9c7b7e1fabb4be1b3b))
* **ci:** guard zsh widget registration in interactive shells ([0194dcc](https://github.com/k-leumas/que-que/commit/0194dccb44e0ab998d5f52d3d5dbd771f561c430))
* **ci:** install zsh and jq for shell tests ([00e8592](https://github.com/k-leumas/que-que/commit/00e8592c9cb36d9adf298c3601a77ac7cf118a97))
* **ci:** make noninteractive zsh sourcing succeed ([3dfe93f](https://github.com/k-leumas/que-que/commit/3dfe93f776db0dc725eba006e6f0a4064bd5bf79))
* **client:** always open /dev/tty for Ink stdin/stdout ([4efb790](https://github.com/k-leumas/que-que/commit/4efb7905b7352f9ac234146c688f6603b3e08139))
* **docs:** Fix formatting of paths in SYSTEM_DESGN.md ([6ad1742](https://github.com/k-leumas/que-que/commit/6ad1742d2c6c336106d909838832ea141254051d))
* **phase-01:** revise plan prompts ([2b6f4f8](https://github.com/k-leumas/que-que/commit/2b6f4f84e6bd6d93ba4d05530419833db8f7ab66))
* **phase-1:** revise plans based on checker feedback ([475d2a9](https://github.com/k-leumas/que-que/commit/475d2a9bfbd2e558699f03833328e093696306a2))
* **provider:** strip markdown fence + resolve qq for zellij run ([62f3d6b](https://github.com/k-leumas/que-que/commit/62f3d6b954db217213ee82e9d2bcb15424397635))
* **release:** add semantic-release dependencies ([6c502bd](https://github.com/k-leumas/que-que/commit/6c502bd89cf3bacc255f7a1d2be66e72f0571688))
* restore saved cursor before clearing TUI so content is fully erased ([7524cbe](https://github.com/k-leumas/que-que/commit/7524cbe7d1c3ce73d7325184c0279911bc5aa5d2))
* shrink scroll reserve to TUI height so prior content stays visible ([80c59c4](https://github.com/k-leumas/que-que/commit/80c59c40eb9dcef3429b4af8db9823e399b60038))
* switch to react-jsx transform so React need not be imported in every TSX file ([0bc8b70](https://github.com/k-leumas/que-que/commit/0bc8b707655f78ac9cabbd801313423311a6de29))
* **test:** run zsh helper tests without startup files ([07bbfb3](https://github.com/k-leumas/que-que/commit/07bbfb39f874f93a3dac123de932fba694f29d1a))
* **tests:** resolve TS type errors breaking CI typecheck ([0881656](https://github.com/k-leumas/que-que/commit/08816568532ac1b3c634382f6df7ca70b16c0ab7))
* **ui:** unmount Ink TUI on SIGHUP/SIGTERM to clear terminal artifacts ([599bb99](https://github.com/k-leumas/que-que/commit/599bb99c09af56fcc20a6ed10fc7131004a94d04))
* **widget:** selected command appears in new PS1 after selection ([b0e5c65](https://github.com/k-leumas/que-que/commit/b0e5c65c04b8e6f3d15e1cea3a652201ffc93aea))


### Features

* **01-01:** implement shell and IPC contracts with socket path helper ([8ba3e29](https://github.com/k-leumas/que-que/commit/8ba3e29e2dfd4136dfc053a28af0943a694b2135))
* **01-02:** implement zsh ZLE widget with ?? trigger and result application ([6ce8139](https://github.com/k-leumas/que-que/commit/6ce813968bd109d6dfbdde30dc19dfa15379c5f2))
* **01-03:** implement daemon bootstrap, server, and CLI wiring ([faa5af3](https://github.com/k-leumas/que-que/commit/faa5af3436e9a1a030ecfc4dc4914dbe1e250587))
* **01-03:** implement foreground client loop, result writer, and client CLI wiring ([4ab40a1](https://github.com/k-leumas/que-que/commit/4ab40a12e1df966814dcf31ceac250ac68683d1e))
* **02-01:** add request contracts ([9b96f9b](https://github.com/k-leumas/que-que/commit/9b96f9bbfecb5db0fe581b9cc42f6f0c4efa1ef1))
* **02-01:** implement classifyIntent router ([3e0b195](https://github.com/k-leumas/que-que/commit/3e0b195a38d15416137e18923c7d2cfaf5fb006a))
* **02-02:** add context pipeline and candidate selection ([3ed1520](https://github.com/k-leumas/que-que/commit/3ed1520b4377d43f9caaf89a7cf6eea3c25be508))
* **02-02:** add Task 3 — multi-candidate response and minimal selection UI ([a1e8d02](https://github.com/k-leumas/que-que/commit/a1e8d023437772205d6ec89de623fd0d07dfb504))
* **02-03:** add registry bootstrap for built-in providers ([a8b8e02](https://github.com/k-leumas/que-que/commit/a8b8e02d6589b582dd79a3ddd62fca7651dcada1))
* **03-01:** create LLMAdapter interface in src/providers/provider.ts ([dc14eec](https://github.com/k-leumas/que-que/commit/dc14eec87a565bfa6c8084ecdd0663c4a18004e3))
* **03-01:** refactor claude.ts and extend shellResultSchema — tests green ([330c416](https://github.com/k-leumas/que-que/commit/330c41684ca62971613f7459c5aef2ee9fec9ce3))
* **03-02:** add confidence to NormalizedRequest, error ShellResult on failure, register Claude backend ([bf52146](https://github.com/k-leumas/que-que/commit/bf521460c4ac25e9f3a495641cc16a30c9ed772a))
* **03-03:** add error) case to both case blocks in qq.zsh (GREEN) ([5a0add7](https://github.com/k-leumas/que-que/commit/5a0add71bd540980562a025a31b26e1684e70a56))
* **03.1-02:** create Modal.tsx with 80-col width, no footer prop ([3e86b9b](https://github.com/k-leumas/que-que/commit/3e86b9b24b35157bab380ce25145944dcde251e3))
* **03.1-02:** create SearchInput, ControlsLine, LoadingSpinner components ([d12001d](https://github.com/k-leumas/que-que/commit/d12001d522e96b5d6dacfb0528bc5250fa0d28c3))
* **03.1-03:** refactor run-foreground to modal-first async with rerender ([2e5d257](https://github.com/k-leumas/que-que/commit/2e5d2577b10f911f82d2fd5aea12aa3439f63358))
* **03.1-03:** rewrite CandidateSelect with monocle contract ([7187358](https://github.com/k-leumas/que-que/commit/7187358bf7e31845560bcd8a6eda0158e17caafc))
* **03.2-02:** add Zellij branch to run-foreground.ts ([4b2b993](https://github.com/k-leumas/que-que/commit/4b2b99323ff2cd526e513cc2394371ba9ee74f7f))
* **03.2-02:** implement FIFO-aware writeShellResult in result-writer.ts ([f44478a](https://github.com/k-leumas/que-que/commit/f44478a296b2edd98252824402edc1fd5f2ac864))
* **03.2-03:** rewrite qq-question-widget with Zellij FIFO IPC ([5251bdd](https://github.com/k-leumas/que-que/commit/5251bddf46daf18dad08a0399f8c4233d2d7e277))
* **04:** execute Wave 1 — useEffect reset hook + FIFO error handlers ([c0e5254](https://github.com/k-leumas/que-que/commit/c0e52540a458d88dcf56a875db264e587fc520d2))
* **260522-vfd:** add DetectedProvider union and detectProvider() waterfall ([1147fbe](https://github.com/k-leumas/que-que/commit/1147fbed0468029298909b6926d7d7f599ded264))
* **260522-vfd:** wire detectProvider() into run-foreground.ts ([1a66b8b](https://github.com/k-leumas/que-que/commit/1a66b8ba2124f9f0720014292553123b56949e6b))
* add dev restart watcher ([dd774e7](https://github.com/k-leumas/que-que/commit/dd774e7d92f418dbfc3977e59fabc98e8d4ee516))
* add non-Zellij inline fallback + cursor placement + explanation flow ([90d2044](https://github.com/k-leumas/que-que/commit/90d204458fc6218ae218df47f15459f1d5389d2d))
* add non-Zellij inline fallback + cursor placement + explanation flow ([ad4f343](https://github.com/k-leumas/que-que/commit/ad4f343dbea638a78232feaf1124fb2ddb28b9b3))
* add non-Zellij inline fallback + cursor placement + explanation flow ([ef9fd34](https://github.com/k-leumas/que-que/commit/ef9fd3475c433fbc809449d47c76bd0849cc3c15))
* **build-dashboard:** add --ignore-paths flag to suppress pre/post build script rebuilds ([7b2957a](https://github.com/k-leumas/que-que/commit/7b2957a52a63072d0f1ba89215e46f2e278964db))
* **build-dashboard:** add git/worktree/root info header and cap build output at 512KB ([b43bc13](https://github.com/k-leumas/que-que/commit/b43bc1340600509b90c136b248d332541e77768f))
* **build-dashboard:** force build, self-restart, sha fingerprint, token filter fix ([0825b3e](https://github.com/k-leumas/que-que/commit/0825b3e88ed9c3931de6bc5af4ecff0f73b4882a))
* **build-dashboard:** read esbuild define block and display resolved values in header ([4563303](https://github.com/k-leumas/que-que/commit/4563303452bc593583a8e95f8d7f85fc984da75c))
* **build-dashboard:** read esbuild define block, refresh on each build, filter token keys ([bb81beb](https://github.com/k-leumas/que-que/commit/bb81bebe99bc09700b9fdb8d61ffe66083475c27))
* select available claude model ([b74f2e2](https://github.com/k-leumas/que-que/commit/b74f2e26911317303208d7e344066b231ea51019))
* show selection summary above PS1 and restore query to LBUFFER ([563b8a9](https://github.com/k-leumas/que-que/commit/563b8a9152eb35a53f85b60184599537a85b7811))
* tighten shell bridge logging ([e8d8a1d](https://github.com/k-leumas/que-que/commit/e8d8a1d0430b85994c7c886c169e7c28409e391e))
* **ui:** add forced selector candidate mode ([908fa17](https://github.com/k-leumas/que-que/commit/908fa176bde48e01aa162227fb257a832432151f))
* **ui:** phase-04 UAT fixes — two-row layout, FILTER label, zellij name, context header ([ac90c65](https://github.com/k-leumas/que-que/commit/ac90c65096994cb7195eee31e3064893a90ecb05))

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
