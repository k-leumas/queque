import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadQqConfig, resetQqConfigCache } from '../src/shared/qq-config.js';
import {
  effectiveTelemetry,
  markTelemetryAsked,
  readTelemetryState,
  setTelemetryEnabled,
  TELEMETRY_BLOCK_REASONS,
  TelemetryConfigWriteError,
  telemetryBlockedBy,
} from '../src/shared/telemetry-config.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let dir: string;
let configFile: string;

const SEEDED = {
  effort: 'medium',
  privacy: { sensitivePathPatterns: ['customer-data'], redactLogKeys: ['token'] },
  safety: { destructiveCommandPatterns: ['\\bterraform destroy\\b'] },
};

function seed(content: unknown): void {
  writeFileSync(configFile, typeof content === 'string' ? content : JSON.stringify(content));
}

function readJson(): Record<string, unknown> {
  return JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qq-telemetry-'));
  configFile = join(dir, 'config.json');
  vi.stubEnv('QQ_CONFIG_FILE', configFile);
  resetQqConfigCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetQqConfigCache();
  rmSync(dir, { recursive: true, force: true });
});

describe('telemetryBlockedBy (D-09 env gates)', () => {
  it('lists the three block reasons', () => {
    expect(TELEMETRY_BLOCK_REASONS).toEqual(['DO_NOT_TRACK', 'QQ_TELEMETRY', 'CI']);
  });

  it('is null with no gate set', () => {
    expect(telemetryBlockedBy({})).toBeNull();
  });

  it('blocks on DO_NOT_TRACK set to anything but 0, false or empty', () => {
    expect(telemetryBlockedBy({ DO_NOT_TRACK: '1' })).toBe('DO_NOT_TRACK');
    expect(telemetryBlockedBy({ DO_NOT_TRACK: 'true' })).toBe('DO_NOT_TRACK');
    expect(telemetryBlockedBy({ DO_NOT_TRACK: 'yes' })).toBe('DO_NOT_TRACK');
    for (const value of ['0', 'false', 'FALSE', '', '  ']) {
      expect(telemetryBlockedBy({ DO_NOT_TRACK: value })).toBeNull();
    }
  });

  it('blocks on QQ_TELEMETRY 0, false or off in any case', () => {
    for (const value of ['0', 'false', 'off', 'OFF', 'False', ' off ']) {
      expect(telemetryBlockedBy({ QQ_TELEMETRY: value })).toBe('QQ_TELEMETRY');
    }
    for (const value of ['1', 'on', 'true', '']) {
      expect(telemetryBlockedBy({ QQ_TELEMETRY: value })).toBeNull();
    }
  });

  it('blocks on CI set and not 0/false', () => {
    expect(telemetryBlockedBy({ CI: 'true' })).toBe('CI');
    expect(telemetryBlockedBy({ CI: '1' })).toBe('CI');
    for (const value of ['', '0', 'false']) {
      expect(telemetryBlockedBy({ CI: value })).toBeNull();
    }
  });

  it('reports DO_NOT_TRACK first when several gates are set', () => {
    expect(telemetryBlockedBy({ CI: 'true', QQ_TELEMETRY: 'off', DO_NOT_TRACK: '1' })).toBe(
      'DO_NOT_TRACK',
    );
    expect(telemetryBlockedBy({ CI: 'true', QQ_TELEMETRY: 'off' })).toBe('QQ_TELEMETRY');
  });

  it('reads process.env by default', () => {
    vi.stubEnv('DO_NOT_TRACK', '');
    vi.stubEnv('QQ_TELEMETRY', '');
    vi.stubEnv('CI', 'true');
    expect(telemetryBlockedBy()).toBe('CI');
  });
});

describe('readTelemetryState (uncached)', () => {
  it('returns the defaults for a missing file', () => {
    expect(readTelemetryState()).toEqual({ enabled: false, asked: false });
  });

  it('returns the defaults for invalid JSON or an invalid block', () => {
    seed('{ not json');
    expect(readTelemetryState()).toEqual({ enabled: false, asked: false });
    seed({ telemetry: { enabled: 'yes' } });
    expect(readTelemetryState()).toEqual({ enabled: false, asked: false });
    seed({ telemetry: { enabled: true, asked: true, installId: 'laptop.local' } });
    expect(readTelemetryState()).toEqual({ enabled: false, asked: false });
  });

  it('sees a change another process wrote on the next call', () => {
    seed({ telemetry: { enabled: false, asked: true } });
    expect(readTelemetryState()).toEqual({ enabled: false, asked: true });
    const installId = '6f1c1a52-6a4b-4c43-9a43-0b6f5c2f8d11';
    seed({ telemetry: { enabled: true, asked: true, installId } });
    expect(readTelemetryState()).toEqual({ enabled: true, asked: true, installId });
  });

  it('accepts an explicit path', () => {
    const other = join(dir, 'other.json');
    writeFileSync(other, JSON.stringify({ telemetry: { asked: true } }));
    expect(readTelemetryState(other)).toEqual({ enabled: false, asked: true });
  });
});

describe('setTelemetryEnabled', () => {
  it('enabling sets enabled, asked and a random UUID v4 install id', () => {
    const state = setTelemetryEnabled(true);
    expect(state.enabled).toBe(true);
    expect(state.asked).toBe(true);
    expect(state.installId).toMatch(UUID_V4);
    expect(readTelemetryState()).toEqual(state);
  });

  it('keeps the privacy, safety and effort keys unchanged', () => {
    seed(SEEDED);
    setTelemetryEnabled(true);
    const written = readJson();
    expect(written.effort).toEqual(SEEDED.effort);
    expect(written.privacy).toEqual(SEEDED.privacy);
    expect(written.safety).toEqual(SEEDED.safety);
    setTelemetryEnabled(false);
    const after = readJson();
    expect(after.privacy).toEqual(SEEDED.privacy);
    expect(after.safety).toEqual(SEEDED.safety);
    expect(after.effort).toEqual(SEEDED.effort);
  });

  it('keeps keys QueQue does not know about', () => {
    seed({ ...SEEDED, futureKey: { nested: [1, 2] } });
    setTelemetryEnabled(true);
    expect(readJson().futureKey).toEqual({ nested: [1, 2] });
  });

  it('writes the file 0600 and creates a new directory 0700', () => {
    const nested = join(dir, 'new', 'qq', 'config.json');
    setTelemetryEnabled(true, nested);
    expect(statSync(nested).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'new', 'qq')).mode & 0o777).toBe(0o700);
    expect(readTelemetryState(nested).enabled).toBe(true);
  });

  it('leaves no temp file behind', async () => {
    seed(SEEDED);
    setTelemetryEnabled(true);
    const { readdirSync } = await import('node:fs');
    expect(readdirSync(dir)).toEqual(['config.json']);
  });

  it('disabling drops the install id (D-06)', () => {
    setTelemetryEnabled(true);
    const state = setTelemetryEnabled(false);
    expect(state).toEqual({ enabled: false, asked: true });
    expect(readJson().telemetry).toEqual({ enabled: false, asked: true });
  });

  it('enabling again yields a different UUID', () => {
    const first = setTelemetryEnabled(true).installId;
    setTelemetryEnabled(false);
    const second = setTelemetryEnabled(true).installId;
    expect(second).toMatch(UUID_V4);
    expect(second).not.toBe(first);
  });

  it('enabling while already enabled keeps the install id', () => {
    const first = setTelemetryEnabled(true).installId;
    expect(setTelemetryEnabled(true).installId).toBe(first);
  });
});

describe('markTelemetryAsked', () => {
  it('a no answer records asked without enabling or an install id', () => {
    const state = markTelemetryAsked(false);
    expect(state).toEqual({ enabled: false, asked: true });
    expect(readJson().telemetry).toEqual({ enabled: false, asked: true });
  });

  it('a yes answer enables with an install id', () => {
    const state = markTelemetryAsked(true);
    expect(state.enabled).toBe(true);
    expect(state.asked).toBe(true);
    expect(state.installId).toMatch(UUID_V4);
  });
});

describe('invalid config file', () => {
  const writers: [string, () => unknown][] = [
    ['setTelemetryEnabled(true)', () => setTelemetryEnabled(true)],
    ['setTelemetryEnabled(false)', () => setTelemetryEnabled(false)],
    ['markTelemetryAsked(true)', () => markTelemetryAsked(true)],
    ['markTelemetryAsked(false)', () => markTelemetryAsked(false)],
  ];

  it.each(writers)('%s throws and leaves invalid JSON untouched', (_name, write) => {
    const bytes = '{ "privacy": { "sensitivePathPatterns": ["x"] }, oops';
    seed(bytes);
    expect(write).toThrow(TelemetryConfigWriteError);
    expect(readFileSync(configFile, 'utf8')).toBe(bytes);
  });

  it.each(writers)('%s throws on a JSON value that is not an object', (_name, write) => {
    seed('["privacy"]');
    expect(write).toThrow(TelemetryConfigWriteError);
    expect(readFileSync(configFile, 'utf8')).toBe('["privacy"]');
  });

  it('names the path in the error', () => {
    seed('nope');
    expect(() => setTelemetryEnabled(true)).toThrow(configFile);
  });
});

describe('qq-config keeps the rest of the file when the telemetry block is malformed', () => {
  it('loadQqConfig still applies the seeded privacy patterns', () => {
    seed({ ...SEEDED, telemetry: { enabled: 'yes' } });
    resetQqConfigCache();
    const config = loadQqConfig();
    expect(config.sensitivePathRegexes.some((regex) => regex.source === 'customer-data')).toBe(
      true,
    );
    expect(config.redactLogKeys.has('token')).toBe(true);
    expect(config.effort).toBe('medium');
  });
});

describe('effectiveTelemetry', () => {
  it('is off with the gate as reason when blocked, even when enabled', () => {
    setTelemetryEnabled(true);
    expect(effectiveTelemetry({ CI: 'true' })).toEqual({ on: false, reason: 'CI' });
    expect(effectiveTelemetry({ DO_NOT_TRACK: '1' })).toEqual({
      on: false,
      reason: 'DO_NOT_TRACK',
    });
    expect(effectiveTelemetry({ QQ_TELEMETRY: 'off' })).toEqual({
      on: false,
      reason: 'QQ_TELEMETRY',
    });
  });

  it('is off as disabled when not enabled or with no install id', () => {
    expect(effectiveTelemetry({})).toEqual({ on: false, reason: 'disabled' });
    markTelemetryAsked(false);
    expect(effectiveTelemetry({})).toEqual({ on: false, reason: 'disabled' });
    seed({ telemetry: { enabled: true, asked: true } });
    expect(effectiveTelemetry({})).toEqual({ on: false, reason: 'disabled' });
  });

  it('is on with the install id when enabled and not blocked', () => {
    const { installId } = setTelemetryEnabled(true);
    expect(effectiveTelemetry({})).toEqual({ on: true, installId });
  });

  it('sees `qq telemetry off` from another process without a restart', () => {
    setTelemetryEnabled(true);
    expect(effectiveTelemetry({}).on).toBe(true);
    seed({ telemetry: { enabled: false, asked: true } });
    expect(effectiveTelemetry({}).on).toBe(false);
  });
});
