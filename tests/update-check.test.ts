import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectInstall,
  type InstallDetectDeps,
  type InstallInfo,
} from '../src/shared/install-detect.js';
import {
  compareVersions,
  createUpdateChecker,
  fetchLatestRelease,
  formatUpdateHint,
  isNewerVersion,
  nodeBelowFloor,
  nodeFloor,
  RELEASES_URL,
  readUpdateCache,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_HINT_INTERVAL_MS,
  UPDATE_REGISTRY_URL,
  type UpdateCache,
  type UpdateStatus,
  updateCacheDir,
  updateCheckBlockedBy,
  writeUpdateCache,
} from '../src/shared/update-check.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-11-17T12:00:00.000Z');
const BREW: InstallInfo = {
  method: 'brew',
  upgradeCommand: 'brew upgrade queque',
  packaged: false,
};
const UNKNOWN: InstallInfo = { method: 'unknown', upgradeCommand: null, packaged: false };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function available(install: InstallInfo, latest = '0.11.0'): UpdateStatus {
  return { state: 'available', current: '0.10.5', latest, nodeTooOld: null, install };
}

describe('updateCheckBlockedBy', () => {
  it('blocks on QQ_NO_UPDATE_CHECK=1', () => {
    expect(updateCheckBlockedBy({ QQ_NO_UPDATE_CHECK: '1' }, true)).toBe('QQ_NO_UPDATE_CHECK');
  });

  it.each(['', '0', 'false'])('does not block on QQ_NO_UPDATE_CHECK=%j', (value) => {
    expect(updateCheckBlockedBy({ QQ_NO_UPDATE_CHECK: value }, true)).toBeNull();
  });

  it('blocks on CI=true and not on CI=0', () => {
    expect(updateCheckBlockedBy({ CI: 'true' }, true)).toBe('CI');
    expect(updateCheckBlockedBy({ CI: '0' }, true)).toBeNull();
  });

  it('blocks when stdout is not a terminal', () => {
    expect(updateCheckBlockedBy({}, false)).toBe('not a terminal');
    expect(updateCheckBlockedBy({}, true)).toBeNull();
  });

  it('checks QQ_NO_UPDATE_CHECK, then CI, then the terminal', () => {
    expect(updateCheckBlockedBy({ QQ_NO_UPDATE_CHECK: '1', CI: '1' }, false)).toBe(
      'QQ_NO_UPDATE_CHECK',
    );
    expect(updateCheckBlockedBy({ CI: '1' }, false)).toBe('CI');
  });
});

describe('compareVersions / isNewerVersion', () => {
  it('compares numerically, not lexically', () => {
    expect(isNewerVersion('0.11.0', '0.10.5')).toBe(true);
    expect(isNewerVersion('0.10.10', '0.10.9')).toBe(true);
    expect(isNewerVersion('0.10.9', '0.10.10')).toBe(false);
  });

  it('ranks a release above its prereleases and orders prerelease numbers', () => {
    expect(isNewerVersion('1.0.0', '1.0.0-beta.2')).toBe(true);
    expect(isNewerVersion('1.0.0-beta.10', '1.0.0-beta.9')).toBe(true);
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
  });

  it('treats equal versions and non-semver input as not newer', () => {
    expect(isNewerVersion('0.10.5', '0.10.5')).toBe(false);
    expect(compareVersions('0.10.5', '0.10.5')).toBe(0);
    expect(isNewerVersion('banana', '0.10.5')).toBe(false);
    expect(isNewerVersion('0.11.0', 'v0.10.5')).toBe(false);
    expect(compareVersions('1.0', '1.0.0')).toBeNull();
  });
});

describe('nodeFloor / nodeBelowFloor', () => {
  it.each([
    ['>=24', '24'],
    ['>= 22.12.0', '22.12.0'],
    ['^20.19 || >=22.12', '20.19'],
    ['24.x', '24'],
  ])('nodeFloor(%j) is %j', (range, floor) => {
    expect(nodeFloor(range)).toBe(floor);
  });

  it.each(['*', 'banana', '>=24 <27', ''])('nodeFloor(%j) is null', (range) => {
    expect(nodeFloor(range)).toBeNull();
  });

  it('compares the running Node with the floor', () => {
    expect(nodeBelowFloor('26', '24.14.1')).toBe(true);
    expect(nodeBelowFloor('24', '24.0.0')).toBe(false);
    expect(nodeBelowFloor('22.12', '22.5.0')).toBe(true);
    expect(nodeBelowFloor('22.12', '23.0.0')).toBe(false);
  });
});

describe('fetchLatestRelease', () => {
  it('reads version and engines.node from the registry', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ version: '0.11.0', engines: { node: '>=24' } }),
    );
    await expect(fetchLatestRelease(fetchImpl, 1500)).resolves.toEqual({
      latest: '0.11.0',
      enginesNode: '>=24',
    });
    expect(fetchImpl).toHaveBeenCalledWith(UPDATE_REGISTRY_URL, expect.any(Object));
  });

  it('reports a null enginesNode when engines is missing or invalid', async () => {
    await expect(
      fetchLatestRelease(async () => jsonResponse({ version: '0.11.0' }), 1500),
    ).resolves.toEqual({ latest: '0.11.0', enginesNode: null });
    await expect(
      fetchLatestRelease(
        async () => jsonResponse({ version: '0.11.0', engines: { node: '>=24\u001b[2J' } }),
        1500,
      ),
    ).resolves.toEqual({ latest: '0.11.0', enginesNode: null });
  });

  it('returns null for a non-200 reply', async () => {
    await expect(
      fetchLatestRelease(async () => jsonResponse({ version: '0.11.0' }, 500), 1500),
    ).resolves.toBeNull();
  });

  it('returns null for a version that is not plain semver', async () => {
    await expect(
      fetchLatestRelease(async () => jsonResponse({ version: 'x\u001b[2J' }), 1500),
    ).resolves.toBeNull();
    await expect(
      fetchLatestRelease(async () => jsonResponse({ version: `1.0.0-${'a'.repeat(64)}` }), 1500),
    ).resolves.toBeNull();
  });

  it('returns null when fetch rejects', async () => {
    await expect(
      fetchLatestRelease(async () => {
        throw new TypeError('fetch failed');
      }, 1500),
    ).resolves.toBeNull();
  });

  it('honours the timeout signal', async () => {
    const neverSettles: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const started = Date.now();
    await expect(fetchLatestRelease(neverSettles, 20)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('update cache', () => {
  let tmp: string;
  let cacheFile: string;
  const sample: UpdateCache = {
    version: 1,
    checkedAt: NOW,
    latest: '0.11.0',
    enginesNode: '>=24',
    shownAt: null,
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-update-'));
    cacheFile = path.join(tmp, 'queque', 'update-check.json');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reads null for a missing, corrupt or wrongly shaped file', () => {
    expect(readUpdateCache(cacheFile)).toBeNull();
    fs.mkdirSync(path.dirname(cacheFile), { mode: 0o700 });
    fs.writeFileSync(cacheFile, '{not json');
    expect(readUpdateCache(cacheFile)).toBeNull();
    fs.writeFileSync(cacheFile, JSON.stringify({ ...sample, extra: 1 }));
    expect(readUpdateCache(cacheFile)).toBeNull();
    fs.writeFileSync(cacheFile, JSON.stringify({ ...sample, latest: 'x\u001b[2J' }));
    expect(readUpdateCache(cacheFile)).toBeNull();
  });

  it('round-trips with a 0600 file in a 0700 dir', () => {
    expect(writeUpdateCache(cacheFile, sample)).toBe(true);
    expect(readUpdateCache(cacheFile)).toEqual(sample);
    expect(fs.statSync(cacheFile).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(cacheFile)).mode & 0o777).toBe(0o700);
  });

  it('refuses a group-writable cache dir', () => {
    expect(writeUpdateCache(cacheFile, sample)).toBe(true);
    fs.chmodSync(path.dirname(cacheFile), 0o770);
    expect(readUpdateCache(cacheFile)).toBeNull();
    expect(writeUpdateCache(cacheFile, sample)).toBe(false);
  });

  it('uses ~/.cache/queque on every platform and an absolute XDG_CACHE_HOME only', () => {
    expect(updateCacheDir({ env: {}, platform: 'darwin', homeDir: '/Users/u' })).toBe(
      '/Users/u/.cache/queque',
    );
    expect(updateCacheDir({ env: {}, platform: 'linux', homeDir: '/home/u' })).toBe(
      '/home/u/.cache/queque',
    );
    expect(
      updateCacheDir({ env: { XDG_CACHE_HOME: '/x' }, platform: 'linux', homeDir: '/home/u' }),
    ).toBe('/x/queque');
    expect(
      updateCacheDir({ env: { XDG_CACHE_HOME: 'rel' }, platform: 'linux', homeDir: '/home/u' }),
    ).toBe('/home/u/.cache/queque');
  });
});

describe('createUpdateChecker', () => {
  let tmp: string;
  let cacheFile: string;
  let now: number;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-checker-'));
    cacheFile = path.join(tmp, 'queque', 'update-check.json');
    now = NOW;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function makeChecker(
    options: {
      env?: NodeJS.ProcessEnv;
      fetchImpl?: typeof fetch;
      install?: InstallInfo;
      nodeVersion?: string;
    } = {},
  ) {
    const fetchImpl =
      options.fetchImpl ??
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ version: '0.11.0', engines: { node: '>=24' } }),
      );
    const detect = vi.fn(async () => options.install ?? BREW);
    const checker = createUpdateChecker({
      env: options.env ?? {},
      cacheFile,
      fetchImpl,
      now: () => now,
      currentVersion: '0.10.5',
      nodeVersion: options.nodeVersion ?? '24.14.1',
      detectInstall: detect,
      fetchTimeoutMs: 50,
    });
    return { checker, fetchImpl, detect };
  }

  function seed(cache: Partial<UpdateCache>): void {
    expect(
      writeUpdateCache(cacheFile, {
        version: 1,
        checkedAt: now,
        latest: '0.11.0',
        enginesNode: null,
        shownAt: null,
        ...cache,
      }),
    ).toBe(true);
  }

  it('starts exactly one fetch without a cache and returns no hint yet', async () => {
    const { checker, fetchImpl } = makeChecker();
    const [a, b] = await Promise.all([checker.hint(), checker.hint()]);
    expect(a).toBeNull();
    expect(b).toBeNull();
    await vi.waitFor(() => expect(readUpdateCache(cacheFile)).not.toBeNull());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(readUpdateCache(cacheFile)).toMatchObject({
      checkedAt: NOW,
      latest: '0.11.0',
      enginesNode: '>=24',
      shownAt: null,
    });
  });

  it('does not fetch with a fresh cache and fetches once with a 24 h old one', async () => {
    seed({ checkedAt: now - HOUR, latest: '0.10.5' });
    const fresh = makeChecker();
    await fresh.checker.hint();
    expect(fresh.fetchImpl).not.toHaveBeenCalled();

    seed({ checkedAt: now - UPDATE_CHECK_INTERVAL_MS, latest: '0.10.5' });
    const stale = makeChecker();
    await stale.checker.hint();
    await vi.waitFor(() => expect(readUpdateCache(cacheFile)?.checkedAt).toBe(NOW));
    expect(stale.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stays silent offline and keeps the previous latest', async () => {
    seed({ checkedAt: now - 25 * HOUR, latest: '0.10.5', enginesNode: '>=24' });
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    const { checker } = makeChecker({ fetchImpl });
    await expect(checker.hint()).resolves.toBeNull();
    await vi.waitFor(() => expect(readUpdateCache(cacheFile)?.checkedAt).toBe(NOW));
    expect(readUpdateCache(cacheFile)).toMatchObject({ latest: '0.10.5', enginesNode: '>=24' });
    await checker.hint();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { QQ_NO_UPDATE_CHECK: '1' },
    { CI: '1' },
  ])('returns null and never fetches with %j', async (env) => {
    seed({ checkedAt: now - 25 * HOUR });
    const { checker, fetchImpl } = makeChecker({ env });
    await expect(checker.hint()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows the hint at most once per 24 h', async () => {
    seed({});
    const { checker } = makeChecker();
    await expect(checker.hint()).resolves.toBe('qq 0.11.0 available · brew upgrade queque');
    expect(readUpdateCache(cacheFile)?.shownAt).toBe(NOW);
    await expect(checker.hint()).resolves.toBeNull();
    now += UPDATE_HINT_INTERVAL_MS;
    await expect(checker.hint()).resolves.toBe('qq 0.11.0 available · brew upgrade queque');
  });

  it('runs detectInstall once for the checker lifetime', async () => {
    seed({});
    const { checker, detect } = makeChecker();
    await checker.hint();
    await checker.hint();
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it('returns null when the latest equals the running version', async () => {
    seed({ latest: '0.10.5' });
    const { checker } = makeChecker();
    await expect(checker.hint()).resolves.toBeNull();
  });

  it('names the Node floor when the latest release needs a newer Node', async () => {
    seed({ enginesNode: '>=26' });
    const { checker } = makeChecker();
    await expect(checker.hint()).resolves.toBe('qq 0.11.0 needs Node 26+; you have 24.14.1');
  });

  it('status() reports blocked, unknown, current and available without touching shownAt', async () => {
    const blocked = makeChecker({ env: { QQ_NO_UPDATE_CHECK: '1' } });
    await expect(blocked.checker.status({ isTTY: true, refresh: true })).resolves.toEqual({
      state: 'blocked',
      reason: 'QQ_NO_UPDATE_CHECK',
    });
    const offline = makeChecker({
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.checker.status({ isTTY: true, refresh: false })).resolves.toEqual({
      state: 'unknown',
    });
    await expect(makeChecker().checker.status({ isTTY: false, refresh: true })).resolves.toEqual({
      state: 'blocked',
      reason: 'not a terminal',
    });

    const refreshing = makeChecker();
    await expect(refreshing.checker.status({ isTTY: true, refresh: true })).resolves.toEqual({
      state: 'available',
      current: '0.10.5',
      latest: '0.11.0',
      nodeTooOld: null,
      install: BREW,
    });
    expect(readUpdateCache(cacheFile)?.shownAt).toBeNull();

    seed({ latest: '0.10.5' });
    await expect(makeChecker().checker.status({ isTTY: true, refresh: true })).resolves.toEqual({
      state: 'current',
      current: '0.10.5',
    });
  });
});

describe('formatUpdateHint (Task 1 rows)', () => {
  it('returns null unless an update is available', () => {
    expect(formatUpdateHint({ state: 'unknown' })).toBeNull();
    expect(formatUpdateHint({ state: 'current', current: '0.10.5' })).toBeNull();
    expect(formatUpdateHint({ state: 'blocked', reason: 'CI' })).toBeNull();
  });

  it('points an unknown install at the releases page', () => {
    expect(formatUpdateHint(available(UNKNOWN))).toBe(`qq 0.11.0 available · ${RELEASES_URL}`);
    expect(RELEASES_URL).toBe('https://github.com/k-leumas/queque/releases');
  });

  it('uses the marker upgrade text', () => {
    expect(
      formatUpdateHint(
        available({
          method: 'marker',
          source: 'homebrew',
          upgradeCommand: 'brew upgrade queque',
          packaged: false,
        }),
      ),
    ).toBe('qq 0.11.0 available · brew upgrade queque');
    expect(
      formatUpdateHint(
        available({
          method: 'marker',
          source: 'aur',
          upgradeCommand: 'paru -S queque',
          packaged: true,
        }),
      ),
    ).toBe('upstream qq 0.11.0 released; your package may not have it yet · paru -S queque');
  });
});

describe('formatUpdateHint: one line per install method', () => {
  const NPM = 'npm i -g @k-leumas/queque-cli@latest';
  const UPSTREAM = 'upstream qq 0.11.0 released; your package may not have it yet';
  const rows: Array<[string, InstallInfo, string | null]> = [
    ['brew', BREW, 'qq 0.11.0 available · brew upgrade queque'],
    [
      'nvm',
      { method: 'nvm', upgradeCommand: NPM, note: 'this Node version only', packaged: false },
      `qq 0.11.0 available · ${NPM} (this Node version only)`,
    ],
    [
      'system npm, non-writable',
      {
        method: 'npm',
        upgradeCommand: NPM,
        note: 'set a user npm prefix first, not sudo',
        packaged: false,
      },
      `qq 0.11.0 available · ${NPM} (set a user npm prefix first, not sudo)`,
    ],
    ['nix', { method: 'nix', upgradeCommand: null, packaged: false }, null],
    [
      'apt',
      { method: 'apt', upgradeCommand: 'sudo apt install --only-upgrade queque', packaged: true },
      `${UPSTREAM} · sudo apt install --only-upgrade queque`,
    ],
    [
      'aur',
      { method: 'aur', upgradeCommand: null, note: 'update via your AUR helper', packaged: true },
      `${UPSTREAM} · update via your AUR helper`,
    ],
    [
      'packaged, no command, no note',
      { method: 'rpm', upgradeCommand: null, packaged: true },
      `${UPSTREAM} · update it with your package manager`,
    ],
    [
      'windows-node',
      { method: 'windows-node', upgradeCommand: null, packaged: false },
      'qq 0.11.0 available · this qq runs on a Windows Node; install Node inside WSL',
    ],
    ['unknown', UNKNOWN, `qq 0.11.0 available · ${RELEASES_URL}`],
  ];

  it.each(rows)('%s', (_label, install, expected) => {
    const line = formatUpdateHint(available(install));
    expect(line).toBe(expected);
    if (line !== null) {
      expect(line.length).toBeLessThanOrEqual(200);
      const controls = [...line].filter((ch) => ch.charCodeAt(0) < 0x20 || ch === '\u007f');
      expect(controls).toEqual([]);
    }
  });

  it('truncates an over-long line to 200 chars', () => {
    const line = formatUpdateHint(
      available({ method: 'marker', source: 'x', upgradeCommand: 'a'.repeat(300), packaged: true }),
    );
    expect(line?.length).toBe(200);
  });
});

describe('detectInstall (Task 1 rows)', () => {
  const CELLAR_APP =
    '/opt/homebrew/Cellar/queque/0.10.5/libexec/lib/node_modules/@k-leumas/queque-cli/dist/cli/app.js';
  const CELLAR_ROOT =
    '/opt/homebrew/Cellar/queque/0.10.5/libexec/lib/node_modules/@k-leumas/queque-cli';

  function deps(modulePath: string, files: Record<string, string> = {}): InstallDetectDeps {
    return {
      modulePath,
      execPath: '/opt/homebrew/bin/node',
      env: {},
      homeDir: '/Users/u',
      platform: 'darwin',
      realpath: (p) => p,
      readFile: (p) => files[p] ?? null,
      isWritable: () => true,
      runOwnerQuery: vi.fn(async () => ({ ok: false, stdout: '' })),
      readOsRelease: () => null,
    };
  }

  it('detects a Homebrew Cellar install', async () => {
    await expect(detectInstall(deps(CELLAR_APP))).resolves.toEqual({
      method: 'brew',
      upgradeCommand: 'brew upgrade queque',
      packaged: false,
    });
  });

  it('prefers a valid .install-source marker over the path rule', async () => {
    const marker = JSON.stringify({ source: 'aur', upgrade: 'paru -S queque' });
    await expect(
      detectInstall(deps(CELLAR_APP, { [`${CELLAR_ROOT}/.install-source`]: marker })),
    ).resolves.toEqual({
      method: 'marker',
      source: 'aur',
      upgradeCommand: 'paru -S queque',
      packaged: true,
    });
    const homebrew = JSON.stringify({ source: 'homebrew', upgrade: 'brew upgrade queque' });
    await expect(
      detectInstall(deps(CELLAR_APP, { [`${CELLAR_ROOT}/.install-source`]: homebrew })),
    ).resolves.toMatchObject({ method: 'marker', source: 'homebrew', packaged: false });
  });

  it.each([
    ['bad JSON', '{source:'],
    ['an unknown key', JSON.stringify({ source: 'aur', upgrade: 'paru -S queque', x: 1 })],
    ['a control char', JSON.stringify({ source: 'aur', upgrade: 'paru -S queque\u001b[2J' })],
    ['a long upgrade', JSON.stringify({ source: 'aur', upgrade: 'a'.repeat(121) })],
    ['a bad source', JSON.stringify({ source: 'Aur!', upgrade: 'paru -S queque' })],
  ])('ignores a marker with %s', async (_label, content) => {
    await expect(
      detectInstall(deps(CELLAR_APP, { [`${CELLAR_ROOT}/.install-source`]: content })),
    ).resolves.toMatchObject({ method: 'brew', upgradeCommand: 'brew upgrade queque' });
  });

  it('reports a source checkout as unknown', async () => {
    await expect(detectInstall(deps('/Users/x/dev/queque/dist/cli/app.js'))).resolves.toEqual({
      method: 'unknown',
      upgradeCommand: null,
      packaged: false,
    });
  });
});
