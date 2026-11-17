import { describe, expect, it, vi } from 'vitest';
import {
  detectInstall,
  type InstallDetectDeps,
  NPM_PACKAGE,
} from '../src/shared/install-detect.js';

const NPM_COMMAND = `npm i -g ${NPM_PACKAGE}@latest`;
const PKG = 'node_modules/@k-leumas/queque-cli/dist/cli/app.js';

type OwnerReplies = Record<string, { ok: boolean; stdout: string }>;

interface FakeOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  writable?: boolean;
  owners?: OwnerReplies;
  osRelease?: string | null;
}

/** Fake deps: realpath is the identity, owner queries answer from `owners` (key: argv joined). */
function fake(modulePath: string, options: FakeOptions = {}) {
  const platform = options.platform ?? 'linux';
  const runOwnerQuery = vi.fn(async (cmd: string, args: string[]) => {
    return options.owners?.[[cmd, ...args].join(' ')] ?? { ok: false, stdout: '' };
  });
  const isWritable = vi.fn(() => options.writable ?? true);
  const deps: InstallDetectDeps = {
    modulePath,
    execPath: options.execPath ?? '/usr/bin/node',
    env: options.env ?? {},
    homeDir: platform === 'darwin' ? '/Users/u' : '/home/u',
    platform,
    realpath: (p) => p,
    readFile: () => null,
    isWritable,
    runOwnerQuery,
    readOsRelease: () => options.osRelease ?? null,
  };
  return { deps, runOwnerQuery, isWritable };
}

describe('detectInstall: path rules', () => {
  it('detects Homebrew on macOS and Linux without owner queries', async () => {
    const mac = fake(`/opt/homebrew/Cellar/queque/0.10.5/libexec/lib/${PKG}`, {
      platform: 'darwin',
    });
    await expect(detectInstall(mac.deps)).resolves.toEqual({
      method: 'brew',
      upgradeCommand: 'brew upgrade queque',
      packaged: false,
    });
    const linux = fake(`/home/linuxbrew/.linuxbrew/Cellar/queque/0.10.5/libexec/lib/${PKG}`);
    await expect(detectInstall(linux.deps)).resolves.toMatchObject({
      method: 'brew',
      upgradeCommand: 'brew upgrade queque',
    });
    expect(mac.runOwnerQuery).not.toHaveBeenCalled();
    expect(linux.runOwnerQuery).not.toHaveBeenCalled();
  });

  it('detects volta under ~/.volta and under VOLTA_HOME', async () => {
    const home = fake(`/home/u/.volta/tools/image/packages/@k-leumas/queque-cli/lib/${PKG}`);
    await expect(detectInstall(home.deps)).resolves.toEqual({
      method: 'volta',
      upgradeCommand: 'volta install @k-leumas/queque-cli',
      packaged: false,
    });
    const custom = fake(`/opt/volta/tools/image/packages/@k-leumas/queque-cli/lib/${PKG}`, {
      env: { VOLTA_HOME: '/opt/volta' },
    });
    await expect(detectInstall(custom.deps)).resolves.toMatchObject({ method: 'volta' });
  });

  it('detects pnpm under PNPM_HOME and by its /pnpm/global/ segment', async () => {
    const appPath = `/Users/u/Library/pnpm/global/5/.pnpm/@k-leumas+queque-cli@0.10.5/${PKG}`;
    const withHome = fake(appPath, {
      platform: 'darwin',
      env: { PNPM_HOME: '/Users/u/Library/pnpm' },
    });
    await expect(detectInstall(withHome.deps)).resolves.toEqual({
      method: 'pnpm',
      upgradeCommand: 'pnpm add -g @k-leumas/queque-cli',
      packaged: false,
    });
    const withoutHome = fake(appPath, { platform: 'darwin' });
    await expect(detectInstall(withoutHome.deps)).resolves.toMatchObject({ method: 'pnpm' });
  });

  it('detects nvm with the npm command for this Node version only', async () => {
    const { deps } = fake(`/home/u/.nvm/versions/node/v24.14.1/lib/${PKG}`);
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'nvm',
      upgradeCommand: NPM_COMMAND,
      note: 'this Node version only',
      packaged: false,
    });
  });

  it('detects fnm by its node-versions dir and under FNM_DIR', async () => {
    const { deps } = fake(
      `/home/u/.local/share/fnm/node-versions/v24.14.1/installation/lib/${PKG}`,
    );
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'fnm',
      upgradeCommand: NPM_COMMAND,
      note: 'this Node version only',
      packaged: false,
    });
    const custom = fake(`/opt/fnm/v24.14.1/installation/lib/${PKG}`, {
      env: { FNM_DIR: '/opt/fnm' },
    });
    await expect(detectInstall(custom.deps)).resolves.toMatchObject({ method: 'fnm' });
  });

  it('detects a writable user npm prefix without owner queries', async () => {
    const { deps, runOwnerQuery, isWritable } = fake(`/home/u/.npm-global/lib/${PKG}`);
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'npm',
      upgradeCommand: NPM_COMMAND,
      packaged: false,
    });
    expect(runOwnerQuery).not.toHaveBeenCalled();
    expect(isWritable).toHaveBeenCalledWith('/home/u/.npm-global/lib/node_modules');
  });

  it('notes a user prefix for a non-writable system npm and never suggests sudo npm', async () => {
    const { deps, runOwnerQuery } = fake(`/usr/lib/${PKG}`, { writable: false });
    const info = await detectInstall(deps);
    expect(info).toEqual({
      method: 'npm',
      upgradeCommand: NPM_COMMAND,
      note: 'set a user npm prefix first, not sudo',
      packaged: false,
    });
    expect(info.upgradeCommand).not.toContain('sudo npm');
    expect(runOwnerQuery.mock.calls.map((call) => call[0])).toEqual(['dpkg', 'rpm', 'pacman']);
  });

  it('joins the user-prefix note to the nvm note', async () => {
    const { deps } = fake(`/home/u/.nvm/versions/node/v24.14.1/lib/${PKG}`, { writable: false });
    await expect(detectInstall(deps)).resolves.toMatchObject({
      note: 'this Node version only; set a user npm prefix first, not sudo',
    });
  });

  it('skips owner queries on macOS', async () => {
    const { deps, runOwnerQuery } = fake(`/usr/local/lib/${PKG}`, { platform: 'darwin' });
    await expect(detectInstall(deps)).resolves.toMatchObject({
      method: 'npm',
      upgradeCommand: NPM_COMMAND,
    });
    expect(runOwnerQuery).not.toHaveBeenCalled();
  });

  it('gives a nix store install no command', async () => {
    const { deps } = fake(`/nix/store/abc123-queque-0.10.5/lib/${PKG}`);
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'nix',
      upgradeCommand: null,
      packaged: false,
    });
  });

  it('flags a Windows Node under WSL before reading the marker', async () => {
    const { deps } = fake(`/mnt/c/Users/u/AppData/Roaming/npm/${PKG}`, {
      execPath: '/mnt/c/Program Files/nodejs/node.exe',
    });
    deps.readFile = () => JSON.stringify({ source: 'homebrew', upgrade: 'brew upgrade queque' });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'windows-node',
      upgradeCommand: null,
      packaged: false,
    });
  });

  it('reports a source checkout as unknown', async () => {
    const { deps } = fake('/home/u/src/queque/dist/cli/app.js');
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'unknown',
      upgradeCommand: null,
      packaged: false,
    });
  });
});

describe('detectInstall: Linux package owners', () => {
  const APP = '/usr/lib/queque/dist/cli/app.js';
  const DPKG = `dpkg -S ${APP}`;
  const RPM = `rpm -qf --qf %{NAME}\\n ${APP}`;
  const PACMAN = `pacman -Qoq ${APP}`;
  const PACMAN_FOREIGN = 'pacman -Qm queque';

  it('asks dpkg first and stops at its hit', async () => {
    const { deps, runOwnerQuery } = fake(APP, {
      owners: { [DPKG]: { ok: true, stdout: `queque: ${APP}\n` } },
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'apt',
      upgradeCommand: 'sudo apt install --only-upgrade queque',
      packaged: true,
    });
    expect(runOwnerQuery).toHaveBeenCalledTimes(1);
    expect(runOwnerQuery).toHaveBeenCalledWith('dpkg', ['-S', APP]);
  });

  it('maps an rpm owner on openSUSE to zypper', async () => {
    const { deps, runOwnerQuery } = fake(APP, {
      owners: { [RPM]: { ok: true, stdout: 'queque\n' } },
      osRelease: 'NAME="openSUSE Tumbleweed"\nID="opensuse-tumbleweed"\nID_LIKE="opensuse suse"\n',
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'zypper',
      upgradeCommand: 'sudo zypper up queque',
      packaged: true,
    });
    expect(runOwnerQuery).toHaveBeenCalledWith('rpm', ['-qf', '--qf', '%{NAME}\\n', APP]);
  });

  it('maps an rpm owner on Fedora and its relatives to dnf', async () => {
    const fedora = fake(APP, {
      owners: { [RPM]: { ok: true, stdout: 'queque\n' } },
      osRelease: 'ID=fedora\nVERSION_ID=41\n',
    });
    await expect(detectInstall(fedora.deps)).resolves.toEqual({
      method: 'dnf',
      upgradeCommand: 'sudo dnf upgrade queque',
      packaged: true,
    });
    const rocky = fake(APP, {
      owners: { [RPM]: { ok: true, stdout: 'queque\n' } },
      osRelease: 'ID="rocky"\nID_LIKE="rhel centos fedora"\n',
    });
    await expect(detectInstall(rocky.deps)).resolves.toMatchObject({ method: 'dnf' });
  });

  it('gives an rpm owner on an unknown distro no command', async () => {
    const { deps } = fake(APP, {
      owners: { [RPM]: { ok: true, stdout: 'queque\n' } },
      osRelease: 'ID=mageia\n',
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'rpm',
      upgradeCommand: null,
      packaged: true,
    });
  });

  it('maps a pacman repo package to pacman -Syu', async () => {
    const { deps } = fake(APP, {
      owners: {
        [PACMAN]: { ok: true, stdout: 'queque\n' },
        [PACMAN_FOREIGN]: { ok: false, stdout: '' },
      },
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'pacman',
      upgradeCommand: 'sudo pacman -Syu',
      packaged: true,
    });
  });

  it('maps a foreign (AUR) pacman package to the AUR helper note', async () => {
    const { deps } = fake(APP, {
      owners: {
        [PACMAN]: { ok: true, stdout: 'queque\n' },
        [PACMAN_FOREIGN]: { ok: true, stdout: 'queque 0.10.5-1\n' },
      },
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'aur',
      upgradeCommand: null,
      note: 'update via your AUR helper',
      packaged: true,
    });
  });

  it('keeps the method but drops the command when the owner is not named queque', async () => {
    const { deps } = fake(APP, {
      owners: { [DPKG]: { ok: true, stdout: `nodejs-queque: ${APP}\n` } },
    });
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'apt',
      upgradeCommand: null,
      packaged: true,
    });
  });

  it('reports an unowned /usr path outside node_modules as unknown', async () => {
    const { deps, runOwnerQuery } = fake(APP);
    await expect(detectInstall(deps)).resolves.toEqual({
      method: 'unknown',
      upgradeCommand: null,
      packaged: false,
    });
    expect(runOwnerQuery).toHaveBeenCalledTimes(3);
  });
});
