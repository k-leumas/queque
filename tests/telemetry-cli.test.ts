import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requestDaemonOnce,
  type TelemetryCliDeps,
  telemetryCommand,
} from '../src/cli/commands/telemetry.js';
import type { IpcRequest, IpcResponse } from '../src/contracts/ipc.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let dir: string;
let configPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qq-tel-cli-'));
  configPath = join(dir, 'config.json');
  // Belt and braces: anything that falls back to defaultConfigPath() stays in the temp dir.
  vi.stubEnv('QQ_CONFIG_FILE', configPath);
});

afterEach(() => {
  process.exitCode = undefined;
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

interface Harness {
  deps: TelemetryCliDeps;
  stdout(): string;
  stderr(): string;
  lines(): string[];
  requests: IpcRequest[];
}

function harness(
  overrides: Partial<TelemetryCliDeps> = {},
  reply: IpcResponse | null = null,
): Harness {
  const out: string[] = [];
  const err: string[] = [];
  const requests: IpcRequest[] = [];
  const deps: TelemetryCliDeps = {
    env: {},
    configPath,
    socketPath: '/tmp/qq-tel-cli-unused.sock',
    endpoint: () => null,
    requestDaemon: async (request) => {
      requests.push(request);
      return reply;
    },
    out: (text) => {
      out.push(text);
    },
    err: (text) => {
      err.push(text);
    },
    ...overrides,
  };
  return {
    deps,
    stdout: () => out.join(''),
    stderr: () => err.join(''),
    lines: () => out.join('').split('\n'),
    requests,
  };
}

function readConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
}

function telemetryBlock(): { enabled?: boolean; asked?: boolean; installId?: string } {
  return readConfig().telemetry as { enabled?: boolean; asked?: boolean; installId?: string };
}

describe('qq telemetry status', () => {
  it('reports off, not asked, no project key and the endpoint host on a fresh config', async () => {
    const h = harness();
    await telemetryCommand('status', h.deps);
    expect(h.lines()).toContain('telemetry: off');
    expect(h.lines()).toContain('asked: no');
    expect(h.lines()).toContain('project key: absent in this build (nothing is sent)');
    expect(h.stdout()).toMatch(/^endpoint: \S+$/m);
    expect(h.stderr()).toBe('');
    expect(process.exitCode).toBeUndefined();
  });

  it('shows the endpoint host when the build has a project key', async () => {
    const h = harness({
      endpoint: () => ({ host: 'https://eu.i.posthog.com', key: 'phc_testkey' }),
    });
    await telemetryCommand('status', h.deps);
    expect(h.lines()).toContain('project key: present');
    expect(h.lines()).toContain('endpoint: eu.i.posthog.com');
  });

  it('runs status when no action is given', async () => {
    const h = harness();
    await telemetryCommand(undefined, h.deps);
    expect(h.lines()).toContain('telemetry: off');
    expect(h.lines()).toContain('asked: no');
  });

  it('names the blocking variable and says the config is overridden', async () => {
    const h = harness({ env: { CI: 'true' } });
    await telemetryCommand('on', h.deps);
    const status = harness({ env: { CI: 'true' } });
    await telemetryCommand('status', status.deps);
    expect(status.lines()).toContain('telemetry: off');
    expect(status.stdout()).toContain('reason: CI is set');
    expect(status.lines()).toContain('config: on');
  });
});

describe('qq telemetry on', () => {
  it('stores enabled, asked and a fresh random install id', async () => {
    const h = harness();
    await telemetryCommand('on', h.deps);
    const block = telemetryBlock();
    expect(block.enabled).toBe(true);
    expect(block.asked).toBe(true);
    expect(block.installId).toMatch(UUID);
    expect(h.lines()).toContain('telemetry: on');
    expect(process.exitCode).toBeUndefined();
  });

  it('then reports on and asked in status', async () => {
    await telemetryCommand('on', harness().deps);
    const status = harness();
    await telemetryCommand('status', status.deps);
    expect(status.lines()).toContain('telemetry: on');
    expect(status.lines()).toContain('asked: yes');
  });

  it('keeps every other config key', async () => {
    writeFileSync(configPath, `${JSON.stringify({ effort: 'medium', privacy: { x: 1 } })}\n`);
    await telemetryCommand('on', harness().deps);
    const config = readConfig();
    expect(config.effort).toBe('medium');
    expect(config.privacy).toEqual({ x: 1 });
  });

  it('notes DO_NOT_TRACK by name, and status then reports off with the reason', async () => {
    const h = harness({ env: { DO_NOT_TRACK: '1' } });
    await telemetryCommand('on', h.deps);
    expect(h.lines()).toContain('telemetry: on');
    expect(h.stdout()).toContain('DO_NOT_TRACK');
    expect(telemetryBlock().enabled).toBe(true);

    const status = harness({ env: { DO_NOT_TRACK: '1' } });
    await telemetryCommand('status', status.deps);
    expect(status.lines()).toContain('telemetry: off');
    expect(status.stdout()).toContain('reason: DO_NOT_TRACK is set');
  });

  it('notes that nothing is sent when the build has no project key', async () => {
    const h = harness();
    await telemetryCommand('on', h.deps);
    expect(h.stdout()).toContain('no project key');
  });

  it('refuses an invalid-JSON config on stderr, exits 1 and leaves the bytes unchanged', async () => {
    const broken = '{ "effort": "low", oops\n';
    writeFileSync(configPath, broken);
    const h = harness();
    await telemetryCommand('on', h.deps);
    expect(h.stderr()).toContain('not valid JSON');
    expect(process.exitCode).toBe(1);
    expect(readFileSync(configPath, 'utf8')).toBe(broken);
    expect(h.stdout()).not.toContain('telemetry: on');
  });
});

describe('qq telemetry off', () => {
  it('deletes the install id, disables, and resets the daemon buffer exactly once', async () => {
    await telemetryCommand('on', harness().deps);
    expect(telemetryBlock().installId).toMatch(UUID);

    const reply: IpcResponse = { kind: 'telemetry-buffer', pending: null, lastSent: null };
    const h = harness({}, reply);
    await telemetryCommand('off', h.deps);
    const block = telemetryBlock();
    expect(block.enabled).toBe(false);
    expect(block.asked).toBe(true);
    expect(block.installId).toBeUndefined();
    expect(h.requests).toEqual([{ kind: 'telemetry-reset' }]);
    expect(h.lines()).toContain('telemetry: off');
    expect(process.exitCode).toBeUndefined();
  });

  it('writes the config before it contacts the daemon', async () => {
    await telemetryCommand('on', harness().deps);
    let installIdAtReset: string | undefined = 'unset';
    const h = harness({
      requestDaemon: async () => {
        installIdAtReset = telemetryBlock().installId;
        return { kind: 'telemetry-buffer', pending: null, lastSent: null };
      },
    });
    await telemetryCommand('off', h.deps);
    expect(installIdAtReset).toBeUndefined();
  });

  it('is fine when no daemon is running', async () => {
    await telemetryCommand('on', harness().deps);
    const h = harness();
    await telemetryCommand('off', h.deps);
    expect(telemetryBlock().enabled).toBe(false);
    expect(h.requests).toEqual([{ kind: 'telemetry-reset' }]);
    expect(h.stderr()).toBe('');
    expect(process.exitCode).toBeUndefined();
  });

  it('refuses an invalid-JSON config, exits 1 and leaves the bytes unchanged', async () => {
    const broken = '[1, 2,';
    writeFileSync(configPath, broken);
    const h = harness();
    await telemetryCommand('off', h.deps);
    expect(h.stderr()).toContain('not valid JSON');
    expect(process.exitCode).toBe(1);
    expect(readFileSync(configPath, 'utf8')).toBe(broken);
  });
});

describe('qq telemetry show', () => {
  it('prints the pending body byte for byte and (none) for last sent', async () => {
    const pending =
      '{"api_key":"phc_x","batch":[{"event":"qq_error","properties":{"error_kind":"unknown"}}]}';
    const h = harness({}, { kind: 'telemetry-buffer', pending, lastSent: null });
    await telemetryCommand('show', h.deps);
    expect(h.requests).toEqual([{ kind: 'telemetry-show' }]);
    expect(h.stdout()).toBe(`pending:\n${pending}\nlast sent:\n(none)\n`);
  });

  it('prints both bodies when the daemon has sent a batch', async () => {
    const lastSent = '{"api_key":"phc_x","batch":[]}';
    const h = harness({}, { kind: 'telemetry-buffer', pending: null, lastSent });
    await telemetryCommand('show', h.deps);
    expect(h.stdout()).toBe(`pending:\n(none)\nlast sent:\n${lastSent}\n`);
  });

  it('says the daemon is not running when nothing answers', async () => {
    const h = harness();
    await telemetryCommand('show', h.deps);
    expect(h.stdout()).toBe('daemon not running: nothing buffered\n');
    expect(process.exitCode).toBeUndefined();
  });
});

describe('qq telemetry: unknown action', () => {
  it('prints usage on stderr and sets exit code 1', async () => {
    const h = harness();
    await telemetryCommand('frob', h.deps);
    expect(h.stderr()).toContain('unknown telemetry action');
    expect(h.stderr()).toContain('status');
    expect(h.stdout()).toBe('');
    expect(process.exitCode).toBe(1);
  });
});

describe('qq telemetry: no leaks (T-10-33)', () => {
  it('never prints the install id or an environment variable value', async () => {
    const env = {
      DO_NOT_TRACK: 'canary-dnt-value',
      QQ_TELEMETRY_KEY: 'phc_canarykeyvalue',
      HOME: '/home/canary-user',
    };
    const outputs: string[] = [];
    for (const action of ['on', 'status', undefined, 'show']) {
      const h = harness({ env });
      await telemetryCommand(action, h.deps);
      outputs.push(h.stdout(), h.stderr());
    }
    const installId = telemetryBlock().installId;
    expect(installId).toMatch(UUID);
    const off = harness({ env });
    await telemetryCommand('off', off.deps);
    outputs.push(off.stdout(), off.stderr());

    const all = outputs.join('\n');
    expect(all).toContain('DO_NOT_TRACK');
    expect(all).not.toContain(installId as string);
    expect(all).not.toContain('canary-dnt-value');
    expect(all).not.toContain('phc_canarykeyvalue');
    expect(all).not.toContain('/home/canary-user');
  });
});

describe('requestDaemonOnce (real socket)', () => {
  const sockets: string[] = [];
  const servers: net.Server[] = [];

  function uniqueSocket(): string {
    const path = `/tmp/qq-tel-cli-${process.pid}-${Math.random().toString(36).slice(2, 10)}.sock`;
    sockets.push(path);
    return path;
  }

  function listen(handler: (socket: net.Socket, line: string) => void): Promise<string> {
    const path = uniqueSocket();
    const server = net.createServer((socket) => {
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk.toString();
        const nl = buf.indexOf('\n');
        if (nl !== -1) {
          handler(socket, buf.slice(0, nl));
        }
      });
      socket.on('error', () => {});
    });
    servers.push(server);
    return new Promise((resolve) => server.listen(path, () => resolve(path)));
  }

  afterEach(async () => {
    await Promise.all(
      servers
        .splice(0)
        .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    for (const path of sockets.splice(0)) {
      try {
        unlinkSync(path);
      } catch {
        // already gone
      }
    }
  });

  it('sends one JSON line and returns the validated reply', async () => {
    const received: string[] = [];
    const path = await listen((socket, line) => {
      received.push(line);
      socket.write(
        `${JSON.stringify({ kind: 'telemetry-buffer', pending: 'p', lastSent: null })}\n`,
      );
    });
    const reply = await requestDaemonOnce(path, { kind: 'telemetry-show' });
    expect(received).toEqual(['{"kind":"telemetry-show"}']);
    expect(reply).toEqual({ kind: 'telemetry-buffer', pending: 'p', lastSent: null });
  });

  it('returns null when no daemon listens on the path', async () => {
    expect(await requestDaemonOnce(uniqueSocket(), { kind: 'telemetry-show' })).toBeNull();
  });

  it('returns null when the reply does not match the IPC schema', async () => {
    const path = await listen((socket) => {
      socket.write('{"kind":"telemetry-buffer","pending":7}\n');
    });
    expect(await requestDaemonOnce(path, { kind: 'telemetry-show' })).toBeNull();
  });

  it('returns null after the timeout when the daemon never answers', async () => {
    const path = await listen(() => {});
    const started = Date.now();
    expect(await requestDaemonOnce(path, { kind: 'telemetry-show' }, 100)).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
