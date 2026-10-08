// Spike 003 — does telling the model which tools are installed help, and what does it cost?
// A flag-only     : today's prompt unchanged; spike 002 flags missing tools afterwards
// B catalog       : + installed ∩ curated catalog (~250 notable tools) in the system prompt
// C full          : + the full rehashed $commands list in the system prompt
// D full+cache    : C with cache_control on the system block (stable prefix → cache reads)
// Uses QueQue's own buildPrompt/QUEQUE_SYSTEM/key loading so prompts match real ?? calls.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, DEFAULT_MODEL, parseCandidates, QUEQUE_SYSTEM } from '../../../src/providers/claude.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../../../src/shared/env-file.js';
import type { ContextEnvelope } from '../../../src/contracts/request.js';
// @ts-expect-error untyped spike module
import { commandWords, lexHand } from '../002-candidate-binary-check/extract.mjs';
import { CATALOG } from './catalog.js';

const QUERIES = [
  'find all files larger than 100MB in my home directory',
  'show disk usage of each folder here sorted by size',
  'pretty print the json file data.json',
  'search for TODO in all typescript files',
  'show what process is using port 3000',
  'monitor cpu and memory usage live',
  'list files with git status and icons',
  'send a POST request with a json body to localhost:8080/api',
  'convert video.mov to mp4',
  'resize all png images in this folder to 50%',
  'show a tree of this directory ignoring node_modules',
  'find and delete all .DS_Store files',
  'watch src for changes and rerun the tests',
  'benchmark how long two commands take',
  'view data.csv as a table in the terminal',
];

const zsh = (expr: string): string[] =>
  execFileSync('zsh', ['-c', `zmodload zsh/parameter; rehash; print -rl -- ${expr}`], { encoding: 'utf8' })
    .trim().split('\n');
const installed = new Set(zsh('${(k)commands}'));
const builtins = new Set(zsh('${(k)builtins}'));
const catalogInstalled = CATALOG.filter((t) => installed.has(t));
const fullList = [...installed].sort();

const STEER =
  'Prefer tools that are installed. Suggest a tool that is not installed only when no installed tool can do the job, and rank it last.';
const systemB = `${QUEQUE_SYSTEM}\n\nNotable command-line tools installed on this machine (standard system utilities are also present): ${catalogInstalled.join(' ')}\n${STEER}`;
const systemC = `${QUEQUE_SYSTEM}\n\nAll executables installed on this machine (zsh $commands): ${fullList.join(' ')}\n${STEER}`;

type Variant = 'A' | 'B' | 'C' | 'D';
const system = (v: Variant): Anthropic.MessageCreateParams['system'] =>
  v === 'A' ? QUEQUE_SYSTEM
  : v === 'B' ? systemB
  : v === 'C' ? systemC
  : [{ type: 'text', text: systemC, cache_control: { type: 'ephemeral' } }];

const apiKey = usableSecret(process.env.ANTHROPIC_API_KEY) ?? usableSecret(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY'));
if (!apiKey) throw new Error('no ANTHROPIC_API_KEY in env or .env.local');
const model = process.env.QQ_MODEL ?? readEnvValueFromDotEnvLocal('QQ_MODEL') ?? DEFAULT_MODEL;
const client = new Anthropic({ apiKey });

const envelope = (queryText: string): ContextEnvelope => ({
  base: {
    queryText, cwd: process.env.HOME ?? '/', ttyPath: '/dev/ttys000', shellPid: process.pid,
    shellName: 'zsh', platform: process.platform, timestamp: new Date().toISOString(),
  },
  extras: [],
});

function missingIn(command: string): string[] {
  try {
    return (commandWords(lexHand(command), builtins, lexHand) as Array<{ word: string; kind: string }>)
      .filter((w) => w.kind === 'external' && !installed.has(w.word)).map((w) => w.word);
  } catch { return ['<parse-error>']; }
}

const shuffle = <T,>(a: T[]): T[] => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);

async function main() {
  console.log(`model=${model} installed=${installed.size} catalog∩installed=${catalogInstalled.length}`);
  console.log(`catalog∩installed: ${catalogInstalled.join(' ')}\n`);
  const rows: unknown[] = [];
  // QUERY_START lets a rerun resume after a failure (first run died on credit balance at query 7).
  const start = Number(process.env.QUERY_START ?? 0);
  const rawPath = resolve(process.cwd(), '.planning/spikes/003-prompt-steering/results', `run-from-${start}.raw.json`);
  for (const q of QUERIES.slice(start)) {
    for (const v of shuffle<Variant>(['A', 'B', 'C', 'D'])) {
      const t0 = performance.now();
      let row: Record<string, unknown>;
      try {
        const res = await client.messages.create(
          { model, max_tokens: 1024, system: system(v), messages: [{ role: 'user', content: buildPrompt(envelope(q)) }] },
          { timeout: 25_000 },
        );
        const ms = Math.round(performance.now() - t0);
        const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
        const cands = parseCandidates(text).map((c) => ({ command: c.command, missing: missingIn(c.command) }));
        row = {
          q, v, ms, cands,
          in: res.usage.input_tokens, out: res.usage.output_tokens,
          cacheRead: res.usage.cache_read_input_tokens ?? 0, cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
        };
      } catch (e) {
        row = { q, v, ms: Math.round(performance.now() - t0), error: (e as Error).message };
      }
      rows.push(row);
      writeFileSync(rawPath, JSON.stringify({ model, installed: installed.size, catalogInstalled, rows }, null, 2));
      const r = row as { v: string; ms: number; cands?: Array<{ command: string; missing: string[] }>; error?: string; in?: number; cacheRead?: number };
      console.log(`[${r.v}] ${String(r.ms).padStart(5)}ms in=${r.in ?? '-'} cacheRead=${r.cacheRead ?? '-'} ${q}`);
      for (const c of r.cands ?? []) console.log(`      ${c.missing.length ? '⚑' : '✓'} ${c.command}${c.missing.length ? `   (missing: ${c.missing.join(', ')})` : ''}`);
      if (r.error) console.log(`      ERROR ${r.error}`);
    }
  }
}
main();
