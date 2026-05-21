# T01: 03.2 01

**Slice:** S05 — **Milestone:** M001

## Description

Update both existing test files so that they cover Phase 3.2 behaviors before the production files are modified. This is the Wave 1 foundation: the tests go RED first (or are neutral stubs) so that Wave 2 implementation has immediate automated feedback.

Purpose: Establish the test contracts for (a) FIFO-aware write in result-writer.ts, (b) $ZELLIJ detection and skip in run-foreground.ts, and (c) Zellij detection guard in the zsh widget. All tests must use the correct mock shape so existing passing tests remain green after this plan lands.

Output: Two modified test files. No production code changes in this plan.

## Must-Haves

- [ ] "pnpm test:run exits 0 with updated mocks in place (stat mock does not break existing writeShellResult tests)"
- [ ] "client-result.test.ts mock for node:fs/promises includes a stat function returning isFIFO() => false by default"
- [ ] "client-result.test.ts includes a test asserting writeShellResult uses fsp.writeFile directly when isFIFO() => true"
- [ ] "zsh-widget.test.ts includes a test asserting Zellij detection: script exits non-zero and contains expected message when ZELLIJ is unset"
- [ ] "zsh-widget.test.ts includes a test asserting the widget uses mkfifo and zellij run (grep-based static checks)"

## Files

- `tests/client-result.test.ts`
- `tests/zsh-widget.test.ts`
