import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_EFFORT,
  defaultConfigPath,
  EFFORT_LEVELS,
  loadQqConfig,
  qqConfigFileSchema,
  resetQqConfigCache,
  resolveEffort,
} from '../src/shared/qq-config.js';

describe('qqConfigFileSchema', () => {
  it('accepts a minimal privacy and safety config', () => {
    const parsed = qqConfigFileSchema.parse({
      privacy: {
        sensitivePathPatterns: ['\\.env'],
        redactLogKeys: ['token'],
        allowFileRead: false,
      },
      safety: {
        destructiveCommandPatterns: ['\\bsudo\\b'],
      },
    });

    expect(parsed.privacy?.sensitivePathPatterns).toEqual(['\\.env']);
  });

  it('accepts an empty object', () => {
    expect(qqConfigFileSchema.parse({})).toEqual({});
  });
});

describe('effort config key (D-01)', () => {
  it('lists the five claude effort levels and defaults to low', () => {
    expect(EFFORT_LEVELS).toEqual(['low', 'medium', 'high', 'xhigh', 'max']);
    expect(DEFAULT_EFFORT).toBe('low');
  });

  it('accepts a valid level', () => {
    expect(qqConfigFileSchema.parse({ effort: 'high' }).effort).toBe('high');
  });

  it('trims and lowercases the level', () => {
    expect(qqConfigFileSchema.parse({ effort: ' LOW ' }).effort).toBe('low');
    expect(qqConfigFileSchema.parse({ effort: 'Max' }).effort).toBe('max');
  });

  it('drops an invalid level but keeps the rest of the file', () => {
    const parsed = qqConfigFileSchema.parse({
      effort: 'bogus',
      privacy: { sensitivePathPatterns: ['x'] },
    });

    expect(parsed.effort).toBeUndefined();
    expect(parsed.privacy?.sensitivePathPatterns).toEqual(['x']);
  });

  it('drops a non-string level', () => {
    expect(qqConfigFileSchema.parse({ effort: 3 }).effort).toBeUndefined();
  });

  it('adds no effort key when the file has none', () => {
    expect(Object.hasOwn(qqConfigFileSchema.parse({}), 'effort')).toBe(false);
  });
});

describe('loadQqConfig effort (D-01)', () => {
  let dir: string;
  let previousConfigFile: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qq-config-'));
    previousConfigFile = process.env.QQ_CONFIG_FILE;
    process.env.QQ_CONFIG_FILE = join(dir, 'config.json');
    resetQqConfigCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetQqConfigCache();
    if (previousConfigFile === undefined) {
      delete process.env.QQ_CONFIG_FILE;
    } else {
      process.env.QQ_CONFIG_FILE = previousConfigFile;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function writeConfig(value: unknown): void {
    writeFileSync(join(dir, 'config.json'), JSON.stringify(value));
  }

  it('reads effort from config.json', () => {
    writeConfig({ effort: 'medium' });

    expect(loadQqConfig().effort).toBe('medium');
  });

  it('defaults to low when there is no config file', () => {
    expect(loadQqConfig().effort).toBe('low');
  });

  it('falls back to low for an invalid level without dropping the privacy patterns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    writeConfig({ effort: 'bogus', privacy: { sensitivePathPatterns: ['zz'] } });

    const config = loadQqConfig();

    expect(config.effort).toBe('low');
    expect(config.sensitivePathRegexes.some((regex) => regex.source === 'zz')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('resolveEffort returns the loaded effort', () => {
    writeConfig({ effort: 'xhigh' });

    expect(resolveEffort()).toBe(loadQqConfig().effort);
    expect(resolveEffort()).toBe('xhigh');
  });
});

describe('QQ_CONFIG_FILE override (IN-14)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetQqConfigCache();
  });

  it.each(['', '   '])('an empty override %j reads the default path', (value) => {
    vi.stubEnv('QQ_CONFIG_FILE', value);
    expect(defaultConfigPath()).toBe(join(homedir(), '.config', 'qq', 'config.json'));
  });

  it('an absolute override is used as is (trimmed)', () => {
    vi.stubEnv('QQ_CONFIG_FILE', '  /etc/qq/config.json  ');
    expect(defaultConfigPath()).toBe('/etc/qq/config.json');
  });

  it('a relative override resolves against the home directory, not the cwd', () => {
    vi.stubEnv('QQ_CONFIG_FILE', 'qq/config.json');
    expect(defaultConfigPath()).toBe(join(homedir(), 'qq', 'config.json'));
  });

  it('an empty override still loads the privacy patterns of the default file', () => {
    const home = mkdtempSync(join(tmpdir(), 'qq-config-home-'));
    try {
      vi.stubEnv('HOME', home);
      vi.stubEnv('QQ_CONFIG_FILE', '');
      mkdirSync(join(home, '.config', 'qq'), { recursive: true });
      writeFileSync(
        join(home, '.config', 'qq', 'config.json'),
        JSON.stringify({ privacy: { sensitivePathPatterns: ['zz-in14'] } }),
      );
      resetQqConfigCache();

      const config = loadQqConfig();

      expect(config.sensitivePathRegexes.some((regex) => regex.source === 'zz-in14')).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
