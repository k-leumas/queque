import { lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { type InstallInfo, NPM_PACKAGE } from './install-detect.js';
import { flagSet } from './telemetry-config.js';

/**
 * The update notifier (quick 261117-jpp).
 *
 * The daemon asks the npm registry for the latest qq at most once per 24 h, in the background,
 * and only after a client that passed the env + TTY gate sent `update-hint`. It then writes the
 * finished picker line into the cache. Every later `??` reads that line synchronously at
 * launch (readUpdateHint) and paints it in its first frame, so the picker never grows while it
 * is open and `??` never waits on the daemon or the network. The line stays on every `??` until
 * this qq is at (or past) the cached latest version, i.e. until the user upgrades.
 *
 * No top-level side effects.
 */

export const UPDATE_REGISTRY_URL = `https://registry.npmjs.org/${NPM_PACKAGE}/latest`;
/** How often the registry is asked. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_FETCH_TIMEOUT_MS = 1500;
/** How long the client keeps the fire-and-forget `update-hint` request open. */
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

/** No C0/C1 controls or DEL: the hint is written straight to the terminal. */
function hasNoControls(value: string): boolean {
  return [...value].every((ch) => {
    const code = ch.charCodeAt(0);
    return code > 0x1f && (code < 0x7f || code > 0x9f);
  });
}

export const updateCacheSchema = z.strictObject({
  version: z.literal(2),
  checkedAt: z.number(),
  latest: z.string().max(VERSION_MAX).regex(SEMVER_RE).nullable(),
  enginesNode: z.string().max(VERSION_MAX).regex(PRINTABLE_RE).nullable(),
  /** The picker line the daemon prepared for the next `??`, or null for none. */
  hint: z.string().min(1).max(UPDATE_HINT_MAX).refine(hasNoControls).nullable(),
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
 * The picker's update line, or null. It does one thing: say a new qq exists and how to install
 * it. Anything that is a problem with this environment (a Windows Node under WSL, a Node too
 * old for the new release) or a qualifier (package lag, npm prefix, nvm scope) is NOT shown
 * here: `qq doctor` reports it on the command line. Built from fixed copy plus validated values
 * only, and at most UPDATE_HINT_MAX chars.
 */
export function formatUpdateHint(status: UpdateStatus): string | null {
  if (status.state !== 'available') {
    return null;
  }
  const { install, nodeTooOld } = status;
  // No actionable install step in the picker for these; `qq doctor` explains each one.
  if (install.method === 'nix' || install.method === 'windows-node' || nodeTooOld !== null) {
    return null;
  }
  // No version number: the picker row is 80 columns at worst, and the command is what matters.
  const how =
    install.upgradeCommand ??
    (install.packaged ? (install.note ?? 'update it with your package manager') : RELEASES_URL);
  return truncateHint(`qq update available · ${how}`);
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
  /**
   * Refreshes a stale cache and stores the picker line for later `??` runs. Never shows
   * anything. Never rejects.
   */
  prepare(): Promise<void>;
  /** The current status for `qq doctor`. */
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
        // A failed fetch keeps the previous latest and still sets checkedAt: retry in the next
        // window.
        const prev = readUpdateCache(deps.cacheFile);
        writeUpdateCache(deps.cacheFile, {
          version: 2,
          checkedAt: deps.now(),
          latest: result?.latest ?? prev?.latest ?? null,
          enginesNode: result ? result.enginesNode : (prev?.enginesNode ?? null),
          hint: prev?.hint ?? null,
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
    async prepare() {
      try {
        // The client already passed the TTY half of the gate; the env half is re-checked here.
        if (updateCheckBlockedBy(deps.env, true) !== null) {
          return;
        }
        if (stale(readUpdateCache(deps.cacheFile))) {
          await refresh();
        }
        const info = await installInfo();
        // Re-read after the refresh, then decide and write synchronously.
        const cache = readUpdateCache(deps.cacheFile);
        if (cache === null) {
          return;
        }
        const hint = formatUpdateHint(computeStatus(cache, info));
        if (hint !== cache.hint) {
          writeUpdateCache(deps.cacheFile, { ...cache, hint });
        }
      } catch {
        // Never an unhandled rejection in the daemon.
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

export interface ReadUpdateHintDeps {
  env: NodeJS.ProcessEnv;
  isTTY: boolean;
  cacheFile: string;
  currentVersion: string;
}

/**
 * The client side, run synchronously before the first frame: the line the daemon prepared
 * during an earlier `??`, or null. Shown on every `??` until this qq is at (or past) the cached
 * latest, so it disappears on its own right after an upgrade even before the daemon refreshes.
 * Read-only: one small local file, no network, no daemon. Never throws.
 */
export function readUpdateHint(deps: ReadUpdateHintDeps): string | null {
  try {
    if (updateCheckBlockedBy(deps.env, deps.isTTY) !== null) {
      return null;
    }
    const cache = readUpdateCache(deps.cacheFile);
    if (cache === null || cache.hint === null || cache.latest === null) {
      return null;
    }
    return isNewerVersion(cache.latest, deps.currentVersion) ? cache.hint : null;
  } catch {
    return null;
  }
}
