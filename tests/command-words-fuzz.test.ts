/**
 * Child-process fuzz for src/shared/command-words.ts (D-03, SC-5).
 *
 * Every run happens in a separate Node process with a hard spawnSync timeout, so a lexer hang
 * (spike 002's indexOf rewind) fails the test instead of freezing the runner. The child imports
 * the shipped .ts source directly; see tests/fixtures/command-words-fuzz-child.mjs.
 */
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const childPath = fileURLToPath(
  new URL('./fixtures/command-words-fuzz-child.mjs', import.meta.url),
);

/**
 * Runs the fuzz child with a hard kill after `timeout` ms. The child writes every input's JSON to
 * stderr (about 0.6 MB for 20k inputs); a 16 MiB buffer keeps ENOBUFS from posing as a hang.
 */
function runChild(
  args: readonly string[],
  { timeout }: { timeout: number },
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [childPath, ...args], {
    encoding: 'utf8',
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** Failure context: spawn error code, exit status, stdout and the last stderr line (the culprit). */
function describeRun(r: SpawnSyncReturns<string>): string {
  const lastStderr =
    (r.stderr ?? '')
      .split('\n')
      .filter((line) => line.length > 0)
      .at(-1) ?? '<none>';
  const code = (r.error as NodeJS.ErrnoException | undefined)?.code ?? 'none';
  return `error=${code} status=${String(r.status)} signal=${String(r.signal)} stdout=${JSON.stringify(
    r.stdout ?? '',
  )} last input=${lastStderr}`;
}

/** Asserts a child run finished on its own, exited 0 and printed `marker`. */
function expectCleanRun(r: SpawnSyncReturns<string>, marker: string): void {
  expect(r.error, describeRun(r)).toBeUndefined();
  expect(r.status, describeRun(r)).toBe(0);
  expect(r.stdout, describeRun(r)).toContain(marker);
}

/**
 * Crafted malformed inputs: spike 002 find-hang.mjs verbatim, plus the backtick-inside-double-quotes
 * minimal repro and the trailing-backslash-in-double-quotes inputs.
 */
const CRAFTED_MALFORMED: readonly string[] = [
  'echo "unterminated',
  "rg 'open",
  'echo $(date',
  'echo `whoami',
  'diff <(sort a',
  '((((((',
  '))))',
  '$(((',
  '\\',
  '"',
  "'",
  '<',
  '>',
  '<<',
  '|||',
  '&&&&',
  ';;;;',
  '`',
  '${',
  '$(',
  '# c',
  '<placeholder',
  'echo "`date',
  'echo "a\\',
  'x `',
  '"`',
  '"$(',
  'a"$((1',
  "a'",
  'a"b`c',
  // Minimal repro of the spike hang: backtick inside double quotes, unterminated.
  '"a" "`',
  // Trailing backslash inside double quotes: the escape has no next character.
  '"rg\\',
  'a "b\\',
];

describe('command-words fuzz (child process, hard timeouts)', () => {
  it('20k random inputs finish without hang or throw', () => {
    const r = runChild(['fuzz', '20000', '1'], { timeout: 15_000 });
    expectCleanRun(r, 'fuzz ok 20000');
  }, 20_000);

  it('5k random inputs, second seed, finish without hang or throw', () => {
    const r = runChild(['fuzz', '5000', '7'], { timeout: 10_000 });
    expectCleanRun(r, 'fuzz ok 5000');
  }, 15_000);

  it.each(CRAFTED_MALFORMED)('crafted malformed input %j finishes within 1 s', (input) => {
    const r = runChild(['one', input], { timeout: 1_000 });
    expectCleanRun(r, 'one ok');
  }, 5_000);

  it('deep nesting stays fast (2,000 nested substitutions under 100 ms)', () => {
    const r = runChild(['deep', '2000'], { timeout: 5_000 });
    expectCleanRun(r, 'deep 2000');
    const match = /deep 2000 ([\d.]+) ms/.exec(r.stdout);
    expect(match, describeRun(r)).not.toBeNull();
    expect(Number(match?.[1])).toBeLessThan(100);
  }, 10_000);
});
