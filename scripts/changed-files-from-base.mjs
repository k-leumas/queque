#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';

function git(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitOutput(args) {
  const result = git(args);
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function gitPathList(args) {
  const result = git(args);
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout.split('\0').filter(Boolean);
}

function refExists(ref) {
  return git(['rev-parse', '--verify', '--quiet', ref]).status === 0;
}

export function resolveBaseRef() {
  const candidates = [];

  if (process.env.QQ_BASE_REF) {
    candidates.push(process.env.QQ_BASE_REF);
  }

  if (process.env.GITHUB_BASE_REF) {
    candidates.push(`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF);
  }

  candidates.push('origin/main', 'main', 'origin/master', 'master');

  for (const ref of candidates) {
    if (ref && refExists(ref)) {
      const mergeBase = gitOutput(['merge-base', 'HEAD', ref]);
      if (mergeBase) return { ref, mergeBase };
    }
  }

  return null;
}

export function changedFilesFromBase() {
  const base = resolveBaseRef();
  const files = new Set();

  if (base) {
    for (const path of gitPathList([
      'diff',
      '--name-only',
      '-z',
      '--diff-filter=ACMRTUXB',
      `${base.mergeBase}...HEAD`,
    ])) {
      files.add(path);
    }
  }

  return { base, files: [...files].filter((path) => isFile(path)).sort() };
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files } = changedFilesFromBase();
  process.stdout.write(`${files.join('\n')}${files.length > 0 ? '\n' : ''}`);
}
