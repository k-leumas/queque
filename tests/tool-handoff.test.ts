/**
 * readToolHandoff — reads the zsh-written session-dir handoff into a ToolInventory.
 * Real temp dirs written by the test; only the debug log is mocked (to capture what is logged).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: vi.fn().mockResolvedValue(undefined),
}));

const { appendDebugLog } = await import('../src/shared/debug-log.js');
const { readToolHandoff, TOOL_HANDOFF_FILES } = await import('../src/client/tool-handoff.js');

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
});
