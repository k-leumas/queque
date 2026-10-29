#!/usr/bin/env node
// RED stub: the doc-only filter is not implemented yet, so every push runs everything.
import { appendFileSync } from 'node:fs';

export function isDocOnlyPath(_path) {
  return false;
}

export function codeChanged(_paths) {
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write('code=true (0 changed paths, base none)\n');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'code=true\n');
}
