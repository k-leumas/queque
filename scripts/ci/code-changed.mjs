#!/usr/bin/env node
// CI path filter for .github/workflows/ci.yml (D-14). Decides whether a push or PR
// changed anything besides documentation and planning files, and writes `code=true`
// or `code=false` to $GITHUB_OUTPUT so the heavy jobs can be skipped by `if:`
// (a skipped job reports success, so required checks never sit Pending).
//
// Base: QQ_CHANGES_BASE (the PR base SHA; ci.yml leaves it empty for pushes) when it
// is set, not all zeros and present in the clone; otherwise the merge base with
// main/master from resolveBaseRef(). A base that is HEAD itself (a push to main, whose
// merge base with main is HEAD) leaves nothing to compare and runs everything. Every
// failure to compute the diff fails open to `code=true`, and the script exits 0 unless
// $GITHUB_OUTPUT itself cannot be written.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolveBaseRef } from '../changed-files-from-base.mjs';

const DOC_ONLY_PREFIXES = ['.planning/', '.wolf/', 'docs/', '.github/ISSUE_TEMPLATE/'];

/** True for paths whose change cannot affect the build, tests or smoke. */
export function isDocOnlyPath(path) {
  if (path === 'LICENSE') return true;
  if (path.endsWith('.md')) return true;
  return DOC_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True when any changed path is not doc-only. */
export function codeChanged(paths) {
  return paths.some((path) => !isDocOnlyPath(path));
}

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function explicitBase() {
  const base = process.env.QQ_CHANGES_BASE?.trim();
  if (!base || /^0+$/.test(base)) return null;
  return git(['cat-file', '-e', `${base}^{commit}`]).status === 0 ? base : null;
}

function commitOf(ref) {
  const result = git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Returns { code, paths, base }; code is true whenever the diff cannot be computed. */
function decide() {
  const base = explicitBase() ?? resolveBaseRef()?.mergeBase ?? null;
  if (!base) return { code: true, paths: [], base: null };
  // An empty range is no evidence of a doc-only change (WR-04): on main the merge base with
  // main is HEAD, and `HEAD...HEAD` would skip every check on every push to main.
  const head = commitOf('HEAD');
  if (head === null || head === commitOf(base)) return { code: true, paths: [], base };
  const diff = git(['diff', '--name-only', '-z', `${base}...HEAD`]);
  if (diff.status !== 0) return { code: true, paths: [], base };
  const paths = diff.stdout.split('\0').filter(Boolean);
  return { code: codeChanged(paths), paths, base };
}

function report({ code, paths, base }) {
  const value = code ? 'true' : 'false';
  const short = base ? base.slice(0, 7) : 'none';
  process.stdout.write(`code=${value} (${paths.length} changed paths, base ${short})\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `code=${value}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let decision;
  try {
    decision = decide();
  } catch (error) {
    process.stderr.write(`code-changed: ${error?.message ?? error}; running everything\n`);
    decision = { code: true, paths: [], base: null };
  }
  try {
    report(decision);
    process.exitCode = 0;
  } catch (error) {
    // No step output would read as "skip everything", so fail the job instead: ci-ok
    // then fails on the `changes` result rather than passing on skipped jobs.
    process.stderr.write(
      `code-changed: could not write the decision: ${error?.message ?? error}\n`,
    );
    process.stdout.write('code=true\n');
    process.exitCode = 1;
  }
}
