import { lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { type InstallInfo, NPM_PACKAGE } from './install-detect.js';
import { flagSet } from './telemetry-config.js';

/**
 * The update notifier (quick 261117-jpp).
 *
 * The daemon asks the npm registry for the latest qq at most once per 24 h, in the background,
 * and only after a client that passed the env + TTY gate asked for a hint. `??` never waits on
 * the network. The result and the last time a hint was shown live in one private cache file,
 * so all terminals share the once-a-day display and a daemon restart does not reset it.
 *
 * No top-level side effects.
 */

export const UPDATE_REGISTRY_URL = `https://registry.npmjs.org/${NPM_PACKAGE}/latest`;
/** How often the registry is asked. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** How often a hint is shown, across all terminals. */
export const UPDATE_HINT_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_FETCH_TIMEOUT_MS = 1500;
/** How long the client waits for the daemon's `update-hint` reply. */
export const UPDATE_HINT_REQUEST_TIMEOUT_MS = 500;
/** Longest hint line; the IPC schema in contracts/ipc.ts repeats this literal. */
export const UPDATE_HINT_MAX = 200;
export const RELEASES_URL = 'https://github.com/k-leumas/queque/releases';
export const UPDATE_CACHE_FILE_NAME = 'update-check.json';

export type UpdateBlockReason = 'QQ_NO_UPDATE_CHECK' | 'CI' | 'not a terminal';

const VERSION_MAX = 64;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const PRINTABLE_RE = /^[\x20-\x7e]+$/;
/** Group or world write permission bits (the launcher's isPrivateDirectory check). */
const SHARED_WRITE_BITS = 0o022;

/**
 * The gate that turns the update check off, or null. QQ_NO_UPDATE_CHECK wins over CI, which
 * wins over a stdout that is not a terminal. Both variables use telemetry's flag semantics:
 * set means anything but empty, `0` or `false`.
 */
export function updateCheckBlockedBy(
  env: NodeJS.ProcessEnv,
  isTTY: boolean,
): UpdateBlockReason | null {
  if (flagSet(env.QQ_NO_UPDATE_CHECK)) {
    return 'QQ_NO_UPDATE_CHECK';
  }
  if (flagSet(env.CI)) {
    return 'CI';
  }
  if (!isTTY) {
    return 'not a terminal';
  }
  return null;
}

interface ParsedVersion {
  core: [number, number, number];
  pre: string[];
}

function parseVersion(value: string): ParsedVersion | null {
  if (value.length > VERSION_MAX) {
    return null;
  }
  const match = SEMVER_RE.exec(value);
  if (match === null) {
    return null;
  }
  const pre = match[4] === undefined ? [] : match[4].split('.');
  if (pre.some((id) => id === '')) {
    return null;
  }
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre };
}

function sign(value: number): -1 | 0 | 1 {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

function compareIdentifiers(a: string, b: string): -1 | 0 | 1 {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) {
    return sign(Number(a) - Number(b));
  }
  if (aNumeric !== bNumeric) {
    // Numeric identifiers rank below alphanumeric ones.
    return aNumeric ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Semver precedence of `a` against `b`, or null when either is not plain semver. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (left === null || right === null) {
    return null;
  }
  for (let i = 0; i < 3; i++) {
    const order = sign(left.core[i] - right.core[i]);
    if (order !== 0) {
      return order;
    }
  }
  // A release ranks above its prereleases.
  if (left.pre.length === 0 || right.pre.length === 0) {
    return sign(right.pre.length - left.pre.length);
  }
  const shared = Math.min(left.pre.length, right.pre.length);
  for (let i = 0; i < shared; i++) {
    const order = compareIdentifiers(left.pre[i] as string, right.pre[i] as string);
    if (order !== 0) {
      return order;
    }
  }
  return sign(left.pre.length - right.pre.length);
}

/** True only when both are semver and `latest` ranks above `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) === 1;
}

const FLOOR_OPERATOR_RE = /^(?:>=|\^|~)\s*(\d+(?:\.\d+){0,2})$/;
const FLOOR_BARE_RE = /^(\d+)(?:\.x){0,2}$/;

function floorParts(floor: string): [number, number, number] {
  const parts = floor.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareParts(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return (a[i] as number) - (b[i] as number);
    }
  }
  return 0;
}

/**
 * The lowest Node version an `engines.node` range allows, as written (`>=22.12.0` →
 * `22.12.0`), or null. Any alternative it cannot read makes the whole range null: no engines
 * check is better than a wrong block.
 */
export function nodeFloor(range: string): string | null {
  const floors: string[] = [];
  for (const raw of range.split('||')) {
    const alternative = raw.trim();
    const withOperator = FLOOR_OPERATOR_RE.exec(alternative);
    const bare = withOperator === null ? FLOOR_BARE_RE.exec(alternative) : null;
    const floor = withOperator?.[1] ?? bare?.[1];
    if (floor === undefined) {
      return null;
    }
    floors.push(floor);
  }
  floors.sort((a, b) => compareParts(floorParts(a), floorParts(b)));
  return floors[0] ?? null;
}

/** True when `nodeVersion` (e.g. process.versions.node) is below `floor`. */
export function nodeBelowFloor(floor: string, nodeVersion: string): boolean {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(nodeVersion);
  if (match === null) {
    return false;
  }
  const have: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return compareParts(have, floorParts(floor)) < 0;
}

const registryVersionSchema = z.object({
  version: z.string().max(VERSION_MAX).regex(SEMVER_RE),
});
const enginesNodeSchema = z.string().max(VERSION_MAX).regex(PRINTABLE_RE);

/**
 * The registry's latest version and its `engines.node`, or null on any failure (offline, a
 * timeout, a non-200 reply, a malformed body). An invalid engines value becomes null and
 * never rejects the version. The body is never logged.
 */
export async function fetchLatestRelease(
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ latest: string; enginesNode: string | null } | null> {
  try {
    const res = await fetchImpl(UPDATE_REGISTRY_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return null;
    }
    const body: unknown = await res.json();
    const parsed = registryVersionSchema.safeParse(body);
    if (!parsed.success || parseVersion(parsed.data.version) === null) {
      return null;
    }
    const engines = (body as { engines?: unknown }).engines;
    const node =
      engines !== null && typeof engines === 'object'
        ? (engines as { node?: unknown }).node
        : undefined;
    const enginesNode = enginesNodeSchema.safeParse(node);
    return {
      latest: parsed.data.version,
      enginesNode: enginesNode.success ? enginesNode.data : null,
    };
  } catch {
    return null;
  }
}

export const updateCacheSchema = z.strictObject({
  version: z.literal(1),
  checkedAt: z.number(),
  latest: z.string().max(VERSION_MAX).regex(SEMVER_RE).nullable(),
  enginesNode: z.string().max(VERSION_MAX).regex(PRINTABLE_RE).nullable(),
  shownAt: z.number().nullable(),
});

export type UpdateCache = z.infer<typeof updateCacheSchema>;

/**
 * The qq cache dir: `${XDG_CACHE_HOME (absolute only) or ~/.cache}/queque`, the same base the
 * launcher's compile cache uses. The same on every platform, darwin included (user decision
 * 2026-11-17), so `platform` does not change the result.
 */
export function updateCacheDir(options: {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  homeDir: string;
}): string {
  const xdgCacheHome = options.env.XDG_CACHE_HOME;
  const cacheRoot =
    xdgCacheHome !== undefined && isAbsolute(xdgCacheHome)
      ? xdgCacheHome
      : join(options.homeDir, '.cache');
  return join(cacheRoot, 'queque');
}

/**
 * Reports whether `dir` is a real directory owned by this user that nobody else can write to
 * (the launcher's isPrivateDirectory), creating it (0700) first when `create` is set. Reads
 * never create it. Throws on fs errors (a missing dir included).
 */
function isPrivateCacheDir(dir: string, create: boolean): boolean {
  if (typeof process.getuid !== 'function') {
    return false;
  }
  if (create) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const stats = lstatSync(dir);
  return (
    stats.isDirectory() &&
    !stats.isSymbolicLink() &&
    stats.uid === process.getuid() &&
    (stats.mode & SHARED_WRITE_BITS) === 0
  );
}

/** The cache, or null when it is missing, unreadable, invalid or in an unsafe dir. */
export function readUpdateCache(file: string): UpdateCache | null {
  try {
    if (!isPrivateCacheDir(dirname(file), false)) {
      return null;
    }
    const parsed = updateCacheSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Writes the cache atomically (0600 tmp file, then rename); false on any failure. */
export function writeUpdateCache(file: string, cache: UpdateCache): boolean {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    if (!isPrivateCacheDir(dirname(file), true)) {
      return false;
    }
    try {
      unlinkSync(tmp);
    } catch {
      // No leftover tmp file.
    }
    writeFileSync(tmp, `${JSON.stringify(cache)}\n`, { mode: 0o600, flag: 'wx' });
    renameSync(tmp, file);
    return true;
  } catch {
    try {
      unlinkSync(tmp);
    } catch {
      // Nothing to clean up.
    }
    return false;
  }
}

export type UpdateStatus =
  | { state: 'blocked'; reason: UpdateBlockReason }
  | { state: 'unknown' }
  | { state: 'current'; current: string }
  | {
      state: 'available';
      current: string;
      latest: string;
      nodeTooOld: { floor: string; have: string } | null;
      install: InstallInfo;
    };

function truncateHint(line: string): string {
  return line.length > UPDATE_HINT_MAX ? `${line.slice(0, UPDATE_HINT_MAX - 1)}…` : line;
}

/**
 * The one-line hint for a status, or null when there is nothing to say. Built from fixed copy
 * plus validated values only, and at most UPDATE_HINT_MAX chars.
 */
export function formatUpdateHint(status: UpdateStatus): string | null {
  if (status.state !== 'available') {
    return null;
  }
  // No version number: the picker row is 80 columns at worst, and the command is what matters.
  const { install, nodeTooOld } = status;
  // Nix upgrades go through the user's nix config: no hint at all.
  if (install.method === 'nix') {
    return null;
  }
  // Any command would upgrade the Windows install, not the one WSL runs (discretion 12).
  if (install.method === 'windows-node') {
    return truncateHint(
      'qq update available · this qq uses a Windows Node; install Node inside WSL',
    );
  }
  if (nodeTooOld !== null) {
    return truncateHint(`qq update needs Node ${nodeTooOld.floor}+; you have ${nodeTooOld.have}`);
  }
  if (install.packaged) {
    // A distro package may lag upstream. Without a sure command, say how instead.
    const how = install.upgradeCommand ?? install.note ?? 'update it with your package manager';
    return truncateHint(`qq update (your package may lag) · ${how}`);
  }
  if (install.upgradeCommand !== null) {
    const note = install.note === undefined ? '' : ` (${install.note})`;
    return truncateHint(`qq update available · ${install.upgradeCommand}${note}`);
  }
  return truncateHint(`qq update available · ${RELEASES_URL}`);
}

export interface UpdateCheckerDeps {
  env: NodeJS.ProcessEnv;
  cacheFile: string;
  fetchImpl: typeof fetch;
  now: () => number;
  currentVersion: string;
  nodeVersion: string;
  detectInstall: () => Promise<InstallInfo>;
  fetchTimeoutMs?: number;
}

export interface UpdateChecker {
  /** The hint to show now, or null; marks it shown. Starts a background refresh when stale. */
  hint(): Promise<string | null>;
  /** The current status for `qq doctor`; never touches shownAt. */
  status(options: { isTTY: boolean; refresh: boolean }): Promise<UpdateStatus>;
}

const UNKNOWN_INSTALL: InstallInfo = { method: 'unknown', upgradeCommand: null, packaged: false };

/** True when `since` is unset, at least `interval` ago, or in the future (a clock change). */
function elapsed(now: number, since: number | null, interval: number): boolean {
  return since === null || now - since >= interval || now < since;
}

/**
 * The daemon's update checker. The cache file is the source of truth and is re-read on every
 * call. detectInstall runs once per checker, and refreshes are deduped.
 */
export function createUpdateChecker(deps: UpdateCheckerDeps): UpdateChecker {
  let install: Promise<InstallInfo> | undefined;
  let inFlight: Promise<void> | undefined;

  const installInfo = (): Promise<InstallInfo> => {
    install ??= Promise.resolve()
      .then(() => deps.detectInstall())
      .catch(() => UNKNOWN_INSTALL);
    return install;
  };

  const stale = (cache: UpdateCache | null): boolean =>
    cache === null || elapsed(deps.now(), cache.checkedAt, UPDATE_CHECK_INTERVAL_MS);

  const refresh = (): Promise<void> => {
    inFlight ??= (async () => {
      try {
        const result = await fetchLatestRelease(
          deps.fetchImpl,
          deps.fetchTimeoutMs ?? UPDATE_FETCH_TIMEOUT_MS,
        );
        // Re-read just before writing, so a shownAt written meanwhile survives. A failed
        // fetch keeps the previous latest and still sets checkedAt: retry in the next window.
        const prev = readUpdateCache(deps.cacheFile);
        writeUpdateCache(deps.cacheFile, {
          version: 1,
          checkedAt: deps.now(),
          latest: result?.latest ?? prev?.latest ?? null,
          enginesNode: result ? result.enginesNode : (prev?.enginesNode ?? null),
          shownAt: prev?.shownAt ?? null,
        });
      } catch {
        // Never an unhandled rejection in the daemon.
      } finally {
        inFlight = undefined;
      }
    })();
    return inFlight;
  };

  const computeStatus = (cache: UpdateCache | null, info: InstallInfo): UpdateStatus => {
    if (cache === null || cache.latest === null) {
      return { state: 'unknown' };
    }
    if (!isNewerVersion(cache.latest, deps.currentVersion)) {
      return { state: 'current', current: deps.currentVersion };
    }
    const floor = cache.enginesNode === null ? null : nodeFloor(cache.enginesNode);
    const nodeTooOld =
      floor !== null && nodeBelowFloor(floor, deps.nodeVersion)
        ? { floor, have: deps.nodeVersion }
        : null;
    return {
      state: 'available',
      current: deps.currentVersion,
      latest: cache.latest,
      nodeTooOld,
      install: info,
    };
  };

  return {
    async hint() {
      try {
        // The client already passed the TTY half of the gate; the env half is re-checked here.
        if (updateCheckBlockedBy(deps.env, true) !== null) {
          return null;
        }
        const initial = readUpdateCache(deps.cacheFile);
        if (stale(initial)) {
          void refresh();
        }
        if (initial === null) {
          // Nothing known yet: the first `??` only starts the check (discretion 2). Warm the
          // install detection so a later hint does not wait on it.
          void installInfo();
          return null;
        }
        const info = await installInfo();
        // From here on synchronous: two hint() calls cannot interleave read, decide and write.
        const cache = readUpdateCache(deps.cacheFile);
        const line = formatUpdateHint(computeStatus(cache, info));
        if (line === null || cache === null) {
          return null;
        }
        const now = deps.now();
        if (!elapsed(now, cache.shownAt, UPDATE_HINT_INTERVAL_MS)) {
          return null;
        }
        // A hint that cannot be marked shown would show on every `??`: stay quiet instead.
        return writeUpdateCache(deps.cacheFile, { ...cache, shownAt: now }) ? line : null;
      } catch {
        return null;
      }
    },

    async status({ isTTY, refresh: allowRefresh }) {
      const reason = updateCheckBlockedBy(deps.env, isTTY);
      if (reason !== null) {
        return { state: 'blocked', reason };
      }
      if (allowRefresh && stale(readUpdateCache(deps.cacheFile))) {
        await refresh();
      }
      const info = await installInfo();
      return computeStatus(readUpdateCache(deps.cacheFile), info);
    },
  };
}
