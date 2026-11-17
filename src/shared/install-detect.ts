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

const NPM_UPGRADE = `npm i -g ${NPM_PACKAGE}@latest`;
const NODE_VERSION_ONLY_NOTE = 'this Node version only';
const USER_PREFIX_NOTE = 'set a user npm prefix first, not sudo';
const AUR_NOTE = 'update via your AUR helper';
/** The segment every npm-style global install of qq has. */
const NPM_GLOBAL_SEGMENT = `/lib/node_modules/${NPM_PACKAGE}/`;

/** True when `real` is inside `dir`. */
function isUnder(real: string, dir: string | undefined): boolean {
  if (dir === undefined || dir === '') {
    return false;
  }
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  return real.startsWith(`${base}/`);
}

/**
 * An npm-command result. When the global node_modules dir that holds qq is not writable, the
 * note asks for a user prefix: never `sudo npm` (discretion 8).
 */
function npmInstall(
  deps: InstallDetectDeps,
  real: string,
  method: 'nvm' | 'fnm' | 'npm',
  note?: string,
): InstallInfo {
  const notes = note === undefined ? [] : [note];
  const scope = real.lastIndexOf('/node_modules/@k-leumas/');
  if (scope !== -1 && !deps.isWritable(real.slice(0, scope + '/node_modules'.length))) {
    notes.push(USER_PREFIX_NOTE);
  }
  return {
    method,
    upgradeCommand: NPM_UPGRADE,
    ...(notes.length > 0 ? { note: notes.join('; ') } : {}),
    packaged: false,
  };
}

/** The ID and ID_LIKE tokens of /etc/os-release, unquoted and lower-cased. */
function osReleaseTokens(text: string | null): string[] {
  if (text === null) {
    return [];
  }
  const tokens: string[] = [];
  for (const line of text.split('\n')) {
    const match = /^(?:ID|ID_LIKE)=(.*)$/.exec(line.trim());
    if (match?.[1] !== undefined) {
      const value = match[1].replace(/^["']|["']$/g, '').toLowerCase();
      tokens.push(...value.split(/\s+/).filter((token) => token !== ''));
    }
  }
  return tokens;
}

/** A package-owner hit: packaged, and a command only when the owner is exactly `queque`. */
function ownedBy(
  owner: string,
  method: InstallMethod,
  command: string | null,
  note?: string,
): InstallInfo {
  return {
    method,
    upgradeCommand: owner === 'queque' ? command : null,
    ...(note === undefined ? {} : { note }),
    packaged: true,
  };
}

/**
 * Asks dpkg, rpm and pacman in that order who owns `real`; the first hit wins. Argv only, and
 * the path is one argv element. Null when no package owns it.
 */
async function queryPackageOwner(
  deps: InstallDetectDeps,
  real: string,
): Promise<InstallInfo | null> {
  const dpkg = await deps.runOwnerQuery('dpkg', ['-S', real]);
  if (dpkg.ok) {
    const owner = dpkg.stdout.split(':')[0]?.trim() ?? '';
    return ownedBy(owner, 'apt', 'sudo apt install --only-upgrade queque');
  }

  // rpm expands the two characters `\n` in --qf itself.
  const rpm = await deps.runOwnerQuery('rpm', ['-qf', '--qf', '%{NAME}\\n', real]);
  if (rpm.ok) {
    const owner = rpm.stdout.trim();
    const tokens = osReleaseTokens(deps.readOsRelease());
    if (tokens.some((token) => token.includes('suse'))) {
      return ownedBy(owner, 'zypper', 'sudo zypper up queque');
    }
    if (tokens.some((token) => token === 'fedora' || token === 'rhel' || token === 'centos')) {
      return ownedBy(owner, 'dnf', 'sudo dnf upgrade queque');
    }
    return ownedBy(owner, 'rpm', null);
  }

  const pacman = await deps.runOwnerQuery('pacman', ['-Qoq', real]);
  if (pacman.ok) {
    const owner = pacman.stdout.split('\n')[0]?.trim() ?? '';
    // -Qm lists foreign packages: installed from the AUR, not from a sync repo.
    const foreign = await deps.runOwnerQuery('pacman', ['-Qm', 'queque']);
    if (foreign.ok) {
      return ownedBy(owner, 'aur', null, AUR_NOTE);
    }
    return ownedBy(owner, 'pacman', 'sudo pacman -Syu');
  }

  return null;
}

/**
 * How this qq was installed. Rules in order: a Windows Node under WSL, the `.install-source`
 * marker, then the install path (brew, volta, pnpm, nix, nvm, fnm, npm global), then on Linux
 * only, for unmatched /usr paths, the dpkg/rpm/pacman owner queries, then the npm fallback,
 * then unknown. Never rejects.
 */
export async function detectInstall(
  deps: InstallDetectDeps = defaultInstallDetectDeps(),
): Promise<InstallInfo> {
  const real = deps.realpath(deps.modulePath);

  // A Windows Node running qq inside WSL: any command would upgrade the wrong install
  // (discretion 12).
  if (deps.platform === 'linux' && /^\/mnt\/[a-z]\//.test(deps.execPath)) {
    return { method: 'windows-node', upgradeCommand: null, packaged: false };
  }

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

  const env = deps.env;
  if (isUnder(real, env.VOLTA_HOME || `${deps.homeDir}/.volta`)) {
    return { method: 'volta', upgradeCommand: `volta install ${NPM_PACKAGE}`, packaged: false };
  }

  if (isUnder(real, env.PNPM_HOME) || real.includes('/pnpm/global/')) {
    return { method: 'pnpm', upgradeCommand: `pnpm add -g ${NPM_PACKAGE}`, packaged: false };
  }

  // Nix: the store is read-only and upgrades go through the nix config, so no hint at all.
  if (real.startsWith('/nix/store/')) {
    return { method: 'nix', upgradeCommand: null, packaged: false };
  }

  if (
    isUnder(real, env.NVM_DIR || `${deps.homeDir}/.nvm`) ||
    real.includes('/.nvm/versions/node/')
  ) {
    return npmInstall(deps, real, 'nvm', NODE_VERSION_ONLY_NOTE);
  }

  if (isUnder(real, env.FNM_DIR) || real.includes('/fnm/node-versions/')) {
    return npmInstall(deps, real, 'fnm', NODE_VERSION_ONLY_NOTE);
  }

  if (real.includes(NPM_GLOBAL_SEGMENT) && !real.startsWith('/usr/')) {
    return npmInstall(deps, real, 'npm');
  }

  if (real.startsWith('/usr/')) {
    // Owner queries run only on Linux (discretion 7); on macOS a /usr/local npm prefix goes
    // straight to the npm fallback.
    if (deps.platform === 'linux') {
      const owned = await queryPackageOwner(deps, real);
      if (owned !== null) {
        return owned;
      }
    }
    // The npm fallback, only for a path npm itself lays out: anything else stays unknown.
    if (real.includes(NPM_GLOBAL_SEGMENT)) {
      return npmInstall(deps, real, 'npm');
    }
  }

  return { method: 'unknown', upgradeCommand: null, packaged: false };
}
