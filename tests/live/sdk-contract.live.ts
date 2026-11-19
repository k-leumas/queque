/**
 * Live SDK contract check (phase 10, D-01 to D-03).
 *
 * Runs in the nightly `live` job (`pnpm test:live tests/live/sdk-contract.live.ts`,
 * vitest.live.config.ts) with the ANTHROPIC_API_KEY repository secret; that job runs only this
 * file. The Claude Code CLI path has its own real-model test, cli-contract.live.ts, in the
 * `live-cli` job. The default suite never picks it up: its include is `tests/**\/*.test.ts` and
 * this file is `*.live.ts`. Nothing is stubbed: the real built daemon (`dist/cli/main.js daemon`,
 * started by live-daemon.ts) answers one real `fetch-candidates` request over its socket, on the
 * default Claude provider with the SDK-first rule (a usable key means the SDK path).
 *
 * D-02: only the contract is asserted (schemas, latency ceilings, no failure lines in the
 * daemon debug log). Command text is model output and is never compared. The key is never
 * printed: it only reaches the daemon through its environment.
 */
import * as fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  expectLiveContract,
  fetchLive,
  type LiveDaemon,
  mainJs,
  settledDebugLog,
  startLiveDaemon,
  stopLiveDaemon,
} from './live-daemon.js';

const FAILURE_LINES = ['request failed', 'response truncated'] as const;

const socketPath = `/tmp/qq-live-${process.pid}.sock`;

let daemon: LiveDaemon | null = null;

describe('live SDK contract (nightly only)', () => {
  beforeAll(async () => {
    // A failure, never a skip: a nightly run without the secret must turn red (D-01).
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      throw new Error('ANTHROPIC_API_KEY is required for the live contract job');
    }
    if (!fs.existsSync(mainJs)) {
      throw new Error(`run pnpm build first (${mainJs} is missing)`);
    }

    daemon = await startLiveDaemon({ socketPath });
  });

  afterAll(async () => {
    await stopLiveDaemon(daemon);
    daemon = null;
  });

  it('streams schema-valid candidates within the latency ceilings, with no failure lines', async () => {
    if (!daemon) throw new Error('the live daemon did not start');
    const exchange = await fetchLive(daemon.socketPath, buildEnvelope(daemon.home));

    expectLiveContract(exchange);

    const log = await settledDebugLog(daemon.debugLogFile, 'sdk path');
    // Booleans only: the log is never echoed into the job output (T-10-29).
    // The run went through the SDK path, not `claude -p`.
    expect(log.includes('sdk path'), 'daemon debug log has the "sdk path" line').toBe(true);
    for (const line of FAILURE_LINES) {
      expect(log.includes(line), `daemon debug log has "${line}"`).toBe(false);
    }
  });
});
