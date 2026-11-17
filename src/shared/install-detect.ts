import { spawn } from 'node:child_process';
import { accessSync, constants as fsConstants, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * Who installed this qq, and so which command upgrades it (quick 261117-jpp).
 *
 * This answers "who installed qq", never "which package manager exists": a Mac with brew can
 * still run an npm-installed qq. tool-awareness's pickInstaller is not used here. A wrong
 * upgrade command is worse than none, so every rule that cannot be sure returns no command.
 *
 * No top-level side effects: the daemon runs detectInstall() once, on the first update hint.
 */

/** The npm package name. */
export const NPM_PACKAGE = '@k-leumas/queque-cli';

/**
 * How this qq was installed. apt/dnf/pacman reuse tool-awareness's InstallerId strings.
 * `marker` means a `.install-source` file next to dist/ named the source and command.
 */
export type InstallMethod =
  | 'marker'
  | 'brew'
  | 'volta'
  | 'pnpm'
  | 'nvm'
  | 'fnm'
  | 'npm'
  | 'nix'
  | 'apt'
  | 'dnf'
  | 'zypper'
  | 'rpm'
  | 'pacman'
  | 'aur'
  | 'windows-node'
  | 'unknown';

export interface InstallInfo {
  method: InstallMethod;
  /** The exact upgrade command, or null when it cannot be known. */
  upgradeCommand: string | null;
  /** A short qualifier shown after the command, e.g. `this Node version only`. */
  note?: string;
  /** A distro package: upstream releases may not be packaged yet. */
  packaged: boolean;
  /** The marker's `source`, for `method: 'marker'`. */
  source?: string;
}

/** Everything detectInstall reads, injectable so tests fake paths, files and owner queries. */
export interface InstallDetectDeps {
  /** This module's file; in the bundle that is dist/cli/app.js. */
  modulePath: string;
  execPath: string;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  platform: NodeJS.Platform;
  realpath(p: string): string;
  readFile(p: string): string | null;
  isWritable(dir: string): boolean;
  /** Runs a package-owner query (dpkg/rpm/pacman) with argv only; never rejects. */
  runOwnerQuery(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }>;
  readOsRelease(): string | null;
}

/**
 * The `.install-source` marker a packager writes next to dist/ (the Homebrew formula does).
 * Strict, and its text is printed as a command, so only printable ASCII is accepted.
 */
export const installMarkerSchema = z.strictObject({
  source: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,31}$/),
  upgrade: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[\x20-\x7e]+$/),
});

const MARKER_FILE_NAME = '.install-source';
const OWNER_QUERY_TIMEOUT_MS = 2000;
const OWNER_QUERY_STDOUT_MAX = 4096;

/** Runs one owner query: no shell, stdin ignored, LC_ALL=C, killed after 2 s, 4 KB stdout. */
function runOwnerQuery(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    const done = (result: { ok: boolean; stdout: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child: ReturnType<typeof spawn>;
    try {
      // spawn, not execFile: execFile ignores `stdio` (cerebrum 2026-08-26).
      child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, LC_ALL: 'C' },
      });
    } catch {
      resolve({ ok: false, stdout: '' });
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done({ ok: false, stdout: '' });
    }, OWNER_QUERY_TIMEOUT_MS);
    timer.unref?.();
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (stdout.length < OWNER_QUERY_STDOUT_MAX) {
        stdout = (stdout + chunk).slice(0, OWNER_QUERY_STDOUT_MAX);
      }
    });
    child.on('error', () => {
      done({ ok: false, stdout: '' });
    });
    child.on('close', (code) => {
      done({ ok: code === 0, stdout });
    });
  });
}

/** The real machine's deps. */
export function defaultInstallDetectDeps(): InstallDetectDeps {
  return {
    modulePath: fileURLToPath(import.meta.url),
    execPath: process.execPath,
    env: process.env,
    homeDir: homedir(),
    platform: process.platform,
    realpath: (p) => {
      try {
        return realpathSync(p);
      } catch {
        return p;
      }
    },
    readFile: (p) => {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        return null;
      }
    },
    isWritable: (dir) => {
      try {
        accessSync(dir, fsConstants.W_OK);
        return true;
      } catch {
        return false;
      }
    },
    runOwnerQuery,
    readOsRelease: () => {
      try {
        return readFileSync('/etc/os-release', 'utf8');
      } catch {
        return null;
      }
    },
  };
}

/** The package root: the part of `real` before its last `/dist/` segment, or null. */
function packageRoot(real: string): string | null {
  const index = real.lastIndexOf('/dist/');
  return index > 0 ? real.slice(0, index) : null;
}

/** The validated marker next to dist/, or null when it is missing or invalid. */
function readMarker(
  deps: InstallDetectDeps,
  real: string,
): z.infer<typeof installMarkerSchema> | null {
  const root = packageRoot(real);
  if (root === null) {
    return null;
  }
  const text = deps.readFile(`${root}/${MARKER_FILE_NAME}`);
  if (text === null) {
    return null;
  }
  try {
    const parsed = installMarkerSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * How this qq was installed. Rules in order: the `.install-source` marker, then the
 * install path. Never rejects.
 */
export async function detectInstall(
  deps: InstallDetectDeps = defaultInstallDetectDeps(),
): Promise<InstallInfo> {
  const real = deps.realpath(deps.modulePath);

  // Rule 1: a packager's marker wins. Homebrew's first-party tap updates in the same release
  // run, so it is not a lagging distro package (discretion 5).
  const marker = readMarker(deps, real);
  if (marker !== null) {
    return {
      method: 'marker',
      source: marker.source,
      upgradeCommand: marker.upgrade,
      packaged: marker.source !== 'homebrew',
    };
  }

  // Homebrew, macOS and Linuxbrew.
  if (real.includes('/Cellar/queque/')) {
    return { method: 'brew', upgradeCommand: 'brew upgrade queque', packaged: false };
  }

  return { method: 'unknown', upgradeCommand: null, packaged: false };
}
