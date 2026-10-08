/**
 * Child-process fuzz harness for src/shared/command-words.ts (Phase 9, D-03 / SC-5).
 *
 * Imports the real shipped source through Node 24's native type stripping — the lexer is never
 * copied here, so the fuzzed code is the shipped code. Run by tests/command-words-fuzz.test.ts
 * under spawnSync with hard timeouts, so a hang kills this process instead of the test runner.
 *
 * Modes:
 *   fuzz <count> [seed]  seeded random inputs over the spike 002 alphabet
 *   one <input>          a single input
 *   deep <n>             n nested `$(` substitutions, timed
 *
 * Exit codes: 0 ok, 2 an input exceeded the soft per-input budget, 3 a word contained `undefined`.
 * A throw from the raw lexHand/commandWords calls exits non-zero through Node's default handler.
 * Before each fuzz input its JSON is written to stderr, so after a kill the last stderr line is
 * the culprit.
 */
import { writeSync } from 'node:fs';
import { commandWords, extractCommandWords, lexHand } from '../../src/shared/command-words.ts';

// Copied from the spike 002 fuzz-child.mjs alphabet.
const ALPHABET = 'ab $()`\'"|&;<>{}[]\\#=\n\t-';
const SOFT_BUDGET_MS = 250;
const EMPTY = new Set();

/** Synchronous stdout line: survives an immediate process.exit on a pipe. */
function out(line) {
  writeSync(1, `${line}\n`);
}

/** mulberry32 seeded PRNG: returns a function yielding floats in [0, 1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs the raw functions (throws surface) then the safe wrapper; exits 3 on an `undefined` word. */
function check(s) {
  const raw = commandWords(lexHand(s), EMPTY);
  const safe = extractCommandWords(s, EMPTY);
  for (const { word } of [...raw, ...safe]) {
    if (word.includes('undefined')) {
      out(`undefined-leak ${JSON.stringify(s)}`);
      process.exit(3);
    }
  }
}

const mode = process.argv[2];

if (mode === 'fuzz') {
  const count = Number(process.argv[3] ?? '20000');
  const seed = Number(process.argv[4] ?? '1');
  out(`fuzz seed ${seed}`);
  const rand = mulberry32(seed);
  for (let n = 0; n < count; n++) {
    let s = '';
    const len = 1 + Math.floor(rand() * 40);
    for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
    writeSync(2, `${JSON.stringify(s)}\n`);
    const t0 = performance.now();
    check(s);
    const ms = performance.now() - t0;
    if (ms > SOFT_BUDGET_MS) {
      out(`slow ${JSON.stringify(s)} ${ms.toFixed(1)}`);
      process.exit(2);
    }
  }
  out(`fuzz ok ${count} seed ${seed}`);
} else if (mode === 'one') {
  check(process.argv[3] ?? '');
  out('one ok');
} else if (mode === 'deep') {
  const n = Number(process.argv[3] ?? '2000');
  const t0 = performance.now();
  commandWords(lexHand('$('.repeat(n)), EMPTY);
  out(`deep ${n} ${(performance.now() - t0).toFixed(1)} ms`);
} else {
  writeSync(2, `unknown mode ${String(mode)}; expected fuzz, one or deep\n`);
  process.exit(64);
}
