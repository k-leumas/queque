import { describe, expect, it } from 'vitest';
import { environmentPayloadSchema } from '../src/contracts/telemetry.js';
import {
  collectEnvironmentShape,
  type EnvironmentShapeInput,
  shellMajorMinor,
} from '../src/shared/environment-shape.js';

/** A Linux x64 host on node 24 with zsh 5.9 and an Ubuntu os-release, unless overridden. */
function shape(overrides: EnvironmentShapeInput = {}) {
  return collectEnvironmentShape({
    env: { QQ_ZSH_VERSION: '5.9' },
    platform: 'linux',
    arch: 'x64',
    nodeVersion: 'v24.14.1',
    readOsRelease: () => 'NAME="Ubuntu"\nID=ubuntu\nVERSION_ID="24.04"\n',
    ...overrides,
  });
}

/** One property of a shape, read by name (keeps single-line assertion messages). */
function prop(result: ReturnType<typeof shape>, key: string): unknown {
  return (result as Record<string, unknown> | null)?.[key];
}

describe('collectEnvironmentShape', () => {
  it('maps a full Linux host and parses with the environment payload schema', () => {
    const result = shape();
    expect(result).toEqual({
      os: 'linux',
      arch: 'x64',
      distro: 'ubuntu',
      shell: 'zsh',
      shell_version: '5.9',
      zsh: '5.9',
      node_major: 24,
      zellij: false,
    });
    expect(environmentPayloadSchema.parse(result)).toEqual(result);
  });

  it('reports darwin as os darwin and distro macos without reading os-release', () => {
    let read = false;
    const result = shape({
      platform: 'darwin',
      arch: 'arm64',
      readOsRelease: () => {
        read = true;
        return 'ID=ubuntu\n';
      },
    });
    expect(result).toMatchObject({ os: 'darwin', arch: 'arm64', distro: 'macos' });
    expect(read).toBe(false);
  });

  it('strips quotes from the os-release ID', () => {
    expect(shape({ readOsRelease: () => 'NAME="Arch Linux"\nID="arch"\n' })?.distro).toBe('arch');
  });

  it('maps an ID outside the enum to other, never the raw value', () => {
    const result = shape({ readOsRelease: () => 'ID=linuxmint\nID_LIKE="ubuntu debian"\n' });
    expect(result?.distro).toBe('other');
    expect(JSON.stringify(result)).not.toContain('linuxmint');
  });

  it('maps an unreadable os-release to other', () => {
    expect(shape({ readOsRelease: () => null })?.distro).toBe('other');
  });

  it('maps an unknown platform and arch to other', () => {
    expect(shape({ platform: 'freebsd', arch: 'ia32' })).toMatchObject({
      os: 'other',
      arch: 'other',
      distro: 'other',
    });
  });

  it.each([
    ['5.9', '5.9'],
    ['5.8.1', '5.8'],
    ['5.9-dev-1', '5.9'],
    [undefined, 'unknown'],
    ['banana', 'unknown'],
    ['', 'unknown'],
  ])('reads QQ_ZSH_VERSION %s as %s', (version, expected) => {
    const env: NodeJS.ProcessEnv = version === undefined ? {} : { QQ_ZSH_VERSION: version };
    expect(shape({ env })?.zsh).toBe(expected);
    expect(prop(shape({ env }), 'shell_version')).toBe(expected);
  });

  it('reads the node major from the version string', () => {
    expect(shape({ nodeVersion: 'v24.14.1' })?.node_major).toBe(24);
    expect(shape({ nodeVersion: 'v20.0.0' })?.node_major).toBe(20);
  });

  it('returns null when the node major is outside the schema bound', () => {
    expect(shape({ nodeVersion: 'v16.20.2' })).toBeNull();
    expect(shape({ nodeVersion: 'garbage' })).toBeNull();
  });

  it('sets zellij when ZELLIJ is present in the environment', () => {
    expect(shape({ env: { QQ_ZSH_VERSION: '5.9', ZELLIJ: '0' } })?.zellij).toBe(true);
    expect(shape({ env: { QQ_ZSH_VERSION: '5.9' } })?.zellij).toBe(false);
  });

  it('never carries a value from the environment beyond the enum shape', () => {
    const result = shape({
      env: {
        QQ_ZSH_VERSION: '5.9',
        ZELLIJ: '/home/alice/zellij-session',
        HOME: '/home/alice',
        PWD: '/home/alice/proj',
      },
    });
    expect(JSON.stringify(result)).not.toContain('alice');
  });

  it('reports a bash request as shell bash with major.minor and zsh unknown', () => {
    const result = shape({ env: {}, shell: 'bash', shellVersion: '5.2.21(1)-release' });
    expect(prop(result, 'shell')).toBe('bash');
  });

  it('cuts the bash version to major.minor and never carries the build string', () => {
    const result = shape({ env: {}, shell: 'bash', shellVersion: '5.2.21(1)-release' });
    expect(result).toMatchObject({ shell: 'bash', shell_version: '5.2', zsh: 'unknown' });
    expect(environmentPayloadSchema.parse(result)).toEqual(result);
    expect(JSON.stringify(result)).not.toMatch(/5\.2\.21|release|\(1\)/);
  });

  it('ignores QQ_ZSH_VERSION for a bash request', () => {
    const result = shape({
      env: { QQ_ZSH_VERSION: '5.9' },
      shell: 'bash',
      shellVersion: '5.2.21(1)-release',
    });
    expect(result).toMatchObject({ shell: 'bash', shell_version: '5.2', zsh: 'unknown' });
  });

  it('reports bash with shell_version unknown when the version is missing or malformed', () => {
    expect(shape({ env: {}, shell: 'bash' })).toMatchObject({
      shell: 'bash',
      shell_version: 'unknown',
      zsh: 'unknown',
    });
    const malformed = shape({ env: {}, shell: 'bash', shellVersion: 'GNU bash' });
    expect(prop(malformed, 'shell_version')).toBe('unknown');
  });

  it('reports a zsh request with the same major.minor in shell_version and zsh', () => {
    expect(shape({ env: { QQ_ZSH_VERSION: '5.9' }, shell: 'zsh' })).toMatchObject({
      shell: 'zsh',
      shell_version: '5.9',
      zsh: '5.9',
    });
    expect(shape({ env: {}, shell: 'zsh', shellVersion: '5.8.1' })).toMatchObject({
      shell: 'zsh',
      shell_version: '5.8',
      zsh: '5.8',
    });
  });

  it('reports zsh from QQ_ZSH_VERSION when the request names no shell (old widgets)', () => {
    expect(shape({ env: { QQ_ZSH_VERSION: '5.9' } })).toMatchObject({
      shell: 'zsh',
      shell_version: '5.9',
      zsh: '5.9',
    });
  });

  it('reports a fish request as shell fish with major.minor and zsh unknown', () => {
    expect(shape({ env: {}, shell: 'fish', shellVersion: '4.0.2' })).toMatchObject({
      shell: 'fish',
      shell_version: '4.0',
      zsh: 'unknown',
    });
  });

  it('works with the real host defaults', () => {
    const result = collectEnvironmentShape({ env: {} });
    expect(result).not.toBeNull();
    expect(environmentPayloadSchema.safeParse(result).success).toBe(true);
  });
});

describe('shellMajorMinor', () => {
  it.each([
    ['5.2.21(1)-release', '5.2'],
    ['5.9', '5.9'],
    ['4.0.1', '4.0'],
    ['5.9-dev-1', '5.9'],
    ['x', 'unknown'],
    ['', 'unknown'],
    [undefined, 'unknown'],
    ['123.4', 'unknown'],
  ])('cuts %j to %s', (version, expected) => {
    expect(shellMajorMinor(version)).toBe(expected);
  });
});
