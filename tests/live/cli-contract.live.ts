/**
 * Live Claude Code CLI contract check (quick 261118-v58). Runs in the nightly `live-cli` job
 * (`pnpm test:live tests/live/cli-contract.live.ts`) against the real `claude` binary, the
 * latest @anthropic-ai/claude-code from npm, so drift in Claude Code's stream-json events or
 * flags turns the nightly red. Without it only tests/fixtures/fake-claude-stream.mjs exercises
 * claude-cli.ts, claude-prewarm.ts and stream-json.ts.
 *
 * Provider pin finding: qq has no setting that forces `claude -p` while an API key is usable. A
 * `{"provider":"claude"}` provider.json pin resolves to the same SDK-first composite, and
 * claudeCliAdapter is unregistered. The product's own rule is the only route: no usable
 * ANTHROPIC_API_KEY means `claude -p`, exactly the situation of a `/login` user. So the key is
 * hidden from the daemon env, and Claude Code authenticates the way it supports, through an
 * `apiKeyHelper` in the temp-HOME user settings. No product backdoor exists for this test.
 *
 * Contract only (D-02): schemas, latency ceilings, the CLI path markers and no failure lines in
 * the daemon debug log. Command text is model output and is never compared. The key is never
 * printed and never written to disk: the helper is `printenv`, reading it from the env.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  expectLiveContract,
  fetchLive,
  type LiveDaemon,
  mainJs,
  readDebugLog,
  settledDebugLog,
  startLiveDaemon,
  stopLiveDaemon,
} from './live-daemon.js';

const CLI_FAILURE_LINES = [
  'response truncated',
  'claude-cli path',
  'cli timed out',
  'cli init timed out',
  'prewarm retry cold',
  'prewarm spawn failed',
  'prewarm error',
] as const;

const CLAUDE_VERSION_TIMEOUT_MS = 15_000;
const KEY_ENV = 'LIVE_CLAUDE_CLI_API_KEY';

/** Distinct from the SDK file's socket, so an unfiltered `pnpm test:live` can run both. */
const socketPath = `/tmp/qq-live-cli-${process.pid}.sock`;

let daemon: LiveDaemon | null = null;

/** Claude Code user settings: the key comes from the daemon's env, never from this file. */
function writeApiKeyHelper(home: string): void {
  const claudeDir = join(home, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    join(claudeDir, 'settings.json'),
    `${JSON.stringify({ apiKeyHelper: `printenv ${KEY_ENV}` })}\n`,
    { mode: 0o600 },
  );
}

function expectNoCliFailureLines(slice: string): void {
  for (const line of CLI_FAILURE_LINES) {
    expect(slice.includes(line), `daemon debug log has "${line}"`).toBe(false);
  }
}

describe('live Claude Code CLI contract (nightly only)', () => {
  beforeAll(async () => {
    // Failures, never skips: a nightly run without the secret, the CLI or the build turns red.
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required for the live CLI contract job');
    }
    const version = spawnSync('claude', ['--version'], {
      encoding: 'utf8',
      timeout: CLAUDE_VERSION_TIMEOUT_MS,
    });
    if (version.error || version.status !== 0) {
      const reason = version.error
        ? `error ${(version.error as NodeJS.ErrnoException).code ?? version.error.message}`
        : `exit status ${version.status}`;
      throw new Error(
        `the Claude Code CLI (claude) is required on PATH for the live CLI contract job ` +
          `(claude --version: ${reason}); install it with npm i -g @anthropic-ai/claude-code`,
      );
    }
    if (!fs.existsSync(mainJs)) {
      throw new Error(`run pnpm build first (${mainJs} is missing)`);
    }

    daemon = await startLiveDaemon({
      socketPath,
      prepareHome: writeApiKeyHelper,
      env: {
        // No key for qq: lookupApiKey finds nothing and the `claude -p` path runs.
        ANTHROPIC_API_KEY: undefined,
        // Both outrank apiKeyHelper in Claude Code, so a local token cannot win.
        ANTHROPIC_AUTH_TOKEN: undefined,
        CLAUDE_CODE_OAUTH_TOKEN: undefined,
        [KEY_ENV]: key,
      },
    });
  });

  afterAll(async () => {
    await stopLiveDaemon(daemon);
    daemon = null;
  });

  it('streams schema-valid candidates from a cold claude -p turn within the ceilings', async () => {
    if (!daemon) throw new Error('the live daemon did not start');
    const offset = readDebugLog(daemon.debugLogFile).length;

    const exchange = await fetchLive(daemon.socketPath, buildEnvelope(daemon.home));
    expectLiveContract(exchange);

    const slice = await settledDebugLog(daemon.debugLogFile, 'cli result', offset);
    // Booleans only: the log is never echoed into the job output (T-10-29).
    expect(slice.includes('cli result'), 'daemon debug log has the "cli result" line').toBe(true);
    // The run went through `claude -p`, not the SDK path.
    expect(
      readDebugLog(daemon.debugLogFile).includes('sdk path'),
      'daemon debug log has the "sdk path" line',
    ).toBe(false);
    expectNoCliFailureLines(slice);
  });
});
