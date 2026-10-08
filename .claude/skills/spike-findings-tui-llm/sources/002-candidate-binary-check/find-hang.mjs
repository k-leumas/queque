// Spike 002 — isolate inputs that hang lexHand: each runs in a child with a 1 s timeout.
import { spawnSync } from 'node:child_process';
const inputs = ['echo "unterminated', "rg 'open", 'echo $(date', 'echo `whoami', 'diff <(sort a', '((((((', '))))',
  '$(((', '\\', '"', "'", '<', '>', '<<', '|||', '&&&&', ';;;;', '`', '${', '$(', '# c', '<placeholder',
  'echo "`date', 'echo "a\\', 'x `', '"`', '"$(', 'a"$((1', "a'", 'a"b`c'];
const probe = `import { commandWords, lexHand } from './extract.mjs';
commandWords(lexHand(process.argv[1]), new Set(), lexHand);`;
for (const s of inputs) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe, s], { timeout: 1000 });
  const status = r.error?.code === 'ETIMEDOUT' ? 'HANG' : r.status === 0 ? 'ok' : 'THROW ' + String(r.stderr).split('\n').find((l) => /Error/.test(l));
  if (status !== 'ok') console.log(status.padEnd(6), JSON.stringify(s));
}
console.log('done');
