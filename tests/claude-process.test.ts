import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ClaudeTurnFailure,
  type ClaudeTurnOptions,
  type ClaudeTurnStage,
  type ClaudeTurnStageDetail,
  runClaudeTurn,
} from '../src/providers/claude-process.js';
import { isAbortError } from '../src/providers/provider.js';

// Real child processes only: the fixture replays the recorded Claude Code 2.1.285
// stream-json event shapes (09.1-RESEARCH Probes 2, 3, 5 and 8). No timing thresholds:
// the tests assert stage order and content (bug-206).
const FIXTURE = fileURLToPath(new URL('./fixtures/fake-claude-stream.mjs', import.meta.url));
const PROMPT = 'show me how to use z3';
const SUCCESS_ANSWER = JSON.stringify([
  { command: 'tldr z3', explanation: 'Show concise usage examples for z3' },
  { command: 'z3 -smt2 <file>', explanation: 'ⓘ Solve an SMT-LIB2 file with z3' },
]);

interface StageRecord {
  stage: ClaudeTurnStage;
  detail?: ClaudeTurnStageDetail;
}

const spawnedPids = new Set<number>();
const tmpDirs: string[] = [];

afterEach(() => {
  for (const pid of spawnedPids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  spawnedPids.clear();
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

function scratchDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qq-claude-process-'));
  tmpDirs.push(dir);
  return dir;
}

function startTurn(
  scenario: string,
  overrides: Partial<ClaudeTurnOptions> = {},
  onStageHook?: (stage: ClaudeTurnStage) => void,
): { promise: Promise<string>; stages: StageRecord[]; deltas: string[] } {
  const stages: StageRecord[] = [];
  const deltas: string[] = [];
  const promise = runClaudeTurn({
    command: process.execPath,
    argv: [FIXTURE, scenario],
    cwd: process.cwd(),
    env: process.env,
    prompt: PROMPT,
    budgetMs: 20_000,
    onTextDelta: (text) => {
      deltas.push(text);
    },
    onStage: (stage, detail) => {
      stages.push({ stage, detail });
      if (stage === 'spawned' && typeof detail?.pid === 'number') {
        spawnedPids.add(detail.pid);
      }
      onStageHook?.(stage);
    },
    ...overrides,
  });
  return { promise, stages, deltas };
}

function stageNames(stages: StageRecord[]): ClaudeTurnStage[] {
  return stages.map((record) => record.stage);
}

describe('runClaudeTurn', () => {
  it('resolves on the result event, before the child exits', async () => {
    const { promise, stages, deltas } = startTurn('success');

    const text = await promise;
    const atResolve = stageNames(stages);

    expect(text).toBe(SUCCESS_ANSWER);
    expect(atResolve).toEqual(['spawned', 'init', 'first-delta', 'result']);
    expect(atResolve).not.toContain('exit');
    // The ⓘ bytes arrive in two writes; the decoded deltas still rebuild the answer.
    expect(deltas.join('')).toBe(SUCCESS_ANSWER);

    await vi.waitFor(() => expect(stageNames(stages)).toContain('exit'), { timeout: 5000 });
    expect(stages.find((record) => record.stage === 'exit')?.detail?.code).toBe(0);
  });

  it('sends the prompt as one stream-json user line on stdin and never in argv', async () => {
    const dir = scratchDir();
    const stdinFile = join(dir, 'stdin.txt');
    const argvFile = join(dir, 'argv.json');
    const { promise } = startTurn('success', {
      argv: [FIXTURE, 'success', '-p', '--input-format', 'stream-json'],
      env: { ...process.env, FAKE_CLAUDE_STDIN_FILE: stdinFile, FAKE_CLAUDE_ARGV_FILE: argvFile },
    });

    await promise;

    const stdinText = readFileSync(stdinFile, 'utf8');
    const lines = stdinText.split('\n').filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    expect(stdinText.endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      type: 'user',
      message: { role: 'user', content: PROMPT },
    });
    const childArgv = JSON.parse(readFileSync(argvFile, 'utf8')) as string[];
    expect(childArgv).toEqual(['-p', '--input-format', 'stream-json']);
    expect(childArgv.join(' ')).not.toContain(PROMPT);
  });

  it('aborts with SIGTERM: rejects with an AbortError and drops every later delta', async () => {
    const controller = new AbortController();
    let deltasAtAbort = -1;
    const run = startTurn('sigterm-slow', { signal: controller.signal }, (stage) => {
      if (stage === 'first-delta') {
        setTimeout(() => {
          deltasAtAbort = run.deltas.length;
          controller.abort();
        }, 0);
      }
    });

    const error = await run.promise.catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
    expect(stageNames(run.stages)).toContain('aborted');
    // The fixture keeps streaming for 300 ms after SIGTERM, then exits 143 (Probe 8).
    await vi.waitFor(() => expect(stageNames(run.stages)).toContain('exit'), { timeout: 5000 });
    expect(deltasAtAbort).toBeGreaterThan(0);
    expect(run.deltas).toHaveLength(deltasAtAbort);
    expect(run.stages.find((record) => record.stage === 'exit')?.detail?.code).toBe(143);
  });

  it('rejects an is_error result with the result text as stdout and no deltas', async () => {
    const { promise, deltas } = startTurn('auth');

    const error = (await promise.catch((caught: unknown) => caught)) as ClaudeTurnFailure;

    expect(error).toBeInstanceOf(Error);
    expect(error.reason).toBe('is-error');
    expect(error.stdout).toBe('Not logged in · Please run /login');
    expect(error.killed).toBe(false);
    expect(deltas).toEqual([]);
  });
});
