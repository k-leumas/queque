import { writeSync } from 'node:fs';
import { commandWords, lexHand } from './extract.mjs';
const alphabet = 'ab $()`\'"|&;<>{}[]\\#=\n\t-';
const which = process.argv[2];
if (which === 'deep') { const t0 = performance.now(); commandWords(lexHand('$('.repeat(Number(process.argv[3]))), new Set(), lexHand); console.log('deep', process.argv[3], (performance.now()-t0).toFixed(1), 'ms'); process.exit(0); }
for (let n = 0; n < 20000; n++) {
  let s = ''; const L = 1 + Math.floor(Math.random() * 40);
  for (let i = 0; i < L; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  writeSync(2, JSON.stringify(s) + '\n');
  commandWords(lexHand(s), new Set(), lexHand);
}
console.log('fuzz ok');
