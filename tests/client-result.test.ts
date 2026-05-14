import { spawnSync } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// Mock Claude provider so llm mode stays deterministic in tests
// ---------------------------------------------------------------------------
vi.mock('../src/providers/claude.js', () => ({
  fetchCandidates: vi.fn(),
}));

// ---------------------------------------------------------------------------
// References to the real (un-mocked) fs/promises functions, captured before
// the vi.mock factory runs. These are used inside the FIFO-path describe block
// to restore the passthrough implementations after each test.
// ---------------------------------------------------------------------------
const realFsp = vi.hoisted(() => ({
  writeFile: null as null | typeof import('node:fs/promises')['writeFile'],
  rename: null as null | typeof import('node:fs/promises')['rename'],
}));

// ---------------------------------------------------------------------------
// Mock fs.open for /dev/tty so tests don't require a real TTY.
// writeFile and rename are also wrapped as vi.fn() passthroughs so they can
// be intercepted with vi.mocked() inside the FIFO-path describe block without
// running into the ESM non-configurable-property limitation.
// ---------------------------------------------------------------------------
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  // Capture the real implementations before the mock wraps them.
  realFsp.writeFile = original.writeFile.bind(original);
  realFsp.rename = original.rename.bind(original);
  return {
    ...original,
    open: vi.fn().mockImplementation(async (filePath: string) => {
      if (filePath === '/dev/tty') {
        // Return a fake file handle — tests don't need real TTY I/O
        return { fd: 999, close: vi.fn().mockResolvedValue(undefined) };
      }

      return original.open(filePath);
    }),
    // Default: regular file (not a FIFO). Per-test overrides use mockResolvedValueOnce.
    stat: vi.fn().mockResolvedValue({ isFIFO: () => false }),
    // Passthrough vi.fn()s so vi.mocked() can intercept them per-test.
    // The ESM namespace exports non-configurable bindings; wrapping here makes
    // them configurable in the mock so implementations can be swapped per-test.
    writeFile: vi.fn().mockImplementation((...args: Parameters<typeof original.writeFile>) =>
      original.writeFile(...args),
    ),
    rename: vi.fn().mockImplementation((...args: Parameters<typeof original.rename>) =>
      original.rename(...args),
    ),
  };
});

// ---------------------------------------------------------------------------
// Mock ink so modal renders don't hang waiting for user input.
// After D-03 the modal always opens regardless of candidate count; the mock
// immediately invokes onSelect with the first candidate's command so the
// llm-mode test can complete without a real TTY interaction.
// ---------------------------------------------------------------------------
vi.mock('ink', () => ({
  render: vi
    .fn()
    .mockImplementation(
      (element: {
        props: { onSelect?: (cmd: string) => void; candidates?: Array<{ command: string }> };
      }) => {
        const { onSelect, candidates } = element.props;
        if (onSelect) {
          Promise.resolve().then(() => {
            onSelect(candidates?.[0]?.command ?? 'git status');
          });
        }
        return { unmount: vi.fn(), rerender: vi.fn() };
      },
    ),
  Box: ({ children }: { children?: unknown }) => children,
  Text: ({ children }: { children?: unknown }) => children,
  useInput: vi.fn(),
  useApp: vi.fn().mockReturnValue({ exit: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const widgetPath = path.join(__dirname, '..', 'shell', 'zsh', 'qq.zsh');

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

describe('writeShellResult — FIFO path', () => {
  let tmpDir: string;
  let resultFile: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-fifo-test-'));
    resultFile = path.join(tmpDir, 'result.json');
    // Access the mock factory stubs via dynamic import and clear their call history.
    // The dynamic import resolves to the vi.mock'd module where writeFile/rename
    // are vi.fn() passthroughs (not non-configurable ESM namespace bindings).
    const fspMock = await import('node:fs/promises');
    vi.mocked(fspMock.writeFile).mockClear();
    vi.mocked(fspMock.rename).mockClear();
    vi.mocked(fspMock.stat).mockClear();
  });

  afterEach(async () => {
    // Restore writeFile and rename to their passthrough implementations so
    // subsequent describe blocks (runForegroundClient) continue to perform
    // real file I/O. The real implementations were captured in realFsp by
    // the vi.mock factory before the mock was installed.
    const fspMock = await import('node:fs/promises');
    if (realFsp.writeFile) {
      vi.mocked(fspMock.writeFile).mockImplementation(
        (...args: Parameters<typeof fspMock.writeFile>) =>
          realFsp.writeFile!(...args),
      );
    }
    if (realFsp.rename) {
      vi.mocked(fspMock.rename).mockImplementation(
        (...args: Parameters<typeof fspMock.rename>) =>
          realFsp.rename!(...args),
      );
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('writes directly to FIFO path without rename when isFIFO() is true', async () => {
    // Stub writeFile and rename via the mocked module so assertions track only
    // calls from this test.
    const fspMock = await import('node:fs/promises');
    vi.mocked(fspMock.writeFile).mockResolvedValue(undefined);
    vi.mocked(fspMock.rename).mockResolvedValue(undefined);

    vi.mocked(fspMock.stat).mockResolvedValueOnce(
      { isFIFO: () => true } as ReturnType<typeof fspMock.stat>,
    );

    const { writeShellResult } = await import('../src/client/result-writer.js');

    await writeShellResult(resultFile, { kind: 'cancel' });

    expect(vi.mocked(fspMock.rename)).not.toHaveBeenCalled();
    expect(vi.mocked(fspMock.writeFile)).toHaveBeenCalledWith(
      resultFile,
      expect.any(String),
      expect.anything(),
    );
  });

  it('uses atomic rename (tmp + rename) for regular file paths when isFIFO() is false', async () => {
    // Stub writeFile and rename as no-ops to assert call patterns without real I/O.
    const fspMock = await import('node:fs/promises');
    vi.mocked(fspMock.writeFile).mockResolvedValue(undefined);
    vi.mocked(fspMock.rename).mockResolvedValue(undefined);

    // stat mock defaults to isFIFO: () => false — no override needed

    const { writeShellResult } = await import('../src/client/result-writer.js');

    await writeShellResult(resultFile, { kind: 'cancel' });

    expect(vi.mocked(fspMock.rename)).toHaveBeenCalled();
    expect(vi.mocked(fspMock.rename).mock.calls[0][0]).toMatch(/\.tmp$/);
    expect(vi.mocked(fspMock.rename).mock.calls[0][1]).toBe(resultFile);
    expect(vi.mocked(fspMock.writeFile)).toHaveBeenCalled();
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
    // This test verifies the non-Zellij path — ensure ZELLIJ is not set so the
    // implementation takes the /dev/tty branch even when running inside a Zellij session.
    const savedZellij = process.env['ZELLIJ'];
    delete process.env['ZELLIJ'];

    try {
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
    } finally {
      // Restore ZELLIJ env to its original state
      if (savedZellij === undefined) {
        delete process.env['ZELLIJ'];
      } else {
        process.env['ZELLIJ'] = savedZellij;
      }
    }
  });

  it('emits a replace-buffer result in llm mode and the shell applies it', async () => {
    const { fetchCandidates } = await import('../src/providers/claude.js');
    const mockedFetchCandidates = vi.mocked(fetchCandidates);
    mockedFetchCandidates.mockResolvedValue([{ command: 'git status', explanation: '' }]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');

    await runForegroundClient({
      requestFile,
      resultFile,
      resultMode: 'llm',
    });

    const resultContent = fs.readFileSync(resultFile, 'utf-8');
    expect(JSON.parse(resultContent.trim())).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'git status',
      rbuffer: '',
    });

    const shellResult = spawnSync(
      'zsh',
      [
        '-f',
        '-c',
        `source ${widgetPath}
         LBUFFER="old left"
         RBUFFER="old right"
         _qq_apply_result "${resultFile}"
         echo "lbuffer=$LBUFFER"
         echo "rbuffer=$RBUFFER"`,
      ],
      { encoding: 'utf8', env: { ...process.env, PATH: process.env.PATH } },
    );

    expect(shellResult.status).toBe(0);
    expect(shellResult.stdout).toContain('lbuffer=git status');
    expect(shellResult.stdout).toContain('rbuffer=');
  });
});

describe('runForegroundClient: Zellij branch skips /dev/tty open', () => {
  let tmpDir: string;
  let requestFile: string;
  let resultFile: string;
  let originalZellij: string | undefined;

  const sampleRequest = {
    version: 1 as const,
    ttyPath: '/dev/tty',
    cwd: '/home/user',
    shellPid: 1234,
    lbuffer: 'list files',
    rbuffer: '',
  };

  beforeEach(() => {
    // Clear all mock call history so previous-test spy calls don't leak in.
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-zellij-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    fs.writeFileSync(requestFile, JSON.stringify(sampleRequest) + '\n');
    originalZellij = process.env['ZELLIJ'];
  });

  afterEach(() => {
    // Restore ZELLIJ env to original state
    if (originalZellij === undefined) {
      delete process.env['ZELLIJ'];
    } else {
      process.env['ZELLIJ'] = originalZellij;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('does not call fsp.open("/dev/tty") when process.env.ZELLIJ is defined', async () => {
    process.env['ZELLIJ'] = '0';

    const fspDynamic = await import('node:fs/promises');
    const openSpy = vi.spyOn(fspDynamic, 'open');

    const { runForegroundClient } = await import('../src/client/run-foreground.js');

    await runForegroundClient({
      requestFile,
      resultFile,
      resultMode: 'cancel',
    });

    const ttyCall = openSpy.mock.calls.find((args: unknown[]) => args[0] === '/dev/tty');
    expect(ttyCall).toBeUndefined();

    // The cancel path must still write a result
    const content = fs.readFileSync(resultFile, 'utf-8');
    expect(JSON.parse(content.trim())).toEqual({ kind: 'cancel' });
  });
});
