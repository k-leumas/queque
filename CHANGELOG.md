## [0.8.1](https://github.com/k-leumas/queque/compare/v0.8.0...v0.8.1) (2026-10-30)

# [0.8.0](https://github.com/k-leumas/queque/compare/v0.7.1...v0.8.0) (2026-10-30)

### Features

- Added a new `qq doctor` command that checks your setup and reports problems, with an optional `--json` output for scripting.
- QueQue now asks once, with a single keypress, whether you're okay sharing anonymous usage telemetry after your first accepted suggestion; it defaults to no if you don't answer.
- Added `qq telemetry status`, `on`, `off`, and `show` commands so you can check or change your telemetry choice at any time.
- `qq doctor` now shows your current telemetry setting as an informational row without failing the check.

<details>
<summary>Detailed changes</summary>

* **10-11:** ask for telemetry consent once after the first accepted ?? ([a0bcb29](https://github.com/k-leumas/queque/commit/a0bcb290bb2d4a8fd01976df4952bc2695bafc00))
* **10-11:** add the one-key telemetry consent prompt, default no ([49aa2c7](https://github.com/k-leumas/queque/commit/49aa2c750327430933923348e015b678ef2872ab))
* **10-07:** add the auto-revert job to ci.yml for smoke failures on push ([cd9245c](https://github.com/k-leumas/queque/commit/cd9245c9cf81edd7b313f66a75d2c46cdcddadfd))
* **10-07:** restore the last green tree when a smoke leg fails ([633e391](https://github.com/k-leumas/queque/commit/633e391ff62c1affa19eba231c368c1ea1a59eeb))
* **10-10:** report each query outcome after the result is written ([37cd34d](https://github.com/k-leumas/queque/commit/37cd34dec9f87162479a84ba293ffc1cdd84fcc3))
* **10-10:** build, gate and send client telemetry events ([08663e6](https://github.com/k-leumas/queque/commit/08663e673e5d7933785e6c2dd7c158852e032d97))
* **10-09:** show telemetry state as a non-blocking doctor row ([7ea587d](https://github.com/k-leumas/queque/commit/7ea587d443bb789a70eac1d89917bb243faf93d6))
* **10-09:** add qq telemetry status, on, off and show ([23d8ca3](https://github.com/k-leumas/queque/commit/23d8ca35f95ac993e38ed006d84cfa106eb9173d))
* **10-06:** classify fetch errors as an ErrorKind enum ([7d98daa](https://github.com/k-leumas/queque/commit/7d98daa42b4d49f7ec31951cb553e56a6169bf25))
* **10-06:** wire telemetry IPC kinds and the bounded shutdown flush ([31368cb](https://github.com/k-leumas/queque/commit/31368cb036eaad8a715036c288d890cadea3dd32))
* **10-06:** add the daemon telemetry buffer and /batch sender ([04bbf4a](https://github.com/k-leumas/queque/commit/04bbf4aa0467760353a2ebe6e2be5b6a13b580c4))
* **10-05:** assert qq doctor exits 0 in every distro smoke ([530b353](https://github.com/k-leumas/queque/commit/530b35344aab58e06e32a5536ae316845f747d0d))
* **10-05:** skip heavy CI jobs only for doc-only changes ([9571b26](https://github.com/k-leumas/queque/commit/9571b26b1041ac289bdaab47e6971a84f4f6776e))
* **10-01:** add Esc, C-locale and no-Docker paths to the distro smoke ([2668d18](https://github.com/k-leumas/queque/commit/2668d187a648f7896a7cfb4733f90948a7866503))
* **10-01:** add the distro smoke tracer for one accepted ?? in alpine ([5028926](https://github.com/k-leumas/queque/commit/50289265ee882216b07dc90585cf4e9beb6bbe44))
* **10-04:** bake EU telemetry host and empty key with env overrides ([2ab18c4](https://github.com/k-leumas/queque/commit/2ab18c40445f40704ca7459061500f6bdbfb5959))
* **10-04:** add uncached telemetry consent state with env gates ([020be84](https://github.com/k-leumas/queque/commit/020be848d5809ce829eec51bd33d4a7dbc1916ba))
* **10-04:** add strict telemetry allow-list contract ([4643086](https://github.com/k-leumas/queque/commit/4643086ff924ba31a335e6eda422bef7923cc62f))
* **10-03:** add qq doctor command with --json output ([d752e21](https://github.com/k-leumas/queque/commit/d752e21f1ce034e051a8a532411f6eb8c2d135c0))
* **10-03:** implement qq doctor checks and exit rule ([24cd71d](https://github.com/k-leumas/queque/commit/24cd71da807e2a06dab65ce2fe082f8edd9deb67))

</details>

### Bug Fixes

- Fixed the consent prompt so it no longer pops up inside zellij sessions where it couldn't be answered properly.
- Fixed an issue where the consent prompt would keep re-asking every time if QueQue couldn't save your settings file.
- Fixed config saving so that a symlinked config.json now gets written to its real target instead of breaking the link.
- `qq doctor` now warns instead of silently failing when it can't reach the background daemon.
- Fixed incorrect line-width calculations in terminals using a C locale without UTF-8 support, which could garble suggestion display.
- Fixed the shell widget incorrectly signalling unrelated processes on systems using busybox's lsof.
- The shell widget now stops cleanly instead of hanging if it can't create a temporary session directory.

<details>
<summary>Detailed changes</summary>

* **smoke:** opt out of telemetry in the homebrew install smoke ([80bb9d4](https://github.com/k-leumas/queque/commit/80bb9d457c6aa20c06c14282b47c72f5fc55dfc5))
* **10:** clear stale doctor reports before a distro smoke run ([1cb1963](https://github.com/k-leumas/queque/commit/1cb1963f9ad2dda024e9a5acd70337a72e8c6104))
* **10:** give each branch its own auto-revert head branch ([b4a277e](https://github.com/k-leumas/queque/commit/b4a277e1e3e712533d20eb3d1f684a7a8c9290bc))
* **10:** diff push runs against main, not the previous push ([471d18d](https://github.com/k-leumas/queque/commit/471d18de4cfe77f8e03fc3be151f17d35fe74632))
* **10:** warn in doctor when the daemon socket does not answer ([4d35bfd](https://github.com/k-leumas/queque/commit/4d35bfd9dbfd36b013bdf9363f11e11383f19f6c))
* **10:** write a symlinked config.json through to its target ([8064e74](https://github.com/k-leumas/queque/commit/8064e7443e47aa291adb8786b122ec0fdd83f50d))
* **10:** skip the consent question inside zellij ([e57a139](https://github.com/k-leumas/queque/commit/e57a139b7bbc9f8496c66f0677740e08242f13ba))
* **10:** keep consent from re-asking when config is unwritable ([fa30b57](https://github.com/k-leumas/queque/commit/fa30b57b198a76a0add243ab2f9012cd34ed4f95))
* **10:** keep smoke artifacts readable for the runner on every exit ([378ee22](https://github.com/k-leumas/queque/commit/378ee22d390f081c309358c8bca6d87f5a3719f7))
* **10:** count frame width in a UTF-8 locale on C-locale hosts ([ae68aea](https://github.com/k-leumas/queque/commit/ae68aea8a2e26def402f525674fe11f610f3f395))
* **10:** scrub hook-exported GIT_* vars before tests spawn git ([7b476ce](https://github.com/k-leumas/queque/commit/7b476cec796b4e592866aa39139ee25d39d1836f))
* **10-01:** ignore busybox lsof output so no unrelated pid is signalled ([0444383](https://github.com/k-leumas/queque/commit/0444383354acc21644507d0f351d282f0a636994))
* **10-02:** stop the widget when mktemp cannot create a session dir ([4af410e](https://github.com/k-leumas/queque/commit/4af410e5845896ea2a517b0dd75aec5583552f5c))
* **lint:** root-anchor biome excludes so lint runs in worktrees ([685af4d](https://github.com/k-leumas/queque/commit/685af4d90e55a6ea1fccd8e16f24e1baf4f04223))

</details>

## [0.7.1](https://github.com/k-leumas/queque/compare/v0.7.0...v0.7.1) (2026-10-27)

### Bug Fixes

- Fixed changelog links that could accidentally include embedded repository credentials, so shared release notes are now clean and safe to click.

<details>
<summary>Detailed changes</summary>

* **release:** strip credentials from changelog repository links ([bac2fc6](https://github.com/k-leumas/queque/commit/bac2fc61e72d909fabab6a3f1176a31b3ab07908))

</details>

# [0.7.0](https://github.com/k-leumas/queque/compare/v0.6.1...v0.7.0) (2026-10-19)

### Features

- You can now set up OpenAI or Ollama as your assistant provider with a new qq init provider picker that securely saves your choice and restarts the background daemon to use it right away.
- If your first ?? ever fails, QueQue now guides you straight into qq init provider so you can get set up instead of hitting a dead end.
- OpenAI and Ollama support are now available and clearly labeled as beta so you know what to expect.
- Once you pin OpenAI or Ollama as your provider, ?? now answers through a warm, already-running daemon for faster responses, and that same pin is honored even when QueQue falls back to an in-process run.

<details>
<summary>Detailed changes</summary>

* **quick-261018-wax:** label OpenAI and Ollama as beta ([5aaabd6](https://github.com/k-leumas/queque/commit/5aaabd624fa868361a85f4baf56bfd0d3caae9a0))
* **08-06:** point the first failed ?? at qq init provider ([36ad008](https://github.com/k-leumas/queque/commit/36ad0086afb8f2949b5622b398181ee9b9f56852))
* **08-05:** finish picker dead ends and restart the daemon after a saved pin ([39553a8](https://github.com/k-leumas/queque/commit/39553a8f441c9748b83c3ae3f0068a19f46d117c))
* **08-05:** add qq init provider picker that persists a 0600 pin ([71231f6](https://github.com/k-leumas/queque/commit/71231f6bf57c4d70ef7c878ddfe538ae714e7179))
* **08-04:** map openai failures to static copy with no vendor fallback ([67a98f4](https://github.com/k-leumas/queque/commit/67a98f4979c5873367f5a044cd031ccb3405e521))
* **08-04:** answer ?? from a pinned openai through the warm daemon ([f9acfec](https://github.com/k-leumas/queque/commit/f9acfece3365bcc1a883fd82966e1d2e63a27a1c))
* **08-03:** map ollama failures and honor the pin in the in-process fallback ([dd7503c](https://github.com/k-leumas/queque/commit/dd7503c35d2092ff6bf60b5c1db96e879ba1cd80))
* **08-03:** route fetch-candidates through the provider.json pin ([7768e52](https://github.com/k-leumas/queque/commit/7768e52c8b4343db2b8776a89e27922517f7dc96))

</details>

### Bug Fixes

- Fixed cases where OpenAI or Ollama could return answers that were cut off midway; QueQue now enforces a stricter response format and automatically retries once so you get a complete suggestion.
- QueQue no longer produces a command suggestion from plain prose explanations returned by OpenAI or Ollama.
- Local model answers no longer leak internal 'thinking' text; only the final answer is kept and shown.
- Fixed several issues where QQ_CONFIG_FILE or provider pin paths weren't handled correctly, including leading ~/, empty values, relative paths, and a missing home directory, so ?? keeps working in more environments.
- Hardened handling of provider responses and saved settings against hidden or malicious characters (bidirectional, zero-width, and control bytes), and blocked key files from being read outside your home directory.
- Credentials and control characters are now rejected if found in a saved Ollama base URL, and QueQue warns when a remote Ollama URL uses unencrypted plain HTTP.
- Error messages are now clearer and more specific across providers: invalid OpenAI keys, 401/403 auth failures, Ollama connection issues, 404s on your Ollama URL, and streaming/cancellation behavior are all described accurately.
- The provider pin file is now written with safe permissions before it's finalized, and the picker keeps your previously saved base URL and model when you run it again.
- Improved daemon reliability: QueQue now properly stops an old daemon before starting a new one, starts the daemon from your home directory for consistent key lookup, and automatically replaces a running daemon that can't honor a newly saved provider pin.
- Fixed a startup issue where loading QueQue's main command could trigger an unintended daemon restart.

<details>
<summary>Detailed changes</summary>

* **08:** expand a leading ~/ in QQ_CONFIG_FILE (IN-19) ([8d49761](https://github.com/k-leumas/queque/commit/8d497612e8ae88a50f603bab35706114c5d67dce))
* **08:** remember rejected openai retry efforts per model (IN-18) ([5bf7513](https://github.com/k-leumas/queque/commit/5bf751340322a15d262735cd2fb8d7152067b90d))
* **08:** name cut-off retries and content filters correctly (IN-17) ([61fc5e6](https://github.com/k-leumas/queque/commit/61fc5e670303bbacea3805b9172d77accf8e6e00))
* **08:** never read a key file above the home directory (IN-16) ([221b6ea](https://github.com/k-leumas/queque/commit/221b6ea82c42543889f026b388bc04292d182aa5))
* **08:** reject bidi characters in ollama errors and baseUrl (IN-15) ([f113535](https://github.com/k-leumas/queque/commit/f113535b08d5b52131671925a50b3202a686e4b7))
* **08:** size ollama num_ctx and num_predict to the budget (WR-15) ([a888b67](https://github.com/k-leumas/queque/commit/a888b671930b1b17099adb30e04f412dc17e335f))
* **08:** resend openai request without a rejected schema (WR-14) ([3e994b4](https://github.com/k-leumas/queque/commit/3e994b417f1fd06f9d2d553dbf3ee92ac200052c))
* **08:** keep think tags inside candidate strings (WR-13) ([afd9920](https://github.com/k-leumas/queque/commit/afd9920261ceb1309a22885df627e8fbfacd22d7))
* **quick-261018-wax:** stop cut-off OpenAI answers with a strict schema and one retry ([713e0a4](https://github.com/k-leumas/queque/commit/713e0a42fa87006e19763a6902048949f83a743d))
* **quick-261018-wax:** stop cut-off Ollama answers with a schema and one retry ([aa4fa94](https://github.com/k-leumas/queque/commit/aa4fa94d8acb1eea90617087ff3dd729a70ee5e9))
* **08:** filter bidi and zero-width characters and sanitize Claude rows (IN-12) ([9d12678](https://github.com/k-leumas/queque/commit/9d126785f5ae0d604071997896bdc15e2b5fabc3))
* **08:** treat an empty QQ_CONFIG_FILE as unset and resolve relative ones (IN-14) ([d040370](https://github.com/k-leumas/queque/commit/d04037029c4f5c8dea62508b1b647a3e2f1d7ca3))
* **08:** treat an all-control-byte answer as an unexpected response (IN-13) ([8d67e72](https://github.com/k-leumas/queque/commit/8d67e7287c744b5f112433614de6add639c057e2))
* **08:** keep the baseUrl path prefix when it has a query or fragment (IN-11) ([55f060f](https://github.com/k-leumas/queque/commit/55f060f45f55a677e777b09324dfc2cd18958d3d))
* **08:** reject control characters and credentials in the pin baseUrl (IN-10) ([da30fab](https://github.com/k-leumas/queque/commit/da30fab56814b1efa99b38ff75cba10472780f0f))
* **08:** give remote Ollama advice when a saved baseUrl is down (IN-09) ([d133063](https://github.com/k-leumas/queque/commit/d1330631edae403597ee2f0cb61bbe0b6273dddd))
* **08:** document that a remote plain-http Ollama baseUrl is unencrypted (IN-08) ([1f77710](https://github.com/k-leumas/queque/commit/1f7771089a373dc0a08f38523d6716425d636886))
* **08:** map SDK 401 and 403 to key copy with the picker hint (IN-07) ([695eeb2](https://github.com/k-leumas/queque/commit/695eeb2af5cc40ae3687132cd3a79927189a0ca9))
* **08:** describe streaming and cancellation for every provider (IN-06) ([b1421d0](https://github.com/k-leumas/queque/commit/b1421d08d3ff5f0a9aca2ba678fe7d9460bd475d))
* **08:** report an OpenAI key with invalid header characters as such (IN-05) ([958cfff](https://github.com/k-leumas/queque/commit/958cfff689946dbab1637d138d6706e2c2bfaadf))
* **08:** make the Ollama docstring match what is logged (IN-04) ([641c505](https://github.com/k-leumas/queque/commit/641c5051ccc95851c08b3b8e50893c58073c8393))
* **08:** chmod the pin temp file before the rename (IN-03) ([7775828](https://github.com/k-leumas/queque/commit/7775828879ffe3805ec8bb88c74a78cf810ad897))
* **08:** cap and sanitize unknown pin key names in the invalid reason (IN-02) ([6c1eefb](https://github.com/k-leumas/queque/commit/6c1eefb2fc807cbfc67e24c2ef95be3a79c77575))
* **08:** correct the picker's lazy-binding comment (IN-01) ([aa52e99](https://github.com/k-leumas/queque/commit/aa52e99b48e6572335aeab6b5e307b51d35bb9c6))
* **08:** point key error copy and docs at the home key file (WR-11) ([605c79a](https://github.com/k-leumas/queque/commit/605c79a3aba942a0a417845388c0af1a7b895b10))
* **08:** read .env.local from the home directory in the in-process fallback (WR-10) ([0835025](https://github.com/k-leumas/queque/commit/08350250979a0cbb56ffbab0d7705ec255117af7))
* **08:** keep ?? working when the home directory does not exist (WR-12) ([22d712f](https://github.com/k-leumas/queque/commit/22d712f406654d3711e7573d736a854245d5f39e))
* **08:** keep only the answer after thinking in local model output (WR-09) ([35195d8](https://github.com/k-leumas/queque/commit/35195d81883be74ef19023a702f1453b15b71bba))
* **08:** start the daemon in the home directory for a stable key source (WR-08) ([9cceb4f](https://github.com/k-leumas/queque/commit/9cceb4f2cc817b4492df7fe521716d86ca873da2))
* **08:** stop the old daemon over IPC before falling back to lsof (WR-07) ([78f053f](https://github.com/k-leumas/queque/commit/78f053f452b1fee4d0b54ab36a483192b2f152fd))
* **08:** keep the Ollama baseUrl path and report a URL 404 as such (WR-06) ([099fcb0](https://github.com/k-leumas/queque/commit/099fcb0a09b0f1e63c55c9ccda00dc64d1ff15c4))
* **08:** never turn Ollama or OpenAI prose into a command (WR-05) ([675f1ae](https://github.com/k-leumas/queque/commit/675f1ae5b02aebd81c38c128880801e231922e61))
* **08:** strip terminal control bytes from non-Claude provider text (WR-04) ([b0da1ac](https://github.com/k-leumas/queque/commit/b0da1ac71a43b8fff897cc8785355a24fdd85a82))
* **08:** fail closed on an empty or relative QQ_PROVIDER_FILE (WR-03) ([e4710a1](https://github.com/k-leumas/queque/commit/e4710a1a467832f1fdcc968cc5935840aa310429))
* **08:** keep a saved baseUrl and model when the picker re-runs (WR-02) ([eb96a93](https://github.com/k-leumas/queque/commit/eb96a93dc116a7ec615a03fda047e135b419b453))
* **08:** report non-auth claude -p failures with neutral copy (WR-01) ([3e51244](https://github.com/k-leumas/queque/commit/3e51244faf209dfaa90122d46192900c1f5a7b45))
* **08:** replace daemons that cannot honor the provider pin (CR-01) ([130f367](https://github.com/k-leumas/queque/commit/130f3676888954fa3fad2f01a0046e7e24f7b19a))
* **08-05:** bind picker restartDaemon lazily so loading main.ts stays inert ([db67b70](https://github.com/k-leumas/queque/commit/db67b702dd492f39c8bfff23109724a501d2cfa8))

</details>

## [0.6.1](https://github.com/k-leumas/queque/compare/v0.6.0...v0.6.1) (2026-10-17)

### Bug Fixes

- The Homebrew install instructions now mention logging into Claude Code, so you know that extra step is needed to get QueQue working.
- The CLI now shows the correct `qq init` command for setup, so following the on-screen instructions won't accidentally overwrite your existing ~/.zshrc.

<details>
<summary>Detailed changes</summary>

* **homebrew:** offer the claude code login in the install caveats ([e80fa9b](https://github.com/k-leumas/queque/commit/e80fa9bd0077169e2c85425c867b6b1fb149fa07))
* **cli:** show the qq init command that keeps ~/.zshrc intact ([02f6f7c](https://github.com/k-leumas/queque/commit/02f6f7cb9171b8862ba5bf35e6230323f95302b3))

</details>

# [0.6.0](https://github.com/k-leumas/queque/compare/v0.5.2...v0.6.0) (2026-10-17)

### Features

- Command suggestions now stream in as they're generated, so the picker fills up progressively instead of waiting for every candidate at once.
- Suggestions that have already arrived stay selectable even if a later one fails to generate.
- QueQue now keeps a command process warmed up in the background so suggestions can start generating noticeably faster.
- You can press Esc to cancel a suggestion request that's in progress.
- The effort level used to generate suggestions can now be tuned in config.json.

<details>
<summary>Detailed changes</summary>

* **09.1-04:** send the effort setting as output_config on the SDK path ([6658c07](https://github.com/k-leumas/queque/commit/6658c0754da4568318717a6b3f979790dcc08f90))
* **09.1-04:** stream the SDK request with abort and incremental candidates ([7955ca2](https://github.com/k-leumas/queque/commit/7955ca29b8bbdd583a87af6176b46636a9929299))
* **09.1-07:** keep arrived rows selectable after a late provider failure ([9a73fcd](https://github.com/k-leumas/queque/commit/9a73fcdd09b46343c5301f30343fe15c46e9f6e8))
* **09.1-07:** render streamed rows as a growing list in the modal ([c947e5f](https://github.com/k-leumas/queque/commit/c947e5ff5c53473f0406f53c4a71402ad861e753))
* **09.1-05:** use the prewarmed claude -p process in the daemon and refill it ([8e4bbdc](https://github.com/k-leumas/queque/commit/8e4bbdc2ba6f4484ff19388e16d4fe35558f588b))
* **09.1-05:** run a turn on a prewarmed child and keep a one-slot prewarm pool ([03e0ac7](https://github.com/k-leumas/queque/commit/03e0ac7e5f1a9ac27ce143bf4e863c4977078815))
* **09.1-06:** bound the claude -p runner and arm the post-result backstop ([04b1432](https://github.com/k-leumas/queque/commit/04b1432fcfddd0e41ae522547760136a31d3214e))
* **09.1-06:** cap the stream-json parser carry at 1 MiB ([417dc42](https://github.com/k-leumas/queque/commit/417dc42be236b258e44567729e56fe2ae274da2c))
* **09.1-03:** never re-query in-process after streamed rows arrived ([f066802](https://github.com/k-leumas/queque/commit/f0668020598ad6c2ddc0438edd110885e83fb3cb))
* **09.1-03:** stream each candidate to a stream:true client over IPC ([ef5a734](https://github.com/k-leumas/queque/commit/ef5a73443699407092094cba8853655a3520a51c))
* **09.1-02:** stream validated claude -p candidates as they arrive ([df13f42](https://github.com/k-leumas/queque/commit/df13f42d162e228a6144cec72e8f7622b86f28be))
* **09.1-02:** run claude -p at low effort, overridable in config.json ([9d48de1](https://github.com/k-leumas/queque/commit/9d48de1ed88201b418691ceb436a35c39adb54b0))
* **09.1-01:** log each claude -p turn stage with elapsed ms ([0cc34e0](https://github.com/k-leumas/queque/commit/0cc34e0d06e789739a65b6ba0b9c16bd35a1057d))
* **09.1-01:** cancel the claude -p turn on Esc and resolve it on the stream-json result ([07fa14b](https://github.com/k-leumas/queque/commit/07fa14b9e31e274ee8ecbd2f820b9d4775270c2f))

</details>

### Bug Fixes

- Fixed an issue where pressing Enter, Tab, arrow keys, or Backspace right after typing could be missed if they arrived in the same burst of input.
- The filter field now opens empty and shows your original command line only in the header, instead of pre-filling the filter.
- Fixed cases where a cut-off or failed response from the assistant could silently show a bad suggestion; these now fail clearly instead, and longer answers are less likely to get cut off.
- Fixed the selection highlight breaking when a filter narrowed the list down to zero results.
- Fixed the selected item sometimes getting reset unexpectedly while you were still typing.
- Text you've typed into the filter is no longer lost while the first suggestions are still loading.
- Fixed a rare freeze by making the background warm-up process restart automatically if it stalls.
- Shutting down the background daemon now properly stops any in-progress suggestion requests instead of leaving them hanging.
- Fixed garbled text that could appear when input containing multi-byte characters arrived in split chunks.

<details>
<summary>Detailed changes</summary>

* **09.1:** keep closed rows or throw the truncation copy on claude -p (WR-01-r2) ([8409b07](https://github.com/k-leumas/queque/commit/8409b0764efc7a8f5235480dc1be3d2b9207ed9c))
* **09.1:** reject a claude -p result with a non-normal stop reason (WR-01-r2) ([646aed3](https://github.com/k-leumas/queque/commit/646aed3d79b0fa87e45cadcade60a1a0552ff734))
* **09.1:** fail closed on every non-normal sdk stop reason (WR-01-r2) ([ced3d8f](https://github.com/k-leumas/queque/commit/ced3d8fb2a2d65ddbbc926e714ee8dd402147e6a))
* **09.1-10:** let enter, tab and arrows see earlier keys of the same stdin read (CR-01) ([6392dec](https://github.com/k-leumas/queque/commit/6392dec03d86179687566ea5791e468ceee9fcdb))
* **09.1-10:** keep a backspace that shares a stdin read with typed keys (CR-01) ([f27f82f](https://github.com/k-leumas/queque/commit/f27f82f0ee967cf8e3b6872e1ba543eaf074339e))
* **09.1-09:** open the filter empty and show the lbuffer only in the header (G-09.1-5) ([80def35](https://github.com/k-leumas/queque/commit/80def35cf956d8b9f10b3831717ba019c34869e4))
* **09.1:** fail closed on a truncated sdk answer and raise max_tokens (WR-07) ([cbb1b6d](https://github.com/k-leumas/queque/commit/cbb1b6dccda3f7e76da169042016b18c6bcfbeda))
* **09.1:** keep the selection index valid on an empty filtered list (WR-06) ([f9b302d](https://github.com/k-leumas/queque/commit/f9b302dde277e7f854371dd2ecf65316982cc63d))
* **09.1:** reset the selection in the key handlers, not a query effect (WR-05) ([580208a](https://github.com/k-leumas/queque/commit/580208a1d8cb7f2a4ad0706ebf5d81c878715c30))
* **09.1:** keep a filter typed during loading on the first streamed row (WR-04) ([87653c9](https://github.com/k-leumas/queque/commit/87653c91b2bc03d933a0ef0a2a1568fc5b2d70eb))
* **09.1:** disable prewarm and abort in-flight turns on daemon shutdown (WR-03) ([bc5d450](https://github.com/k-leumas/queque/commit/bc5d45029a8fc9682a8b9c661702a04122d42f16))
* **09.1:** retry a prewarmed child that stalls before init cold (WR-02) ([9579b93](https://github.com/k-leumas/queque/commit/9579b93f3db74626634f11c5060552f33979da84))
* **09.1:** decode daemon ipc input as utf-8 across chunks (WR-01) ([c9d1374](https://github.com/k-leumas/queque/commit/c9d1374921d4cca98b646c5617ad99ee5d9cea6e))

</details>

# Changelog

All notable changes to this project are documented in this file.

Highlights describe how QueQue got better. Expand **Detailed changes** for the commit list.

## [0.5.2](https://github.com/k-leumas/queque/compare/v0.5.1...v0.5.2) (2026-10-17)

### Bug Fixes

* **deps:** update dependency ink to v7.1.1 ([08c68dd](https://github.com/k-leumas/queque/commit/08c68dd7bd2dec9031091d87bae1af9ea8943c22))

## [0.5.1](https://github.com/k-leumas/queque/compare/v0.5.0...v0.5.1) (2026-10-12)

### Bug Fixes

* satisfy biome check ([908978b](https://github.com/k-leumas/queque/commit/908978b7edc4d0c92e97974cf2d8fba349ddb24a))

# [0.5.0](https://github.com/k-leumas/queque/compare/v0.4.2...v0.5.0) (2026-10-12)

### Features

- **Suggestions prefer tools you already have.** QueQue now asks zsh which commands exist and steers ranked suggestions toward them. A suggestion that needs a missing tool is marked ⓘ, and Tab prepends an install command — nothing is installed until you accept it.
- **`??` appears immediately.** The modal paints from the shell widget before Node starts, so you see `thinking…` instead of a blank terminal.
- **Answers are faster when you have an API key.** Requests go through a warm daemon and the Anthropic SDK instead of booting Claude Code on every query. Claude Code `/login` still works on macOS without a key.

<details>
<summary>Detailed changes</summary>

* **08-01:** implement platform-aware claudeAuthPresent detection ([ddad55b](https://github.com/k-leumas/queque/commit/ddad55bfb5fb9d071cadf2570560df004bb5b400))
* **08-02:** implement Claude CLI adapter with SDK rescue ([f42dec1](https://github.com/k-leumas/queque/commit/f42dec17137f3fb201109de7cd8bd41e7ab4f67f))
* **08-02:** resolve Claude default and bypass detect selector ([29d7318](https://github.com/k-leumas/queque/commit/29d7318880b54286ba059743087a4e219d5bf9b6))
* **08:** fetch via Anthropic SDK first through a warm daemon client ([07738ca](https://github.com/k-leumas/queque/commit/07738ca65661a07b5438afaa11a8bb28336d1fd2))
* **09-01:** count flag footer and mark overflow rows in the layout ([4fdd6f8](https://github.com/k-leumas/queque/commit/4fdd6f802ab426fc57421416c63ddcb4be85ff61))
* **09-01:** flag candidates that use tools zsh cannot resolve ([086ba1f](https://github.com/k-leumas/queque/commit/086ba1f076f29c587e8819dab1e43bf02b9278ae))
* **09-03:** implement catalog chunk schemas and steering builder ([fad6ef3](https://github.com/k-leumas/queque/commit/fad6ef3ed034a97e45b79db9ec1489ec2d82f099))
* **09-03:** route claude sdk and cli paths through buildSystemPrompt ([f11d400](https://github.com/k-leumas/queque/commit/f11d400d945e9ebaab87e276793348e6218adbe6))
* **09-04:** implement installer choice, package map and guarded install forms ([b9fa02d](https://github.com/k-leumas/queque/commit/b9fa02dac814162968439327cfc13c2e21bd9295))
* **09-04:** tab toggles flagged rows to their install form ([22553c5](https://github.com/k-leumas/queque/commit/22553c52802a3e8984298f68ab2578c26bb69061))
* **09-05:** client sends the validated installed-tools chunk ([c105e57](https://github.com/k-leumas/queque/commit/c105e5762f0edd502b4aa25c3c7b19c6b297b534))
* **09-05:** pong advertises installedTools so stale daemons get replaced ([f225215](https://github.com/k-leumas/queque/commit/f225215c89c1a59e692a9308024c2c2af7e9a774))
* **quick-261011-jbh:** paint an instant frame from the zsh widget ([f16212f](https://github.com/k-leumas/queque/commit/f16212f8bbfdc9ad4328f4549e3fc5d7adee1b9c))
* **quick-261011-jbh:** bundle the client behind a compile-cache launcher ([e8e3127](https://github.com/k-leumas/queque/commit/e8e3127f80ef0668e5e6990929cd8c94f2d6008a))

</details>

### Bug Fixes

- **The Zellij modal stays readable.** The floating pane no longer empties, clips the header, or shrinks while you filter, and height changes apply in order.
- **Missing-tool UI stays still.** ⓘ sits on the explanation, the legend does not jump when you move the selection, and undoing Tab keeps the row on screen.
- **Install hints match your OS.** Linux is not offered Homebrew package names, apt will not suggest packages that are not in Debian, and install forms ignore comments and heredocs.

<details>
<summary>Detailed changes</summary>

* **08-02:** build execFileAsync on spawn so stdin is ignored ([264d430](https://github.com/k-leumas/queque/commit/264d430e835666514eaea481041e50ff49e845ea))
* **09-05:** drop the tab chip from the controls; the ⓘ legend explains tab ([88b08dc](https://github.com/k-leumas/queque/commit/88b08dc1fc80f5256d6a1ab2541d6dc888f1438d))
* **09-05:** show ⓘ before the explanation and a not-installed legend above the controls ([866956d](https://github.com/k-leumas/queque/commit/866956d934dcd630cc5e42581fc31f4014f92c09))
* **09-05:** the ⓘ legend explains that tab prepends the install command ([05c3534](https://github.com/k-leumas/queque/commit/05c35344c79a660502142c240dbe5827fc10fc4b))
* **09-05:** the ⓘ legend explains the mark without naming tools ([612fa07](https://github.com/k-leumas/queque/commit/612fa07fbf3a545fd2041f871a9e979181ff7380))
* **09-05:** use ⓘ for missing tools and drop the footer note that made the modal jump ([3209e9b](https://github.com/k-leumas/queque/commit/3209e9b02a983478d8b2cf0e229ef804daf996a6))
* **09-06:** reset candidate arrival state during render so no stale height leaks ([9a7d4cf](https://github.com/k-leumas/queque/commit/9a7d4cf74fa6c1d76274797db00ef5eb1683f2aa))
* **09-06:** serialize zellij pane resizes so the newest height always wins ([37edd9a](https://github.com/k-leumas/queque/commit/37edd9ab83b14ad85abb05886e978c34322ab857))
* **09:** filter rows by the command text they show, install form included (WR-04) ([6069f44](https://github.com/k-leumas/queque/commit/6069f446bd7104ebbcd59e95c92f5392015ab336))
* **09:** keep a row visible after tab undoes its install form ([674ca9f](https://github.com/k-leumas/queque/commit/674ca9fc23477bfb2f8b0be4b269bf5fa4cc256f))
* **09:** keep timing guards but take the best of 3 runs under load (WR-03) ([ebafa0d](https://github.com/k-leumas/queque/commit/ebafa0d2015ccdd781673d99b13369b64caad4bc))
* **09:** key package aliases by installer so linux never gets brew names (WR-01) ([75f72bd](https://github.com/k-leumas/queque/commit/75f72bd6d9dba521162317d16474a04b4fe468f6))
* **09:** make lookup-only operands of command -v, type and which explicit (WR-05) ([d0cf4e8](https://github.com/k-leumas/queque/commit/d0cf4e870452fda2d28c942df3246b9f7229a9f4))
* **09:** offer no apt install form for kubectl, which is not in debian main ([aa55dd5](https://github.com/k-leumas/queque/commit/aa55dd5f3937991e0ca6a39841daa6422f139d22))
* **09:** read wrapper long options and quoted operands correctly (CR-02) ([b235597](https://github.com/k-leumas/queque/commit/b235597689e51791ff4f8ffbfe59a30f0144f70e))
* **09:** reserve 18 lines for the modal and document the real row count (WR-02) ([eb6fad1](https://github.com/k-leumas/queque/commit/eb6fad1b10e62480279ec56cc58c52f75441d1cd))
* **09:** skip heredoc bodies and line continuations in the lexer (CR-01) ([b8ea9d7](https://github.com/k-leumas/queque/commit/b8ea9d7f57bb182fd1817c455ed4280d8dc361b3))
* **quick-261011-e43:** reserve a pane row for Ink's cursor line ([dbcbdd7](https://github.com/k-leumas/queque/commit/dbcbdd75c03e6d688fc3ac00947bb406367676d8))
* **quick-261011-f9o:** hold the zellij pane height while filtering ([bd0c426](https://github.com/k-leumas/queque/commit/bd0c4265521dc84f6b96cfa19fdbe3a5b0e1d909))

</details>

## [0.4.2](https://github.com/k-leumas/queque/compare/v0.4.1...v0.4.2) (2026-07-30)

### Bug Fixes

- **Claude suggestions work again.** QueQue no longer sends a sampling parameter current Claude models reject, so `??` stops failing on the default model.

<details>
<summary>Detailed changes</summary>

* **provider:** remove deprecated temperature param from Anthropic request ([df712a9](https://github.com/k-leumas/queque/commit/df712a94b010212f3b5202d2be52f5fe08312a99))
* update claude provider to expose model to fix broken test ([2f6f2c5](https://github.com/k-leumas/queque/commit/2f6f2c59ead9dbeb02973cbc65475d6390014244))

</details>

## [0.4.1](https://github.com/k-leumas/queque/compare/v0.4.0...v0.4.1) (2026-07-29)

# [0.4.0](https://github.com/k-leumas/queque/compare/v0.3.9...v0.4.0) (2026-06-19)

### Features

- **Destructive commands are marked before you accept them.** Suggestions that look like they can delete or overwrite data show a yellow warning, so you can still pick them with eyes open.
- **Sensitive paths stay off the wire.** Configurable privacy defaults keep those paths out of provider requests and logs.
- **The Zellij pane fits the list.** The floating pane resizes to the suggestion list instead of leaving a large empty frame.

<details>
<summary>Detailed changes</summary>

* **06:** harden privacy defaults and registry extension seams ([77eb61c](https://github.com/k-leumas/queque/commit/77eb61c3bad1077477e424cf50c9b236e38d41dd))
* **privacy:** add configurable privacy defaults across stack ([c372b94](https://github.com/k-leumas/queque/commit/c372b94cdae2f3266e634cb06776553438da7972))
* **registry:** resolve LLM adapters through provider backend registry ([6c14dd4](https://github.com/k-leumas/queque/commit/6c14dd43aed5aff853f0b201c2279f4a78b6c7ac))
* **safety:** broaden destructive command detection and pin pnpm 11.8 ([1045a22](https://github.com/k-leumas/queque/commit/1045a22637729d99a055af686cf7162f390ee553))
* **ui:** add yellow warning mark on destructive candidates ([7e1fdac](https://github.com/k-leumas/queque/commit/7e1fdac78b23e7b6d934f9f5e5f2049eeb70cf8f))
* **zellij:** resize floating pane to fit modal content ([99adc79](https://github.com/k-leumas/queque/commit/99adc79119e05b59e42ad71a966afd2836783921))

</details>

### Bug Fixes

- **`qq init` only wires a real install.** It looks for actual shell integration, not any mention of queque in your rc file.
- **The candidate list stays aligned.** The gutter and selection marker no longer jump as you move through wrapped rows.

<details>
<summary>Detailed changes</summary>

* **build:** allow esbuild install scripts and ignore stray workspace yaml ([8fcc723](https://github.com/k-leumas/queque/commit/8fcc723b0e2eded1e77fbf43ce6fd08c63a3e0ae))
* **ci:** allow esbuild and lefthook build scripts in pnpm 11 ([d09bfeb](https://github.com/k-leumas/queque/commit/d09bfeb1b7a8563fb039bf4830b9595534db4217))
* **init:** detect real shell integration, not any queque mention ([0831827](https://github.com/k-leumas/queque/commit/0831827d1dba324a4229a6364593d8eb2646f842))
* **privacy:** broaden rm destructive warning and close review ([54807d3](https://github.com/k-leumas/queque/commit/54807d3252edc83392babfbe255072e701f98d06))
* **ui:** restore ControlsLine key badge styling ([d9f8a96](https://github.com/k-leumas/queque/commit/d9f8a965a30738922429c7ed78875dfb0f599038))
* **ui:** stabilize candidate list gutter and extend selection tail ([1eb196c](https://github.com/k-leumas/queque/commit/1eb196ce78a86009aeef2341addeb7905835cc86))
* **zellij:** keep config pane height until candidates load ([1d2b2cd](https://github.com/k-leumas/queque/commit/1d2b2cd7cb9204b240d7a72a905819baa7169f5b))

</details>

## [0.3.9](https://github.com/k-leumas/queque/compare/v0.3.8...v0.3.9) (2026-06-09)

## [0.3.8](https://github.com/k-leumas/queque/compare/v0.3.7...v0.3.8) (2026-06-09)

## [0.3.7](https://github.com/k-leumas/queque/compare/v0.3.6...v0.3.7) (2026-06-09)

## [0.3.6](https://github.com/k-leumas/queque/compare/v0.3.5...v0.3.6) (2026-06-09)

## [0.3.5](https://github.com/k-leumas/queque/compare/v0.3.4...v0.3.5) (2026-06-09)

## [0.3.4](https://github.com/k-leumas/queque/compare/v0.3.3...v0.3.4) (2026-06-09)

## [0.3.3](https://github.com/k-leumas/queque/compare/v0.3.2...v0.3.3) (2026-06-09)

## [0.3.2](https://github.com/k-leumas/queque/compare/v0.3.1...v0.3.2) (2026-06-09)

## [0.3.1](https://github.com/k-leumas/queque/compare/v0.3.0...v0.3.1) (2026-06-09)

# [0.3.0](https://github.com/k-leumas/queque/compare/v0.2.13...v0.3.0) (2026-06-09)

### Features

- **Dev builds show what you are running.** The TUI includes a version and git SHA badge so a local build is obvious next to a Homebrew install.

<details>
<summary>Detailed changes</summary>

* embed git SHA + version in bundle; show dev badge in TUI ([e8d94bb](https://github.com/k-leumas/queque/commit/e8d94bb8298bffd385533e97f9c19a8258f26222))

</details>

### Bug Fixes

- **Errors show up on the terminal.** Provider failures print where you can see them, including in zsh and Zellij, instead of disappearing.
- **The Zellij title no longer stacks or repeats.** The modal keeps a single title row and stays within the terminal width.

<details>
<summary>Detailed changes</summary>

* **build:** add src/ path to paths watched by the build dashboard script ([1e59602](https://github.com/k-leumas/queque/commit/1e59602c84ced74cb2b54058b9f99b557c7fec34))
* cap modal width at terminal columns to fix title stacking in zellij ([58a1b96](https://github.com/k-leumas/queque/commit/58a1b969198078dd4f890eb6bd32c0b38179cc54))
* prevent Ink raw mode crash and fix env-file CWD search in production ([c34d242](https://github.com/k-leumas/queque/commit/c34d242bd854d95ffc882776c41593073972f2a2))
* prevent title repeat in zellij modal by setting flexGrow={0} ([0807ead](https://github.com/k-leumas/queque/commit/0807ead047f09aea602be50510afaf9700fedb3c))
* surface provider errors visibly in terminal on ?? ([dae2aba](https://github.com/k-leumas/queque/commit/dae2abab6f5d35dd8b3f3eac1949b7ac51ef33df))
* use plain print for error so ZLE positions error message above next prompt ([b3fbb85](https://github.com/k-leumas/queque/commit/b3fbb8584c231530fda216a5ac8747faa91fd473))
* write errors to TTY directly so they are always visible ([8fee954](https://github.com/k-leumas/queque/commit/8fee954423c014229c87bd7928fa2a8c71f11bd8))

</details>

## [0.2.13](https://github.com/k-leumas/queque/compare/v0.2.12...v0.2.13) (2026-06-04)

### Bug Fixes

- **The Homebrew `qq` binary actually starts.** A symlink install no longer skips `main`, so `??` works from a brew prefix.

<details>
<summary>Detailed changes</summary>

* resolve symlink in isDirectRun check so Homebrew binary invokes main ([a46d7a5](https://github.com/k-leumas/queque/commit/a46d7a5a52087a7532a2e1c096430a30319b4231))

</details>

## [0.2.12](https://github.com/k-leumas/queque/compare/v0.2.11...v0.2.12) (2026-06-04)

### Bug Fixes

- **Production stays quiet, and shell install is safer.** Error noise is limited in prod, and the zshrc append will not blindly duplicate integration.

<details>
<summary>Detailed changes</summary>

* err only logs in prod + add guard for zsh install script append zhrc ([ef82529](https://github.com/k-leumas/queque/commit/ef825293f2aa6123d65d89b8e575b616f255244b))
* resolve biome lint errors and tighten lefthook to staged files ([9f926c6](https://github.com/k-leumas/queque/commit/9f926c66bde83c5348bc9b4bb55d3134ed328ede))

</details>

## [0.2.11](https://github.com/k-leumas/queque/compare/v0.2.10...v0.2.11) (2026-05-30)

### Bug Fixes

- **Git hooks are skipped outside a git repo.** Installing the package in a non-repo prefix no longer tries to set up lefthook.

<details>
<summary>Detailed changes</summary>

* skip lefthook install when not in a git repo ([8035e23](https://github.com/k-leumas/queque/commit/8035e23b03b463adf61f230baa128ffba79dfa29))

</details>

## [0.2.10](https://github.com/k-leumas/queque/compare/v0.2.9...v0.2.10) (2026-05-30)

### Bug Fixes

- **Homebrew builds the CLI before installing it.** The formula compiles `dist` first so the installed `qq` is a complete binary.

<details>
<summary>Detailed changes</summary>

* build dist before npm global install in homebrew formula ([6a4b60d](https://github.com/k-leumas/queque/commit/6a4b60d3c4bce091990a382e8128fcb975ca3fa5))

</details>

## [0.2.9](https://github.com/k-leumas/queque/compare/v0.2.8...v0.2.9) (2026-05-30)

### Bug Fixes

- **Homebrew links `qq` from the npm libexec path.** The formula points at the real binary instead of a missing wrapper.

<details>
<summary>Detailed changes</summary>

* symlink qq binary directly from npm libexec path in homebrew formula ([3736a05](https://github.com/k-leumas/queque/commit/3736a05228d69378a5a307b1a40befb758e657f1))

</details>

## [0.2.8](https://github.com/k-leumas/queque/compare/v0.2.7...v0.2.8) (2026-05-30)

### Bug Fixes

- **The widget finds the real `qq` binary.** A shell function named `qq` no longer shadows the CLI when the widget resolves it.

<details>
<summary>Detailed changes</summary>

* use whence -p in widget to bypass qq shell function when resolving binary ([dcc1623](https://github.com/k-leumas/queque/commit/dcc1623e4f70651b6a6bd0231686d5207a2f936b))

</details>

## [0.2.7](https://github.com/k-leumas/queque/compare/v0.2.6...v0.2.7) (2026-05-30)

## [0.2.6](https://github.com/k-leumas/queque/compare/v0.2.5...v0.2.6) (2026-05-30)

## [0.2.5](https://github.com/k-leumas/queque/compare/v0.2.4...v0.2.5) (2026-05-30)

## [0.2.4](https://github.com/k-leumas/queque/compare/v0.2.3...v0.2.4) (2026-05-30)

## [0.2.3](https://github.com/k-leumas/queque/compare/v0.2.2...v0.2.3) (2026-05-30)

## [0.2.2](https://github.com/k-leumas/queque/compare/v0.2.1...v0.2.2) (2026-05-30)

## [0.2.1](https://github.com/k-leumas/queque/compare/v0.2.0...v0.2.1) (2026-05-30)

# [0.2.0](https://github.com/k-leumas/queque/compare/v0.1.0...v0.2.0) (2026-05-30)

### Features

- **`qq init` sets up shell integration.** The widget script is `queque.zsh`, so install is a command instead of a hand-edited rc snippet.

<details>
<summary>Detailed changes</summary>

* add qq init command and rename shell script to queque.zsh ([c7a1b56](https://github.com/k-leumas/queque/commit/c7a1b560e50cd14e18f4380758406ecc1699c0e9))

</details>

# 1.0.0 (2026-05-23)

### Features

- **Type `??` on the zsh command line to get ranked shell commands.** Pick one and it returns to your live buffer — QueQue never runs it for you.
- **A selection UI explains each command.** Filter the list, read what a suggestion does, and accept or cancel without leaving the terminal.
- **Zellij gets a floating pane; everyone else gets an inline modal.** Either way, cancel restores the prompt you were editing.
- **A background daemon keeps repeat `??` invocations warm.** You are not paying a full cold start on every question.

<details>
<summary>Detailed changes</summary>

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

</details>

### Bug Fixes

- **The TUI cleans up on cancel and signals.** Leaving the modal does not leave leftover UI on the prompt.
- **The selected command lands on a fresh prompt.** Accepting a suggestion no longer fights zsh line editing.

<details>
<summary>Detailed changes</summary>

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

</details>

# [1.1.0](https://github.com/k-leumas/que-que/compare/v1.0.0...v1.1.0) (2026-05-02)

### Features

- **Early development snapshot (versioning was later reset).** Intent routing and a first candidate-selection UI landed here before the 0.2 numbering.

<details>
<summary>Detailed changes</summary>

* **02-01:** add request contracts ([9b96f9b](https://github.com/k-leumas/que-que/commit/9b96f9bbfecb5db0fe581b9cc42f6f0c4efa1ef1))
* **02-01:** implement classifyIntent router ([3e0b195](https://github.com/k-leumas/que-que/commit/3e0b195a38d15416137e18923c7d2cfaf5fb006a))
* **02-02:** add context pipeline and candidate selection ([3ed1520](https://github.com/k-leumas/que-que/commit/3ed1520b4377d43f9caaf89a7cf6eea3c25be508))
* **02-03:** add registry bootstrap for built-in providers ([a8b8e02](https://github.com/k-leumas/que-que/commit/a8b8e02d6589b582dd79a3ddd62fca7651dcada1))
* **ui:** add forced selector candidate mode ([908fa17](https://github.com/k-leumas/que-que/commit/908fa176bde48e01aa162227fb257a832432151f))

</details>

### Bug Fixes

<details>
<summary>Detailed changes</summary>

* **build:** manually fix linting issues ([8149904](https://github.com/k-leumas/que-que/commit/814990466d6745e81d51bd9c7b7e1fabb4be1b3b))

</details>

# 1.0.0 (2026-05-02)

### Features

- **First cut of the zsh `??` bridge.** The widget, daemon, and result contract existed as a usable prototype before the later 0.x release line.

<details>
<summary>Detailed changes</summary>

* **01-01:** implement shell and IPC contracts with socket path helper ([8ba3e29](https://github.com/k-leumas/que-que/commit/8ba3e29e2dfd4136dfc053a28af0943a694b2135))
* **01-02:** implement zsh ZLE widget with ?? trigger and result application ([6ce8139](https://github.com/k-leumas/que-que/commit/6ce813968bd109d6dfbdde30dc19dfa15379c5f2))
* **01-03:** implement daemon bootstrap, server, and CLI wiring ([faa5af3](https://github.com/k-leumas/que-que/commit/faa5af3436e9a1a030ecfc4dc4914dbe1e250587))
* **01-03:** implement foreground client loop, result writer, and client CLI wiring ([4ab40a1](https://github.com/k-leumas/que-que/commit/4ab40a12e1df966814dcf31ceac250ac68683d1e))
* **02-02:** add Task 3 — multi-candidate response and minimal selection UI ([a1e8d02](https://github.com/k-leumas/que-que/commit/a1e8d023437772205d6ec89de623fd0d07dfb504))
* add dev restart watcher ([dd774e7](https://github.com/k-leumas/que-que/commit/dd774e7d92f418dbfc3977e59fabc98e8d4ee516))
* select available claude model ([b74f2e2](https://github.com/k-leumas/que-que/commit/b74f2e26911317303208d7e344066b231ea51019))
* tighten shell bridge logging ([e8d8a1d](https://github.com/k-leumas/que-que/commit/e8d8a1d0430b85994c7c886c169e7c28409e391e))

</details>

### Bug Fixes

<details>
<summary>Detailed changes</summary>

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

</details>
