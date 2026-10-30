#!/usr/bin/env node
// One-off preservation check for quick task 261030-fdr: every line of the README at b45f6db
// must still exist in README.md or one of the five docs pages it was split into. Link targets,
// a leading `> `, heading markers and whitespace runs are normalized away on both sides.
// Exit 0 when nothing is missing; otherwise print each missing line and exit 1.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'b45f6db';

const CORPUS_FILES = [
  'README.md',
  'docs/INSTALL.md',
  'docs/PROVIDERS.md',
  'docs/USAGE.md',
  'docs/PRIVACY.md',
  'docs/CONFIGURATION.md',
];

// Decorative or duplicate lines the reshaped README drops on purpose. Never add an entry to
// make the check pass: a missing line means content was lost.
const ALLOWED_DROPS = new Set([
  '#### Copy-pasting commands from the browser is dead.',
  'Welcome to the **future** –',
  '> [!NOTE]',
  '<details>',
  '</details>',
  '<summary>Install via npm</summary>',
]);

function normalize(line) {
  return line
    .replace(/\]\([^)]*\)/g, ']()')
    .replace(/^\s*> ?/, '')
    .replace(/^\s*#+ /, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFence(line) {
  return /^\s*(`{3,}|~{3,})/.test(line);
}

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const oldReadme = execFileSync('git', ['show', `${BASE}:README.md`], {
  cwd: root,
  encoding: 'utf8',
});

const corpus = CORPUS_FILES.flatMap((file) =>
  readFileSync(resolve(root, file), 'utf8').split('\n').map(normalize),
).join('\n');

let checked = 0;
const missing = [];
for (const line of oldReadme.split('\n')) {
  if (ALLOWED_DROPS.has(line.trim())) continue;
  if (isFence(line)) continue;
  const normalized = normalize(line);
  if (normalized.length < 3) continue;
  checked += 1;
  if (!corpus.includes(normalized)) missing.push(line);
}

if (missing.length > 0) {
  console.error(`${missing.length} line(s) of ${BASE}:README.md are missing from the new docs set:`);
  for (const line of missing) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`ok: all ${checked} checked lines of ${BASE}:README.md are present`);
