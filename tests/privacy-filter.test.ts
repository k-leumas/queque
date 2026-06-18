import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextEnvelope } from '../src/contracts/request.js';
import {
  filterContextEnvelope,
  isDestructiveCommand,
  isFileReadAllowed,
  isSensitivePath,
  redactForLog,
} from '../src/shared/privacy-filter.js';
import {
  compilePatterns,
  DEFAULT_SENSITIVE_PATH_PATTERNS,
  loadQqConfig,
  MAX_PATTERN_LENGTH,
  resetQqConfigCache,
} from '../src/shared/qq-config.js';

describe('qq-config', () => {
  let configDir: string;
  let previousConfigFile: string | undefined;

  beforeEach(() => {
    resetQqConfigCache();
    configDir = join(tmpdir(), `qq-config-test-${Date.now()}`);
    mkdirSync(configDir, { recursive: true });
    previousConfigFile = process.env.QQ_CONFIG_FILE;
    process.env.QQ_CONFIG_FILE = join(configDir, 'config.json');
  });

  afterEach(() => {
    resetQqConfigCache();
    if (previousConfigFile === undefined) {
      delete process.env.QQ_CONFIG_FILE;
    } else {
      process.env.QQ_CONFIG_FILE = previousConfigFile;
    }
    rmSync(configDir, { recursive: true, force: true });
  });

  it('uses built-in defaults when config file is missing', () => {
    const config = loadQqConfig();
    expect(config.sensitivePathRegexes.length).toBeGreaterThanOrEqual(
      DEFAULT_SENSITIVE_PATH_PATTERNS.length,
    );
    expect(config.redactLogKeys.has('lbuffer')).toBe(true);
    expect(config.allowFileRead).toBe(false);
  });

  it('merges user sensitivePathPatterns onto built-in defaults', () => {
    writeFileSync(
      process.env.QQ_CONFIG_FILE!,
      JSON.stringify({
        privacy: {
          sensitivePathPatterns: ['internal/secrets'],
        },
      }),
    );
    resetQqConfigCache();

    expect(isSensitivePath('internal/secrets/foo.txt')).toBe(true);
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('src/index.ts')).toBe(false);
  });

  it('honors privacy.allowFileRead from config', () => {
    writeFileSync(
      process.env.QQ_CONFIG_FILE!,
      JSON.stringify({ privacy: { allowFileRead: true } }),
    );
    resetQqConfigCache();

    expect(isFileReadAllowed()).toBe(true);
  });

  it('env QQ_ALLOW_FILE_READ overrides config file', () => {
    writeFileSync(
      process.env.QQ_CONFIG_FILE!,
      JSON.stringify({ privacy: { allowFileRead: false } }),
    );
    process.env.QQ_ALLOW_FILE_READ = '1';
    resetQqConfigCache();

    expect(isFileReadAllowed()).toBe(true);
    delete process.env.QQ_ALLOW_FILE_READ;
  });

  it('merges user destructiveCommandPatterns', () => {
    writeFileSync(
      process.env.QQ_CONFIG_FILE!,
      JSON.stringify({ safety: { destructiveCommandPatterns: ['\\bdd\\s+if='] } }),
    );
    resetQqConfigCache();

    expect(isDestructiveCommand('dd if=/dev/zero of=/dev/sda')).toBe(true);
    expect(isDestructiveCommand('git status')).toBe(false);
  });

  it('skips invalid regex patterns without breaking defaults', () => {
    const compiled = compilePatterns(['[invalid', '\\.env']);
    expect(compiled).toHaveLength(1);
    expect(compiled[0]?.test('.env')).toBe(true);
  });

  it('skips patterns longer than MAX_PATTERN_LENGTH', () => {
    const longPattern = 'a'.repeat(MAX_PATTERN_LENGTH + 1);
    const compiled = compilePatterns([longPattern, '\\.env']);
    expect(compiled).toHaveLength(1);
    expect(compiled[0]?.test('.env')).toBe(true);
  });

  it('warns when config file is present but invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeFileSync(process.env.QQ_CONFIG_FILE!, '{ not json');
    resetQqConfigCache();

    loadQqConfig();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ignoring invalid config'));
    warnSpy.mockRestore();
  });
});

describe('isSensitivePath', () => {
  beforeEach(() => resetQqConfigCache());
  afterEach(() => resetQqConfigCache());

  it('flags .env and credential paths', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('config/.env.local')).toBe(true);
    expect(isSensitivePath('.credentials.json')).toBe(true);
    expect(isSensitivePath('src/index.ts')).toBe(false);
  });
});

describe('filterContextEnvelope', () => {
  beforeEach(() => resetQqConfigCache());
  afterEach(() => resetQqConfigCache());

  it('removes sensitive paths from git changedFiles', () => {
    const envelope: ContextEnvelope = {
      base: {
        queryText: 'git status',
        cwd: '/tmp',
        platform: 'darwin',
        shellName: 'zsh',
        shellPid: 1,
        ttyPath: '/dev/ttys001',
        timestamp: '2026-06-17T00:00:00.000Z',
      },
      extras: [
        {
          kind: 'git',
          payload: {
            cwd: '/tmp',
            root: '/tmp',
            branch: 'main',
            dirty: true,
            changedFiles: ['src/index.ts', '.env', 'secrets/credentials.json'],
          },
        },
      ],
    };

    const filtered = filterContextEnvelope(envelope);
    const gitChunk = filtered.extras.find((chunk) => chunk.kind === 'git');

    expect(gitChunk?.payload.changedFiles).toEqual(['src/index.ts']);
  });
});

describe('redactForLog', () => {
  beforeEach(() => resetQqConfigCache());
  afterEach(() => resetQqConfigCache());

  it('redacts lbuffer and rbuffer by default', () => {
    const redacted = redactForLog({
      lbuffer: 'rm -rf /',
      rbuffer: ' # note',
      cwd: '/tmp',
    }) as Record<string, unknown>;

    expect(redacted.lbuffer).toBe('[redacted:8chars]');
    expect(redacted.rbuffer).toBe('[redacted:7chars]');
    expect(redacted.cwd).toBe('/tmp');
  });
});

describe('isFileReadAllowed', () => {
  beforeEach(() => resetQqConfigCache());
  afterEach(() => resetQqConfigCache());

  it('defaults to false', () => {
    const previous = process.env.QQ_ALLOW_FILE_READ;
    delete process.env.QQ_ALLOW_FILE_READ;
    expect(isFileReadAllowed()).toBe(false);
    process.env.QQ_ALLOW_FILE_READ = previous;
  });
});

describe('isDestructiveCommand', () => {
  beforeEach(() => resetQqConfigCache());
  afterEach(() => resetQqConfigCache());

  it('flags destructive patterns', () => {
    expect(isDestructiveCommand('rm -rf /tmp/foo')).toBe(true);
    expect(isDestructiveCommand('rm -r /tmp/foo')).toBe(true);
    expect(isDestructiveCommand('rm foo.txt')).toBe(true);
    expect(isDestructiveCommand('git status')).toBe(false);
  });
});
