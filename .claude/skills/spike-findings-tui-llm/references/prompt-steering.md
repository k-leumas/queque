# Prompt Steering With the Installed List

> Based on a PARTIAL spike: 6 complete queries out of 15, because the run hit an Anthropic
> credit-balance error. The direction is consistent, but finish the run
> (`QUERY_START=6`, see sources/003-prompt-steering/README.md) before treating the numbers as final.

## Requirements

- zsh `$commands` (rehashed) is the source of truth for what's installed.
- Suggestions using missing tools are shown flagged, not dropped. Prompt steering reduces how
  often that happens. It does not replace the flag.
- Don't send the full `$commands` list to the model.

## How to Build It

1. Ship a curated catalog of notable CLI tools that have common alternatives (about 250 names; start
   from `sources/003-prompt-steering/catalog.ts`): rg/ag/fd/fzf/bat/eza/jq/yq/dust/gdu/ncdu/
   htop/btop/xh/httpie/delta/gh/lazygit/docker/kubectl/ffmpeg/magick/entr/watchexec/
   hyperfine/csvlook/vd/… Leave out basic POSIX/macOS utilities, since every machine has them.
2. At request time compute `catalog ∩ installed`, which was **55 names** on the test machine.
3. Append it to the system prompt (`QUEQUE_SYSTEM` in `src/providers/claude.ts`):

   ```
   Notable command-line tools installed on this machine (standard system utilities are also present): rg ag fzf bat jq gdu …
   Prefer tools that are installed. Suggest a tool that is not installed only when no installed tool can do the job, and rank it last.
   ```

   The "standard system utilities are also present" clause matters. Without it, a short list
   could make the model think coreutils are absent.
4. Keep the candidate check (`candidate-command-check.md`) as the safety net after the response.
5. Apply the same steering to the `claude -p` CLI path (`--system-prompt` takes `QUEQUE_SYSTEM`)
   and to future OpenAI/Ollama adapters, so behaviour doesn't depend on the provider.

## What to Avoid

- **Sending the full list** (2,175 names, about +10.3k input tokens, ~33× the base prompt). In the
  sample it was no better at avoiding missing tools: the cached full-list variant still
  suggested `htop` (not installed), and the full list offered `eza` (not installed) as its
  only answer for "icons". A long list buries the signal.
- **Relying on prompt caching to make the full list affordable.** It needs a stable prefix of at
  least 1,024 tokens and expires after about 5 minutes without use. It cut the token cost but showed
  no clear latency gain, and occasional `??` use would mostly hit a cold cache.
- **Dropping the flag because steering exists.** No-list and full-list both leaked `htop`.

## Constraints

Measured on `claude-sonnet-5`, 6 queries per variant:

| Variant | Input tokens | Median latency | Flagged |
|---|---|---|---|
| no list | ~320 | ~2.25 s | 1/18 |
| catalog ∩ installed | ~545 | ~2.2 s | 0/18 |
| full list | ~10,630 | ~2.7 s | 0/17 (+1 on a partial query) |
| full list, cached | 170 + 10,467 cache read | ~2.4 s | 1/18 |

- Latency differences are within noise at n=6.
- The catalog is hand-curated. Open decision on where it lives: shipped data in `src/`,
  user-extensible in config, or derived (e.g. `brew leaves`, which is personal but brew-only).

## Origin

Synthesized from spikes: 003 (PARTIAL), building on 001 and 002
Source files available in: sources/003-prompt-steering/
