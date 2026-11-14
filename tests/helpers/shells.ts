import { spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { basename, delimiter, isAbsolute, join } from 'node:path';

// ---------------------------------------------------------------------------
// Shell and tool discovery for the PTY harness and the shell adapter tests (Phase 11 D-10).
//
// A missing prerequisite (bash 5+, zsh, jq, tmux) skips the test locally with one warning,
// but fails when CI is set, so a CI leg can never pass by skipping (the rule of
// scripts/smoke-distro.sh, Phase 10 D-16).
// ---------------------------------------------------------------------------

export type ShellKind = 'bash' | 'zsh';

/** Searched after PATH: Homebrew (Apple silicon, Intel), MacPorts, then the system dirs. */
const FALLBACK_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin', '/usr/bin', '/bin'];

const OVERRIDE_ENV: Record<ShellKind, string> = { bash: 'QQ_TEST_BASH', zsh: 'QQ_TEST_ZSH' };

const PROBE_TIMEOUT_MS = 3000;

function isExecutableFile(path: string): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function pathDirs(): string[] {
  return (process.env.PATH ?? '').split(delimiter).filter((dir) => isAbsolute(dir));
}

/**
 * major.minor of a bash or zsh binary (`zsh` in the file name selects the zsh probe), or null
 * when it does not run. No rc files are read.
 */
export function shellVersionOf(bin: string): [number, number] | null {
  const isZsh = basename(bin).includes('zsh');
  const args = isZsh
    ? ['-fc', 'print -r -- $ZSH_VERSION']
    : ['--noprofile', '--norc', '-c', 'echo "$BASH_VERSION"'];
  const run = spawnSync(bin, args, {
    encoding: 'utf8',
    timeout: PROBE_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, BASH_ENV: '' },
  });
  if (run.status !== 0 || typeof run.stdout !== 'string') return null;
  const match = /^(\d+)\.(\d+)/.exec(run.stdout.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function atLeast(version: [number, number], min: [number, number]): boolean {
  return version[0] > min[0] || (version[0] === min[0] && version[1] >= min[1]);
}

/**
 * The first bash or zsh binary at or above `min`: the QQ_TEST_BASH / QQ_TEST_ZSH override
 * (authoritative when set), else each PATH entry, else the Homebrew, MacPorts and system dirs.
 */
export function findShell(name: ShellKind, opts: { min: [number, number] }): string | null {
  const override = process.env[OVERRIDE_ENV[name]];
  if (override) {
    if (!isAbsolute(override) || !isExecutableFile(override)) return null;
    const version = shellVersionOf(override);
    return version && atLeast(version, opts.min) ? override : null;
  }
  const seen = new Set<string>();
  for (const dir of [...pathDirs(), ...FALLBACK_DIRS]) {
    const candidate = join(dir, name);
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!isExecutableFile(candidate)) continue;
    const version = shellVersionOf(candidate);
    if (version && atLeast(version, opts.min)) return candidate;
  }
  return null;
}

/** The absolute path of `name` on PATH, or null. */
export function findBinary(name: string): string | null {
  for (const dir of pathDirs()) {
    const candidate = join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

const warned = new Set<string>();

/**
 * Passes a found prerequisite through. A missing one (null) throws when CI is set and warns
 * once locally, so the caller can skip.
 */
export function ciRequired<T>(value: T | null, label: string): T | null {
  if (value !== null) return value;
  if (process.env.CI) {
    throw new Error(`${label} is required when CI is set`);
  }
  if (!warned.has(label)) {
    warned.add(label);
    console.warn(`warning: ${label} not found; skipping the tests that need it`);
  }
  return null;
}
