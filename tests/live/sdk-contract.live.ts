/**
 * Live SDK contract check (phase 10, D-01 to D-03). The ONLY test that calls a real model.
 *
 * Runs in the nightly `live` job (`pnpm test:live`, vitest.live.config.ts) with the
 * ANTHROPIC_API_KEY repository secret. The default suite never picks it up: its include is
 * `tests/**\/*.test.ts` and this file is `*.live.ts`. Nothing is stubbed: the real built daemon
 * (`dist/cli/main.js daemon`) answers one real `fetch-candidates` request over its socket, on
 * the default Claude provider with the SDK-first rule (a usable key means the SDK path).
 *
 * D-02: only the contract is asserted (schemas, latency ceilings, no failure lines in the
 * daemon debug log). Command text is model output and is never compared. The key is never
 * printed: it only reaches the daemon through its environment.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { candidateListSchema, commandCandidateSchema } from '../../src/contracts/candidates.js';
import { ipcResponseSchema } from '../../src/contracts/ipc.js';
import { type ContextEnvelope, contextEnvelopeSchema } from '../../src/contracts/request.js';

/** Ceiling from the request write to the first streamed row (or the final list). */
const LIVE_FIRST_CANDIDATE_MS = 15_000;
/** Ceiling from the request write to the final list: the provider budget in claude-default.ts. */
const LIVE_FINAL_MS = 25_000;
const SOCKET_READY_MS = 5_000;
const SHUTDOWN_WAIT_MS = 2_000;
/** A reply wait past the final ceiling, so a hung daemon fails with a message, not a timeout. */
const REPLY_WAIT_MS = LIVE_FINAL_MS + 10_000;
const DEBUG_LOG_WAIT_MS = 1_000;

const QUERY_TEXT = 'list files by size';
const FAILURE_LINES = ['request failed', 'response truncated'] as const;

const repoRoot = resolve(import.meta.dirname, '../..');
const mainJs = join(repoRoot, 'dist/cli/main.js');
const socketPath = `/tmp/qq-live-${process.pid}.sock`;

type RawMessage = { kind: string; [key: string]: unknown };

type LiveExchange = {
  messages: RawMessage[];
  firstMs: number | null;
  finalMs: number | null;
};

let tempHome: string | null = null;
let debugLogFile = '';
let daemon: ChildProcess | null = null;
let daemonStderr = '';

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

async function waitForSocket(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (daemon?.exitCode !== null && daemon?.exitCode !== undefined) {
      throw new Error(
        `daemon exited with code ${daemon.exitCode} before its socket was ready: ${daemonStderr}`,
      );
    }
    if (await canConnect(path)) {
      return;
    }
    await sleep(100);
  }
  throw new Error(`daemon socket ${path} did not accept a connection within ${timeoutMs} ms`);
}

function buildEnvelope(cwd: string): ContextEnvelope {
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
function fetchLive(path: string, envelope: ContextEnvelope): Promise<LiveExchange> {
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

function readDebugLog(): string {
  try {
    return fs.readFileSync(debugLogFile, 'utf8');
  } catch {
    return '';
  }
}

/** The daemon appends its debug lines without awaiting them; wait for the SDK path line. */
async function settledDebugLog(): Promise<string> {
  const deadline = Date.now() + DEBUG_LOG_WAIT_MS;
  let log = readDebugLog();
  while (!log.includes('sdk path') && Date.now() < deadline) {
    await sleep(50);
    log = readDebugLog();
  }
  await sleep(100);
  return readDebugLog();
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

describe('live SDK contract (nightly only)', () => {
  beforeAll(async () => {
    // A failure, never a skip: a nightly run without the secret must turn red (D-01).
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      throw new Error('ANTHROPIC_API_KEY is required for the live contract job');
    }
    if (!fs.existsSync(mainJs)) {
      throw new Error(`run pnpm build first (${mainJs} is missing)`);
    }

    tempHome = fs.mkdtempSync(join(tmpdir(), 'qq-live-'));
    debugLogFile = join(tempHome, 'qq-debug.log');
    fs.rmSync(socketPath, { force: true });

    // Absent config and provider files: the default Claude provider and the SDK-first rule
    // apply. A temp HOME keeps the developer's own config and env files out of the run.
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: tempHome,
      QQ_CONFIG_FILE: join(tempHome, 'config.json'),
      QQ_PROVIDER_FILE: join(tempHome, 'provider.json'),
      QQ_DEBUG_LOG_FILE: debugLogFile,
      QQ_TELEMETRY: '0',
    };

    daemon = spawn(process.execPath, [mainJs, 'daemon', '--socket', socketPath], {
      cwd: tempHome,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    daemon.stderr?.setEncoding('utf8');
    daemon.stderr?.on('data', (chunk) => {
      daemonStderr = `${daemonStderr}${String(chunk)}`.slice(-4_000);
    });

    await waitForSocket(socketPath, SOCKET_READY_MS);
  });

  afterAll(async () => {
    if (daemon) {
      await sendShutdown(socketPath);
      if (!(await waitForExit(daemon, SHUTDOWN_WAIT_MS))) {
        daemon.kill('SIGKILL');
        await waitForExit(daemon, SHUTDOWN_WAIT_MS);
      }
      daemon = null;
    }
    fs.rmSync(socketPath, { force: true });
    if (tempHome) {
      fs.rmSync(tempHome, { recursive: true, force: true });
      tempHome = null;
    }
  });

  it('streams schema-valid candidates within the latency ceilings, with no failure lines', async () => {
    const cwd = tempHome ?? tmpdir();
    const exchange = await fetchLive(socketPath, buildEnvelope(cwd));

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
    expect(exchange.firstMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      LIVE_FIRST_CANDIDATE_MS,
    );
    expect(exchange.finalMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(LIVE_FINAL_MS);

    const log = await settledDebugLog();
    // Booleans only: the log is never echoed into the job output (T-10-29).
    // The run went through the SDK path, not `claude -p`.
    expect(log.includes('sdk path'), 'daemon debug log has the "sdk path" line').toBe(true);
    for (const line of FAILURE_LINES) {
      expect(log.includes(line), `daemon debug log has "${line}"`).toBe(false);
    }
  });
});
