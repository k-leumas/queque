/**
 * Shared harness for the nightly live contract tests (phase 10 D-01 to D-03, quick 261118-v58).
 *
 * Not a `*.live.ts` or `*.test.ts` file, so neither vitest config collects it on its own. It
 * starts the real built daemon (`dist/cli/main.js daemon`) under a temp HOME, sends one real
 * streamed `fetch-candidates` request over its socket and asserts the contract only (schemas,
 * latency ceilings). Command text is model output and is never compared. Nothing is stubbed.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect } from 'vitest';
import { candidateListSchema, commandCandidateSchema } from '../../src/contracts/candidates.js';
import { ipcResponseSchema } from '../../src/contracts/ipc.js';
import { type ContextEnvelope, contextEnvelopeSchema } from '../../src/contracts/request.js';

/** Ceiling from the request write to the first streamed row (or the final list). */
export const LIVE_FIRST_CANDIDATE_MS = 15_000;
/** Ceiling from the request write to the final list: the provider budget in claude-default.ts. */
export const LIVE_FINAL_MS = 25_000;
const SOCKET_READY_MS = 5_000;
const SHUTDOWN_WAIT_MS = 2_000;
/** A reply wait past the final ceiling, so a hung daemon fails with a message, not a timeout. */
const REPLY_WAIT_MS = LIVE_FINAL_MS + 10_000;
const DEBUG_LOG_WAIT_MS = 1_000;
const STDERR_TAIL_CHARS = 4_000;

const QUERY_TEXT = 'list files by size';

const repoRoot = resolve(import.meta.dirname, '../..');
/** The built CLI entry the daemon runs from. */
export const mainJs = join(repoRoot, 'dist/cli/main.js');

export type RawMessage = { kind: string; [key: string]: unknown };

export type LiveExchange = {
  messages: RawMessage[];
  firstMs: number | null;
  finalMs: number | null;
};

export type LiveDaemon = {
  home: string;
  socketPath: string;
  debugLogFile: string;
  child: ChildProcess;
  /** The last few thousand characters the daemon wrote to stderr. */
  stderrTail: () => string;
};

export type StartLiveDaemonOptions = {
  socketPath: string;
  /** Overrides applied on top of the default env. `undefined` deletes the key. */
  env?: Record<string, string | undefined>;
  /** Runs after the temp HOME exists and before the daemon starts. */
  prepareHome?: (home: string) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

function canConnect(path: string): Promise<boolean> {
  return new Promise((done) => {
    const client = net.createConnection(path);
    client.once('connect', () => {
      client.destroy();
      done(true);
    });
    client.once('error', () => done(false));
  });
}

async function waitForSocket(
  child: ChildProcess,
  path: string,
  timeoutMs: number,
  stderrTail: () => string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `daemon exited with code ${child.exitCode} before its socket was ready: ${stderrTail()}`,
      );
    }
    if (await canConnect(path)) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`daemon socket ${path} did not accept a connection within ${timeoutMs} ms`);
}

export function buildEnvelope(cwd: string): ContextEnvelope {
  return contextEnvelopeSchema.parse({
    base: {
      queryText: QUERY_TEXT,
      cwd,
      ttyPath: '/dev/null',
      shellPid: process.pid,
      shellName: 'zsh',
      platform: process.platform,
      timestamp: new Date().toISOString(),
    },
    extras: [],
  });
}

/**
 * Sends one streamed `fetch-candidates` request and collects every reply line until the final
 * `candidates` (or a `fetch-error`). Each line must parse with `ipcResponseSchema`; a line that
 * does not is a contract failure and rejects. Times are measured from the request write.
 */
export function fetchLive(path: string, envelope: ContextEnvelope): Promise<LiveExchange> {
  return new Promise((done, fail) => {
    const exchange: LiveExchange = { messages: [], firstMs: null, finalMs: null };
    let buffer = '';
    let startedAt = 0;
    let settled = false;
    const client = net.createConnection(path);

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (error) {
        fail(error);
      } else {
        done(exchange);
      }
    };

    const timer = setTimeout(() => {
      finish(new Error(`no final candidates or fetch-error within ${REPLY_WAIT_MS} ms`));
    }, REPLY_WAIT_MS);

    client.setEncoding('utf8');
    client.once('connect', () => {
      startedAt = performance.now();
      client.write(`${JSON.stringify({ kind: 'fetch-candidates', envelope, stream: true })}\n`);
    });
    client.on('data', (chunk) => {
      buffer += String(chunk);
      let newline = buffer.indexOf('\n');
      while (newline !== -1 && !settled) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        let raw: RawMessage;
        try {
          raw = JSON.parse(line) as RawMessage;
          ipcResponseSchema.parse(raw);
        } catch (error) {
          finish(new Error(`daemon reply is not a valid IPC response: ${String(error)}`));
          return;
        }
        const elapsed = performance.now() - startedAt;
        exchange.messages.push(raw);
        if (raw.kind === 'candidate' && exchange.firstMs === null) {
          exchange.firstMs = elapsed;
        }
        if (raw.kind === 'candidates') {
          exchange.firstMs ??= elapsed;
          exchange.finalMs = elapsed;
          finish();
          return;
        }
        if (raw.kind === 'fetch-error') {
          finish();
          return;
        }
      }
    });
    client.on('error', (error) => finish(error));
    client.on('close', () => finish(new Error('daemon closed the socket before the final list')));
  });
}

export function readDebugLog(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The daemon appends its debug lines without awaiting them: wait for `marker` in the part of the
 * log written after `fromOffset`, then return that part.
 */
export async function settledDebugLog(
  file: string,
  marker: string,
  fromOffset = 0,
): Promise<string> {
  const deadline = Date.now() + DEBUG_LOG_WAIT_MS;
  let log = readDebugLog(file).slice(fromOffset);
  while (!log.includes(marker) && Date.now() < deadline) {
    await sleep(50);
    log = readDebugLog(file).slice(fromOffset);
  }
  await sleep(100);
  return readDebugLog(file).slice(fromOffset);
}

function sendShutdown(path: string): Promise<void> {
  return new Promise((done) => {
    const client = net.createConnection(path);
    const timer = setTimeout(() => {
      client.destroy();
      done();
    }, SHUTDOWN_WAIT_MS);
    client.once('connect', () => {
      client.write(`${JSON.stringify({ kind: 'shutdown' })}\n`);
    });
    client.once('data', () => {
      clearTimeout(timer);
      client.destroy();
      done();
    });
    client.once('error', () => {
      clearTimeout(timer);
      done();
    });
  });
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((done) => {
    const timer = setTimeout(() => done(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      done(true);
    });
  });
}

/**
 * Starts the built daemon under a fresh temp HOME. Absent config and provider files mean the
 * default Claude provider and the SDK-first rule apply; the temp HOME keeps the developer's own
 * config and env files out of the run.
 */
export async function startLiveDaemon(options: StartLiveDaemonOptions): Promise<LiveDaemon> {
  const home = fs.mkdtempSync(join(tmpdir(), 'qq-live-'));
  const debugLogFile = join(home, 'qq-debug.log');
  const { socketPath } = options;
  let child: ChildProcess | null = null;
  let stderr = '';
  const stderrTail = (): string => stderr;

  try {
    fs.rmSync(socketPath, { force: true });
    options.prepareHome?.(home);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      QQ_CONFIG_FILE: join(home, 'config.json'),
      QQ_PROVIDER_FILE: join(home, 'provider.json'),
      QQ_DEBUG_LOG_FILE: debugLogFile,
      QQ_TELEMETRY: '0',
    };
    for (const [key, value] of Object.entries(options.env ?? {})) {
      if (value === undefined) {
        delete env[key];
      } else {
        env[key] = value;
      }
    }

    child = spawn(process.execPath, [mainJs, 'daemon', '--socket', socketPath], {
      cwd: home,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-STDERR_TAIL_CHARS);
    });

    await waitForSocket(child, socketPath, SOCKET_READY_MS, stderrTail);
    return { home, socketPath, debugLogFile, child, stderrTail };
  } catch (error) {
    // The caller never gets a handle to stop, so clean up here.
    child?.kill('SIGKILL');
    fs.rmSync(socketPath, { force: true });
    fs.rmSync(home, { recursive: true, force: true });
    throw error;
  }
}

/** Shuts the daemon down (SIGKILL as a fallback) and removes its socket and temp HOME. */
export async function stopLiveDaemon(daemon: LiveDaemon | null): Promise<void> {
  if (!daemon) return;
  await sendShutdown(daemon.socketPath);
  if (!(await waitForExit(daemon.child, SHUTDOWN_WAIT_MS))) {
    daemon.child.kill('SIGKILL');
    await waitForExit(daemon.child, SHUTDOWN_WAIT_MS);
  }
  fs.rmSync(daemon.socketPath, { force: true });
  fs.rmSync(daemon.home, { recursive: true, force: true });
}

/**
 * The shared contract: no fetch-error, every streamed row and the final list are schema-valid
 * (at least one row), and both latency ceilings hold.
 */
export function expectLiveContract(exchange: LiveExchange): void {
  const errors = exchange.messages.filter((message) => message.kind === 'fetch-error');
  expect(errors).toEqual([]);

  const rows = exchange.messages.filter((message) => message.kind === 'candidate');
  for (const row of rows) {
    expect(commandCandidateSchema.safeParse(row.candidate).success).toBe(true);
  }

  const final = exchange.messages.find((message) => message.kind === 'candidates');
  expect(final).toBeDefined();
  const list = candidateListSchema.safeParse(final?.candidates);
  expect(list.success).toBe(true);
  expect(list.data?.length ?? 0).toBeGreaterThanOrEqual(1);

  expect(exchange.firstMs).not.toBeNull();
  expect(exchange.finalMs).not.toBeNull();
  expect(exchange.firstMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(LIVE_FIRST_CANDIDATE_MS);
  expect(exchange.finalMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(LIVE_FINAL_MS);
}
