---
spike: 003
idea: installed-only-commands
name: prompt-steering
type: comparison
validates: "Given real ?? queries, when the prompt carries (A) nothing, (B) installed ∩ curated catalog, (C) the full $commands list, or (D) C with prompt caching, then compare the share of suggestions using missing tools, steering toward installed tools, added input tokens, and latency"
verdict: PARTIAL
related: [001, 002]
tags: [prompt, steering, tokens, latency, prompt-caching, anthropic]
---

# Spike 003: Prompt steering with the installed list

## What This Validates
Whether telling the model what's installed is worth it, on top of the spike 002 flagging that
happens after the response arrives, and which form of list to send.

| Variant | What the system prompt gets |
|---|---|
| A flag-only | today's `QUEQUE_SYSTEM`, unchanged |
| B catalog | + installed ∩ `catalog.ts` (~250 notable tools with alternatives) = **55 names** here, plus "prefer installed" |
| C full | + all 2,175 rehashed `$commands` names, plus "prefer installed" |
| D full+cache | C with `cache_control: ephemeral` on the system block |

## Research
- Uses QueQue's real `buildPrompt`, `QUEQUE_SYSTEM`, `parseCandidates`, model resolution
  (`claude-sonnet-5` via DEFAULT_MODEL) and `.env.local` key loading, bundled with the project's
  tsup. The prompts are byte-for-byte what `??` sends. The key is never printed.
- Prompt caching needs a stable prefix of at least 1,024 tokens, and the cache expires after
  about 5 minutes without use. Only C/D's list is long enough to cache. B is too short to cache
  but also too small to need it.

## How to Run
```
pnpm exec tsup .planning/spikes/003-prompt-steering/compare.ts --format esm --platform node \
  --target node20 -d .planning/spikes/003-prompt-steering/out --no-dts
node .planning/spikes/003-prompt-steering/out/compare.js                 # from repo root
QUERY_START=6 node .planning/spikes/003-prompt-steering/out/compare.js   # resume the remaining 9 queries
```
Makes 4 real API calls per query. A full run is 60 calls, about $0.50–1, mostly from C's
~10k-token prompts.

## Investigation Trail
1. First run: **25/60 calls succeeded**, then every call returned
   `400 Your credit balance is too low to access the Anthropic API`. Complete data for queries
   1–6 plus C on query 7. Log: `results/run-1-partial.log`.
2. The raw JSON was lost because `import.meta.url` pointed into the bundled `out/` dir.
   Fixed: results now go to `results/run-from-N.raw.json` (resolved from cwd) after every call,
   and `QUERY_START` resumes a run.
3. Observations on the 6 complete queries:

| Variant | Input tokens/call | Median latency | Suggestions flagged missing | Steering |
|---|---|---|---|---|
| A | ~320 | ~2.25 s | 1/18 (`htop`) | coreutils-first (`grep`, `du`, `top`) |
| B | ~545 (**+225**) | ~2.2 s | **0/18** | picked installed alternatives: `gdu`, `bat`, `rg`, `ag` |
| C | ~10,630 (**+10.3k**) | ~2.7 s | 0/17 (+`eza` on q7) | similar to B, slightly more conservative |
| D | 170 + 10,467 cache read | ~2.4 s | 1/18 (`htop`) | same as C |

4. **Surprise:** D had all 2,175 names in front of it and still suggested `htop`, which isn't
   installed. C on query 7 offered `eza` (also missing) as its only "icons" answer. A long list
   doesn't stop the model from proposing missing tools. It gets buried. The short list in B
   didn't leak once in 18 suggestions.
5. Latency differences are within noise at n=6 (one C call took 11 s, the outlier). Prompt
   caching saved input-token cost on D but showed no clear latency gain at this size.

## Results
**PARTIAL.** The trend is consistent but the sample is small (6 queries), so it isn't validated.

- **Leading option: B (installed ∩ curated catalog) plus spike 002 flagging as the safety net.**
  It costs about +225 tokens with no measurable latency, visibly steers toward tools you
  actually have, and the list only changes when a catalog tool is installed or removed.
- **Ruled out for now: C and D (full list).** About 33× the input tokens, and in this sample
  no better at avoiding missing tools than B, arguably worse. Caching recovers the cost only
  while the 5-minute cache stays warm.
- Flagging is still needed under every variant: A and D both leaked `htop`.

To promote this to VALIDATED, top up API credits and run `QUERY_START=6` to finish the
remaining 9 queries, which include the alternative-heavy ones (`eza`, `xh`/`httpie`, `ffmpeg`,
`magick`, `tree`, `entr`/`watchexec`, `hyperfine`, `csvlook`/`vd`).

Open design question for the build: the catalog is hand-curated. Options are to ship it as data
in `src/`, let users extend it in config, or derive it, e.g. from the brew formulae a user has
explicitly installed (`brew leaves`) — this keeps it personal, but brew-only.
