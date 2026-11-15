/**
 * readToolHandoff — reads the shell-written session-dir handoff into a ToolInventory, waiting
 * (bounded) while an adapter's `tools.pending` marker says a background scan is still writing.
 * Real temp dirs written by the test; only the debug log is mocked (to capture what is logged).
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: vi.fn().mockResolvedValue(undefined),
}));

const { appendDebugLog } = await import('../src/shared/debug-log.js');
const {
  readToolHandoff,
  TOOL_HANDOFF_FILES,
  TOOL_HANDOFF_PENDING,
  TOOL_HANDOFF_PENDING_BUDGET_MS,
  TOOL_HANDOFF_PENDING_POLL_MS,
} = await import('../src/client/tool-handoff.js');

const FIXTURE_NAMES = ['qqsecretcmd', 'qqothercmd', 'qqsecretfn', 'qqsecretalias'];

function writeHandoff(
  dir: string,
  files: Partial<Record<keyof typeof TOOL_HANDOFF_FILES, string>> = {},
): void {
  const contents = {
    commands: 'qqsecretcmd\r\nqqothercmd\r\n\r\n',
    builtins: 'cd\necho\n\n',
    functions: 'qqsecretfn\nqqsecretalias\n',
    ...files,
  };
  for (const key of Object.keys(TOOL_HANDOFF_FILES) as Array<keyof typeof TOOL_HANDOFF_FILES>) {
    writeFileSync(join(dir, TOOL_HANDOFF_FILES[key]), contents[key]);
  }
}

describe('readToolHandoff', () => {
  let dir: string;
  let savedAwareness: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qq-handoff-read-'));
    savedAwareness = process.env.QQ_TOOL_AWARENESS;
    delete process.env.QQ_TOOL_AWARENESS;
    vi.mocked(appendDebugLog).mockClear();
  });

  afterEach(() => {
    if (savedAwareness === undefined) {
      delete process.env.QQ_TOOL_AWARENESS;
    } else {
      process.env.QQ_TOOL_AWARENESS = savedAwareness;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads all three files into Sets, tolerating CRLF and dropping blank lines', async () => {
    writeHandoff(dir);
    const inventory = await readToolHandoff(dir);
    expect(inventory).not.toBeNull();
    expect([...(inventory?.commands ?? [])]).toEqual(['qqsecretcmd', 'qqothercmd']);
    expect([...(inventory?.builtins ?? [])]).toEqual(['cd', 'echo']);
    expect([...(inventory?.functions ?? [])]).toEqual(['qqsecretfn', 'qqsecretalias']);
  });

  it('returns null when commands.txt is missing', async () => {
    writeHandoff(dir);
    rmSync(join(dir, TOOL_HANDOFF_FILES.commands));
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'ENOENT',
    });
  });

  it('returns null when functions.txt is missing', async () => {
    writeHandoff(dir);
    rmSync(join(dir, TOOL_HANDOFF_FILES.functions));
    await expect(readToolHandoff(dir)).resolves.toBeNull();
  });

  it('returns null when functions.txt is a directory', async () => {
    writeHandoff(dir);
    rmSync(join(dir, TOOL_HANDOFF_FILES.functions));
    mkdirSync(join(dir, TOOL_HANDOFF_FILES.functions));
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'EISDIR',
    });
  });

  it('returns null when commands.txt is empty', async () => {
    writeHandoff(dir, { commands: '\n' });
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'empty',
    });
  });

  it('returns null when QQ_TOOL_AWARENESS=0 even with files present', async () => {
    writeHandoff(dir);
    process.env.QQ_TOOL_AWARENESS = '0';
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'disabled',
    });
  });

  it('returns null without throwing for an unreadable session dir path', async () => {
    const notADir = join(dir, 'plain-file');
    writeFileSync(notADir, 'x');
    await expect(readToolHandoff(notADir)).resolves.toBeNull();
    await expect(readToolHandoff('/nonexistent/qq-handoff-read')).resolves.toBeNull();
  });

  it('logs counts only — never a tool name (D-04)', async () => {
    writeHandoff(dir);
    await readToolHandoff(dir);
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff read', {
      commands: 2,
      builtins: 2,
      functions: 2,
    });
    const successCall = vi
      .mocked(appendDebugLog)
      .mock.calls.find(([, message]) => message === 'tool handoff read');
    const details = successCall?.[2] as Record<string, unknown>;
    expect(Object.keys(details).sort()).toEqual(['builtins', 'commands', 'functions']);
    for (const value of Object.values(details)) {
      expect(typeof value).toBe('number');
    }
    const logged = JSON.stringify(vi.mocked(appendDebugLog).mock.calls);
    for (const name of [...FIXTURE_NAMES, 'echo']) {
      expect(logged).not.toContain(name);
    }
  });

  it('tags the inventory with the shell it came from (zsh by default)', async () => {
    writeHandoff(dir);
    const zsh = await readToolHandoff(dir);
    expect(zsh?.shell).toBe('zsh');
    const bash = await readToolHandoff(dir, { shell: 'bash' });
    expect(bash?.shell).toBe('bash');
  });
});

describe('readToolHandoff: tools.pending marker (D-05)', () => {
  let dir: string;
  let savedAwareness: string | undefined;
  const timers: ReturnType<typeof setTimeout>[] = [];

  /** Writes the files and removes the marker after `ms`, like a detached adapter writer. */
  function finishLater(ms: number, files: Array<keyof typeof TOOL_HANDOFF_FILES> = []): void {
    timers.push(
      setTimeout(() => {
        if (files.length > 0) writeHandoff(dir);
        for (const key of Object.keys(TOOL_HANDOFF_FILES) as Array<
          keyof typeof TOOL_HANDOFF_FILES
        >) {
          if (!files.includes(key)) rmSync(join(dir, TOOL_HANDOFF_FILES[key]), { force: true });
        }
        rmSync(join(dir, TOOL_HANDOFF_PENDING), { force: true });
      }, ms),
    );
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'qq-handoff-pending-'));
    savedAwareness = process.env.QQ_TOOL_AWARENESS;
    delete process.env.QQ_TOOL_AWARENESS;
    vi.mocked(appendDebugLog).mockClear();
  });

  afterEach(() => {
    for (const timer of timers.splice(0)) clearTimeout(timer);
    if (savedAwareness === undefined) {
      delete process.env.QQ_TOOL_AWARENESS;
    } else {
      process.env.QQ_TOOL_AWARENESS = savedAwareness;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('names the marker and pins the budget and poll interval', () => {
    expect(TOOL_HANDOFF_PENDING).toBe('tools.pending');
    expect(TOOL_HANDOFF_PENDING_BUDGET_MS).toBe(500);
    expect(TOOL_HANDOFF_PENDING_POLL_MS).toBe(10);
  });

  it('waits for the marker to go and then reads the files the writer left', async () => {
    writeFileSync(join(dir, TOOL_HANDOFF_PENDING), '');
    finishLater(50, ['commands', 'builtins', 'functions']);
    const started = Date.now();
    const inventory = await readToolHandoff(dir, { shell: 'bash' });
    const elapsed = Date.now() - started;
    expect(inventory?.commands.has('qqsecretcmd')).toBe(true);
    expect(inventory?.shell).toBe('bash');
    expect(elapsed).toBeLessThan(TOOL_HANDOFF_PENDING_BUDGET_MS);
  });

  it('gives up after the budget with reason pending-timeout and logs no tool name', async () => {
    writeHandoff(dir);
    writeFileSync(join(dir, TOOL_HANDOFF_PENDING), '');
    const started = Date.now();
    const inventory = await readToolHandoff(dir, { pendingBudgetMs: 100 });
    const elapsed = Date.now() - started;
    expect(inventory).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'pending-timeout',
    });
    const logged = JSON.stringify(vi.mocked(appendDebugLog).mock.calls);
    for (const name of FIXTURE_NAMES) {
      expect(logged).not.toContain(name);
    }
    expect(existsSync(join(dir, TOOL_HANDOFF_PENDING))).toBe(true);
  });

  it('QQ_TOOL_AWARENESS=0 returns null at once without waiting on a marker', async () => {
    writeHandoff(dir);
    writeFileSync(join(dir, TOOL_HANDOFF_PENDING), '');
    process.env.QQ_TOOL_AWARENESS = '0';
    const started = Date.now();
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(50);
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'disabled',
    });
  });

  it('a marker removed without commands.txt degrades to ENOENT', async () => {
    writeFileSync(join(dir, TOOL_HANDOFF_PENDING), '');
    finishLater(30, ['builtins', 'functions']);
    await expect(readToolHandoff(dir)).resolves.toBeNull();
    expect(vi.mocked(appendDebugLog)).toHaveBeenCalledWith('client', 'tool handoff unavailable', {
      reason: 'ENOENT',
    });
  });
});
