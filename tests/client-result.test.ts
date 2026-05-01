import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Mock ensureDaemon so tests don't actually launch a daemon
// ---------------------------------------------------------------------------
vi.mock('../src/daemon/bootstrap.js', () => ({
  ensureDaemon: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock socket-path to return a predictable path
// ---------------------------------------------------------------------------
vi.mock('../src/shared/socket-path.js', () => ({
  socketPathForUid: vi.fn().mockReturnValue('/tmp/qq-test-999.sock'),
  socketPath: vi.fn().mockReturnValue('/tmp/qq-test-999.sock'),
}));

// ---------------------------------------------------------------------------
// Mock fs.open for /dev/tty so tests don't require a real TTY
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    open: vi.fn().mockImplementation(async (filePath: string) => {
      if (filePath === '/dev/tty') {
        // Return a fake file handle — tests don't need real TTY I/O
        return { fd: 999, close: vi.fn().mockResolvedValue(undefined) };
      }

      return original.open(filePath);
    }),
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeShellResult', () => {
  let tmpDir: string;
  let resultFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-client-test-'));
    resultFile = path.join(tmpDir, 'result.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('writes {kind: "cancel"} JSON to the result file', async () => {
    const { writeShellResult } = await import('../src/client/result-writer.js');

    await writeShellResult(resultFile, { kind: 'cancel' });

    const content = fs.readFileSync(resultFile, 'utf-8');
    expect(JSON.parse(content.trim())).toEqual({ kind: 'cancel' });
  });

  it('writes {kind: "replace-buffer"} JSON with lbuffer and rbuffer to the result file', async () => {
    const { writeShellResult } = await import('../src/client/result-writer.js');

    await writeShellResult(resultFile, {
      kind: 'replace-buffer',
      lbuffer: 'git status',
      rbuffer: '',
    });

    const content = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'git status',
      rbuffer: '',
    });
  });
});

describe('runForegroundClient', () => {
  let tmpDir: string;
  let requestFile: string;
  let resultFile: string;

  const sampleRequest = {
    version: 1 as const,
    ttyPath: '/dev/tty',
    cwd: '/home/user',
    shellPid: 1234,
    lbuffer: 'list files in src',
    rbuffer: '',
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-fg-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    // Write a sample shell request
    fs.writeFileSync(requestFile, JSON.stringify(sampleRequest) + '\n');
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('emits a replace-buffer result in replace-buffer-fixture mode', async () => {
    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');

    await runForegroundClient({
      requestFile,
      resultFile,
      resultMode: 'replace-buffer-fixture',
    });

    // ensureDaemon must have been called
    expect(ensureDaemon).toHaveBeenCalledTimes(1);

    const content = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.kind).toBe('replace-buffer');
    expect(typeof parsed.lbuffer).toBe('string');
    expect(typeof parsed.rbuffer).toBe('string');
  });

  it('opens /dev/tty for interactive stdio instead of using inherited stdio', async () => {
    const fsp = await import('node:fs/promises');
    const openSpy = vi.spyOn(fsp, 'open');

    const { runForegroundClient } = await import('../src/client/run-foreground.js');

    await runForegroundClient({
      requestFile,
      resultFile,
      resultMode: 'cancel',
    });

    // /dev/tty must have been opened
    const ttyCall = openSpy.mock.calls.find((args) => args[0] === '/dev/tty');
    expect(ttyCall).toBeDefined();
  });
});
