import { spawnSync } from 'node:child_process';
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
// Mock detectProvider so runForegroundClient tests don't depend on real
// provider detection (env vars, fs access, network)
// ---------------------------------------------------------------------------
vi.mock('../src/providers/detect.js', () => ({
  detectProvider: vi.fn().mockResolvedValue({ kind: 'anthropic-key' }),
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
    writeFile: vi
      .fn()
      .mockImplementation((...args: Parameters<typeof original.writeFile>) =>
        original.writeFile(...args),
      ),
    rename: vi
      .fn()
      .mockImplementation((...args: Parameters<typeof original.rename>) =>
        original.rename(...args),
      ),
  };
});

// ---------------------------------------------------------------------------
// Mock node:fs (synchronous) so the uncaughtException and unhandledRejection
// handlers in main.ts can be tested without touching the real filesystem.
// The mock is module-level so it is hoisted before any dynamic import.
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  realpathSync: (p: string) => p,
}));

// ---------------------------------------------------------------------------
// Mock ink so modal renders don't hang waiting for user input.
// After D-03 the modal always opens regardless of candidate count; the mock
// immediately invokes onSelect with the first candidate's command so the
// llm-mode test can complete without a real TTY interaction.
// ---------------------------------------------------------------------------
vi.mock('ink', () => ({
  render: vi.fn().mockImplementation(
    (element: {
      props: {
        onSelect?: (cmd: string, explanation: string) => void;
        candidates?: Array<{ command: string; explanation?: string }>;
      };
    }) => {
      let currentElement = element;
      const { onSelect, candidates } = element.props;
      if (onSelect && candidates) {
        Promise.resolve().then(() => {
          const cmd = candidates[0]?.command ?? 'git status';
          const expl = candidates[0]?.explanation || `see man ${cmd.split(' ')[0]}`;
          onSelect(cmd, expl);
        });
      }
      return {
        unmount: vi.fn(),
        rerender: vi.fn().mockImplementation(
          (newEl: {
            props: {
              onSelect?: (cmd: string, explanation: string) => void;
              candidates?: Array<{ command: string; explanation?: string }>;
            };
          }) => {
            currentElement = newEl;
            const { onSelect: newOnSelect, candidates: newCandidates } = currentElement.props;
            if (newOnSelect && newCandidates) {
              Promise.resolve().then(() => {
                const cmd = newCandidates[0]?.command ?? 'git status';
                const expl = newCandidates[0]?.explanation || `see man ${cmd.split(' ')[0]}`;
                newOnSelect(cmd, expl);
              });
            }
          },
        ),
      };
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
const widgetPath = path.join(__dirname, '..', 'shell', 'zsh', 'queque.zsh');

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
      const writeFn = realFsp.writeFile;
      vi.mocked(fspMock.writeFile).mockImplementation(
        (...args: Parameters<typeof fspMock.writeFile>) => writeFn(...args),
      );
    }
    if (realFsp.rename) {
      const renameFn = realFsp.rename;
      vi.mocked(fspMock.rename).mockImplementation((...args: Parameters<typeof fspMock.rename>) =>
        renameFn(...args),
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

    vi.mocked(fspMock.stat).mockResolvedValueOnce({
      isFIFO: () => true,
    } as import('node:fs').Stats);

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
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);
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
    const savedZellij = process.env.ZELLIJ;
    delete process.env.ZELLIJ;

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
        delete process.env.ZELLIJ;
      } else {
        process.env.ZELLIJ = savedZellij;
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
      rbuffer: '  # see man git',
      query: 'list files in src',
    });

    const shellResult = spawnSync(
      'zsh',
      [
        '-f',
        '-c',
        `source ${widgetPath}
         LBUFFER="old left"
         RBUFFER="old right"
         QQ_ORIG_LBUFFER="list files in src"
         QQ_ORIG_RBUFFER=""
         _qq_apply_result "${resultFile}"
         echo "lbuffer=$LBUFFER"
         echo "rbuffer=$RBUFFER"`,
      ],
      { encoding: 'utf8', env: { ...process.env, PATH: process.env.PATH } },
    );

    expect(shellResult.status).toBe(0);
    // LBUFFER is the selected command so it appears in the new PS1
    expect(shellResult.stdout).toContain('lbuffer=git status');
    // RBUFFER holds the explanation; cursor sits between command and comment
    expect(shellResult.stdout).toContain('rbuffer=  # see man git');
    // Summary line with selected command is also printed above PS1
    expect(shellResult.stdout).toContain('git status');
  });

  it('writes error ShellResult to FIFO when fetchCandidates rejects', async () => {
    const { fetchCandidates } = await import('../src/providers/claude.js');
    vi.mocked(fetchCandidates).mockRejectedValue(new Error('API timeout'));

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const resultContent = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(resultContent.trim());
    expect(parsed.kind).toBe('error');
    expect(parsed.message).toContain('API timeout');
    expect(parsed.message).toContain('QueQue:');
  });
});

describe('runForegroundClient: Zellij branch opens /dev/tty', () => {
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
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);
    originalZellij = process.env.ZELLIJ;
  });

  afterEach(() => {
    // Restore ZELLIJ env to original state
    if (originalZellij === undefined) {
      delete process.env.ZELLIJ;
    } else {
      process.env.ZELLIJ = originalZellij;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('calls fsp.open("/dev/tty") even when process.env.ZELLIJ is defined', async () => {
    process.env.ZELLIJ = '0';

    const fspDynamic = await import('node:fs/promises');
    const openSpy = vi.spyOn(fspDynamic, 'open');

    const { runForegroundClient } = await import('../src/client/run-foreground.js');

    await runForegroundClient({
      requestFile,
      resultFile,
      resultMode: 'cancel',
    });

    // /dev/tty must be opened in Zellij too — zellij run does not wire stdin to the pane PTY,
    // so we must always use /dev/tty to get a real TTY for Ink.
    const ttyCall = openSpy.mock.calls.find((args: unknown[]) => args[0] === '/dev/tty');
    expect(ttyCall).toBeDefined();

    // The cancel path must still write a result
    const content = fs.readFileSync(resultFile, 'utf-8');
    expect(JSON.parse(content.trim())).toEqual({ kind: 'cancel' });
  });
});

// ---------------------------------------------------------------------------
// Task 2 (Plan 04-01): resolved guard prevents double write
// ---------------------------------------------------------------------------

describe('runForegroundClient: resolved guard prevents double write', () => {
  let tmpDir: string;
  let requestFile: string;
  let resultFile: string;

  const sampleRequest = {
    version: 1 as const,
    ttyPath: '/dev/tty',
    cwd: '/home/user',
    shellPid: 1234,
    lbuffer: 'list files',
    rbuffer: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-resolved-guard-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('writes replace-buffer result and never writes cancel after selection', async () => {
    const { fetchCandidates } = await import('../src/providers/claude.js');
    vi.mocked(fetchCandidates).mockResolvedValue([{ command: 'git status', explanation: '' }]);

    const fspMock = await import('node:fs/promises');
    const writeFileSpy = vi.spyOn(fspMock, 'writeFile');

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    // Result file must contain the replace-buffer outcome
    const resultContent = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(resultContent.trim());
    expect(parsed.kind).toBe('replace-buffer');
    expect(parsed.lbuffer).toBe('git status');
    expect(parsed.rbuffer).toBe('  # see man git');

    // No writeFile call should have written a cancel payload after the selection resolved
    const cancelCalls = writeFileSpy.mock.calls.filter((args) => {
      const content = String(args[1]);
      return content.includes('"cancel"');
    });
    expect(cancelCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Task 3 (Plan 04-01): main.ts error handler tests
// These tests are pending (todo) until Plan 04-03 adds the handlers to main.ts.
//
// ACTIVATION REQUIRED IN PLAN 04-03:
// 1. Add vi.mock('node:fs', ...) at the top of this file with { writeFileSync: vi.fn() }.
// 2. Replace each it.todo with a real it() block containing the body below.
//
// Body for 'uncaughtException handler writes cancel to QQ_RESULT_FILE':
//
//   vi.resetModules();
//   process.env['QQ_RESULT_FILE'] = '/tmp/qq-test-handler-result';
//   const processSpy = vi.spyOn(process, 'on');
//   const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
//     throw new Error('process.exit called');
//   });
//   const fsMock = await import('node:fs');
//   vi.mocked(fsMock.writeFileSync).mockImplementation(() => {});
//   await import('../src/cli/main.js');
//   const handlerCall = processSpy.mock.calls.find((args) => args[0] === 'uncaughtException');
//   expect(handlerCall).toBeDefined();
//   const handler = handlerCall![1] as (err: Error) => void;
//   try { handler(new Error('test error')); } catch { /* process.exit caught */ }
//   expect(vi.mocked(fsMock.writeFileSync)).toHaveBeenCalledWith(
//     '/tmp/qq-test-handler-result',
//     expect.stringMatching(/"kind":"cancel"/),
//   );
//   delete process.env['QQ_RESULT_FILE'];
//   exitSpy.mockRestore();
//   processSpy.mockRestore();
//
// Body for 'unhandledRejection handler writes cancel to QQ_RESULT_FILE':
//   Same as above but find 'unhandledRejection' handler and invoke with a reason string.
// ---------------------------------------------------------------------------

describe('main.ts: uncaughtException handler writes cancel to QQ_RESULT_FILE', () => {
  it('writes cancel JSON to QQ_RESULT_FILE on uncaught exception', async () => {
    vi.resetModules();
    process.env.QQ_RESULT_FILE = '/tmp/qq-sess.testXXXXXX/result.json';
    const processSpy = vi.spyOn(process, 'on');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const fsMock = await import('node:fs');
    vi.mocked(fsMock.writeFileSync).mockImplementation(() => {});
    await import('../src/cli/main.js');
    const handlerCall = processSpy.mock.calls.find((args) => args[0] === 'uncaughtException');
    expect(handlerCall).toBeDefined();
    const handler = handlerCall?.[1] as (err: Error) => void;
    try {
      handler(new Error('test error'));
    } catch {
      /* process.exit caught */
    }
    expect(vi.mocked(fsMock.writeFileSync)).toHaveBeenCalledWith(
      '/tmp/qq-sess.testXXXXXX/result.json',
      expect.stringMatching(/"kind":"cancel"/),
    );
    delete process.env.QQ_RESULT_FILE;
    exitSpy.mockRestore();
    processSpy.mockRestore();
  });
});

describe('main.ts: unhandledRejection handler writes cancel to QQ_RESULT_FILE', () => {
  it('writes cancel JSON to QQ_RESULT_FILE on unhandled rejection', async () => {
    vi.resetModules();
    process.env.QQ_RESULT_FILE = '/tmp/qq-sess.testXXXXXX/result.json';
    const processSpy = vi.spyOn(process, 'on');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const fsMock = await import('node:fs');
    vi.mocked(fsMock.writeFileSync).mockImplementation(() => {});
    await import('../src/cli/main.js');
    const handlerCall = processSpy.mock.calls.find((args) => args[0] === 'unhandledRejection');
    expect(handlerCall).toBeDefined();
    const handler = handlerCall?.[1] as (reason: unknown) => void;
    try {
      handler('test rejection reason');
    } catch {
      /* process.exit caught */
    }
    expect(vi.mocked(fsMock.writeFileSync)).toHaveBeenCalledWith(
      '/tmp/qq-sess.testXXXXXX/result.json',
      expect.stringMatching(/"kind":"cancel"/),
    );
    delete process.env.QQ_RESULT_FILE;
    exitSpy.mockRestore();
    processSpy.mockRestore();
  });
});
