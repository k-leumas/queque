// Spike 002 runner: accuracy of hand lexer vs shell-quote, plus per-candidate cost and
// installed/missing classification against the live zsh tables (same handoff as spike 001).
import { execFileSync } from 'node:child_process';
import { parse as sqParse } from 'shell-quote';
import { cases } from './cases.mjs';
import { commandWords, fromShellQuote, lexHand } from './extract.mjs';

const zsh = (expr) =>
  execFileSync('zsh', ['-c', `zmodload zsh/parameter; rehash; print -rl -- ${expr}`], { encoding: 'utf8' })
    .trim().split('\n');
const installed = new Set(zsh('${(k)commands}'));
const builtins = new Set(zsh('${(k)builtins}'));
console.log(`installed=${installed.size} builtins=${builtins.size}\n`);

const externals = (r) => r.filter((x) => x.kind === 'external').map((x) => x.word);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const lexers = {
  hand: (cmd) => commandWords(lexHand(cmd), builtins, lexHand),
  'shell-quote': (cmd) => {
    const lex = (t) => fromShellQuote(sqParse(t, (k) => `$${k}`));
    return commandWords(lex(cmd), builtins, lex);
  },
};

for (const [name, fn] of Object.entries(lexers)) {
  let core = 0, coreN = 0, stretch = 0, stretchN = 0;
  const fails = [];
  for (const c of cases) {
    let got;
    try { got = externals(fn(c.cmd)); } catch (e) { got = [`THROW ${e.message}`]; }
    const ok = same(got, c.expect);
    if (c.tier === 'core') { coreN++; core += ok; } else { stretchN++; stretch += ok; }
    if (!ok) fails.push(`  ✗ [${c.tier}] ${c.cmd}\n      want ${JSON.stringify(c.expect)}\n      got  ${JSON.stringify(got)}`);
  }
  const t0 = performance.now();
  const N = 2000;
  for (let i = 0; i < N; i++) for (const c of cases) fn(c.cmd);
  const perCmdUs = ((performance.now() - t0) * 1000) / (N * cases.length);
  console.log(`== ${name}: core ${core}/${coreN}, stretch ${stretch}/${stretchN}, ${perCmdUs.toFixed(1)} µs/command`);
  if (fails.length) console.log(fails.join('\n'));
  console.log();
}

console.log('== classification against live $commands (hand lexer) ==');
const samples = [
  'brew install fd && fd -e ts',
  'rg TODO | fzf --preview "bat {}"',
  'exa -la --git',
  'htop',
  'gdu ~',
  'kill -9 $(lsof -ti :3000)',
  '<editor> ~/.zshrc',
];
for (const cmd of samples) {
  const words = lexers.hand(cmd);
  const tags = words.map(({ word, kind }) =>
    kind === 'external' ? `${word}:${installed.has(word) ? 'installed' : 'MISSING'}` : `${word}:${kind}`);
  const missing = words.filter((w) => w.kind === 'external' && !installed.has(w.word)).map((w) => w.word);
  console.log(`${missing.length ? '⚑' : '✓'} ${cmd}\n    ${tags.join('  ')}${missing.length ? `\n    flag: not installed — ${missing.join(', ')}` : ''}`);
}
