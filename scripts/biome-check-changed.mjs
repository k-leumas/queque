#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { changedFilesFromBase } from './changed-files-from-base.mjs';

const LINTABLE_RE = /\.(?:js|cjs|mjs|ts|tsx|json|ya?ml)$/;
const ALL_AFFECTING_FILES = new Set(['biome.json', 'biome.jsonc']);

function gitPathList(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout.split('\0').filter(Boolean);
}

function allLintablePaths() {
  return gitPathList(['ls-files', '-z']).filter(
    (path) => LINTABLE_RE.test(path) && existsSync(path),
  );
}

const { base, files: changedFiles } = changedFilesFromBase();
if (!base) {
  console.error(
    'biome: cannot check files changed from base because no base ref was found. Fetch origin/main or set QQ_BASE_REF.',
  );
  process.exit(1);
}

const changed = new Set(changedFiles);

const shouldLintAll = [...changed].some((path) => ALL_AFFECTING_FILES.has(path));
const files = shouldLintAll
  ? allLintablePaths()
  : [...changed].filter((path) => LINTABLE_RE.test(path) && existsSync(path));

const uniqueFiles = [...new Set(files)].sort();

if (uniqueFiles.length === 0) {
  const baseLabel = base ? `${base.ref} (${base.mergeBase.slice(0, 7)})` : 'working tree only';
  console.log(`biome: no changed lintable files relative to ${baseLabel}`);
  process.exit(0);
}

if (base) {
  console.log(
    `biome: checking ${uniqueFiles.length} lintable file(s) changed relative to ${base.ref} (${base.mergeBase.slice(0, 7)})`,
  );
} else {
  console.log(`biome: checking ${uniqueFiles.length} changed lintable file(s); no base ref found`);
}

if (shouldLintAll) {
  console.log('biome: config changed, checking all lintable files');
}

const result = spawnSync(
  'pnpm',
  ['exec', 'biome', 'check', '--write', '--no-errors-on-unmatched', ...uniqueFiles],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
