#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { changedFilesFromBase } from './changed-files-from-base.mjs';

const TEST_INPUT_RE = /\.(?:js|cjs|mjs|ts|tsx|json|ya?ml)$/;

const { base, files } = changedFilesFromBase();
const changedInputs = files.filter((path) => TEST_INPUT_RE.test(path));

if (!base) {
  console.error(
    'vitest: cannot run affected tests because no base ref was found. Fetch origin/main or set QQ_BASE_REF.',
  );
  process.exit(1);
}

if (changedInputs.length === 0) {
  console.log(
    `vitest: no changed test inputs relative to ${base.ref} (${base.mergeBase.slice(0, 7)})`,
  );
  process.exit(0);
}

console.log(
  `vitest: running tests affected by changes since ${base.ref} (${base.mergeBase.slice(0, 7)})`,
);

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--passWithNoTests', '--changed', base.mergeBase],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
