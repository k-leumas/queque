import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_HANDOFF_FILES } from '../src/client/tool-handoff.js';
import type { ContextEnvelope } from '../src/contracts/request.js';
import { abortError, type FetchOptions } from '../src/providers/provider.js';
import { CATALOG_SET } from '../src/shared/tool-catalog.js';

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
// Mock provider resolver so llm mode stays deterministic in tests
// ---------------------------------------------------------------------------
const fetchCandidatesMock = vi.hoisted(() => vi.fn());

vi.mock('../src/providers/resolver.js', () => ({
  resolveAdapter: vi.fn(() => ({
    fetchCandidates: fetchCandidatesMock,
  })),
  resolveClaudeDefaultAdapter: vi.fn(() => ({
    fetchCandidates: fetchCandidatesMock,
  })),
}));

// The daemon-down fallback resolves through the provider pin (08-03). The node:fs mock
// below has no readFileSync, so the real pin loader must not run in this file.
vi.mock('../src/providers/provider-pin.js', () => ({
  resolveProviderAdapter: vi.fn(() => ({
    fetchCandidates: fetchCandidatesMock,
  })),
  loadProviderPin: vi.fn(() => ({ kind: 'absent' })),
  OLLAMA_DEFAULT_BASE_URL: 'http://localhost:11434',
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
// Mock node:tty so fake TTY streams (fd=999) pass the raw-mode pre-check.
// ---------------------------------------------------------------------------
vi.mock('node:tty', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:tty')>();
  const FakeReadStream = class {
    isTTY = true;
    setRawMode = vi.fn();
    setEncoding = vi.fn();
    ref = vi.fn();
    unref = vi.fn();
    resume = vi.fn();
    on = vi.fn();
    removeListener = vi.fn();
    read = vi.fn().mockReturnValue(null);
  };
  const FakeWriteStream = class {
    isTTY = true;
    write = vi.fn();
    cursorTo = vi.fn();
    clearScreenDown = vi.fn();
  };
  return {
    ...actual,
    ReadStream: FakeReadStream,
    WriteStream: FakeWriteStream,
  };
});

// ---------------------------------------------------------------------------
// Mock ink so modal renders don't hang waiting for user input.
// After D-03 the modal always opens regardless of candidate count; the mock
// immediately invokes onSelect with the first candidate's command so the
// llm-mode test can complete without a real TTY interaction.
// `inkMock.autoSelect = false` switches that off for one test (reset after each test), so a
// test can inspect the rerendered element and call its onSelect/onCancel itself.
// ---------------------------------------------------------------------------
const inkMock = vi.hoisted(() => ({ autoSelect: true }));

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
      if (inkMock.autoSelect && onSelect && candidates) {
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
            if (inkMock.autoSelect && newOnSelect && newCandidates) {
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

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-fg-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    // Write a sample shell request
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);

    const { resolveClaudeDefaultAdapter } = await import('../src/providers/resolver.js');
    vi.mocked(resolveClaudeDefaultAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    const { resolveProviderAdapter } = await import('../src/providers/provider-pin.js');
    vi.mocked(resolveProviderAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    fetchCandidatesMock.mockReset();
  });

  afterEach(() => {
    inkMock.autoSelect = true;
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
    const mockedFetchCandidates = fetchCandidatesMock;
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

  it('still runs the in-process fallback when the daemon cannot start (WR-12)', async () => {
    const { ensureDaemon } = await import('../src/daemon/bootstrap.js');
    vi.mocked(ensureDaemon).mockRejectedValueOnce(
      new Error('qq daemon did not start within the expected window (/tmp/qq-test-999.sock)'),
    );
    fetchCandidatesMock.mockResolvedValue([{ command: 'git status', explanation: '' }]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    expect(fetchCandidatesMock).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim());
    expect(parsed).toMatchObject({ kind: 'replace-buffer', lbuffer: 'git status' });
  });

  it('writes error ShellResult to FIFO when fetchCandidates rejects', async () => {
    fetchCandidatesMock.mockRejectedValue(new Error('API timeout'));

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const resultContent = fs.readFileSync(resultFile, 'utf-8');
    const parsed = JSON.parse(resultContent.trim());
    expect(parsed.kind).toBe('error');
    expect(parsed.message).toContain('API timeout');
    expect(parsed.message).toContain('QueQue:');
    expect(parsed.message).not.toMatch(/QueQue: QueQue:/);
  });

  it('writes error ShellResult when the provider adapter cannot be resolved', async () => {
    const { resolveClaudeDefaultAdapter } = await import('../src/providers/resolver.js');
    const { resolveProviderAdapter } = await import('../src/providers/provider-pin.js');
    const notRegistered = () => {
      throw new Error(
        'QueQue: Claude provider is not registered — was bootstrapBuiltins() called?',
      );
    };
    vi.mocked(resolveClaudeDefaultAdapter).mockImplementation(notRegistered);
    vi.mocked(resolveProviderAdapter).mockImplementation(notRegistered);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const parsed = JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim());
    expect(parsed.kind).toBe('error');
    expect(parsed.message).toContain('bootstrapBuiltins');
    expect(parsed.message).toContain('QueQue:');
    expect(parsed.message).not.toMatch(/QueQue: QueQue:/);
    expect(fetchCandidatesMock).not.toHaveBeenCalled();
  });

  it('writes error ShellResult for an invalid provider pin and never calls a provider', async () => {
    const { resolveProviderAdapter } = await import('../src/providers/provider-pin.js');
    vi.mocked(resolveProviderAdapter).mockImplementation(() => {
      throw new Error(
        'QueQue: /home/u/.config/qq/provider.json is not a valid provider pin (provider). Fix the file or run `qq init provider`.',
      );
    });

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const parsed = JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim());
    expect(parsed.kind).toBe('error');
    expect(parsed.message).toContain('qq init provider');
    expect(parsed.message).not.toMatch(/QueQue: QueQue:/);
    expect(fetchCandidatesMock).not.toHaveBeenCalled();
  });

  it('writes FIFO kind error with D-13 /login copy and a single QueQue prefix', async () => {
    fetchCandidatesMock.mockRejectedValue(
      new Error(
        'QueQue: Claude is not authenticated. Run `claude /login`, or set ANTHROPIC_API_KEY in the environment or .env.local.',
      ),
    );

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const parsed = JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim());
    expect(parsed.kind).toBe('error');
    expect(parsed.message).toMatch(/login/);
    expect(parsed.message).toMatch(/ANTHROPIC_API_KEY/);
    expect(parsed.message).not.toMatch(/not wired yet/i);
    expect(parsed.message).not.toMatch(/QueQue: QueQue:/);
  });

  it('Esc during thinking… writes cancel, aborts the fetch, never rerenders, and resolves (D-13/D-14/D-15)', async () => {
    let receivedSignal: AbortSignal | undefined;
    fetchCandidatesMock.mockImplementation(
      (_envelope: ContextEnvelope, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          receivedSignal = options?.signal;
          options?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
        }),
    );
    const { render } = await import('ink');
    const renderMock = vi.mocked(render);
    const renderCallIndex = renderMock.mock.calls.length;

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    const run = runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });
    // The adapter is still pending: the loading element is on screen.
    await vi.waitFor(() => expect(fetchCandidatesMock).toHaveBeenCalledTimes(1));
    const loadingElement = renderMock.mock.calls[renderCallIndex]?.[0] as unknown as {
      props: { candidates: unknown; onCancel: () => Promise<void> };
    };
    const app = renderMock.mock.results[renderCallIndex]?.value as {
      rerender: ReturnType<typeof vi.fn>;
    };
    expect(loadingElement.props.candidates).toBeNull();

    await loadingElement.props.onCancel();
    await run;
    // Let the aborted fetch's rejection run through the client's catch handler.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim())).toEqual({ kind: 'cancel' });
    expect(receivedSignal?.aborted).toBe(true);
    expect(app.rerender).not.toHaveBeenCalled();
  });

  it('streams an arrived row into the modal; Enter on it aborts the rest and drops later rows (D-05/D-07/D-14)', async () => {
    let receivedSignal: AbortSignal | undefined;
    let emit: FetchOptions['onCandidate'];
    fetchCandidatesMock.mockImplementation(
      (_envelope: ContextEnvelope, options?: FetchOptions) =>
        new Promise((_resolve, reject) => {
          receivedSignal = options?.signal;
          emit = options?.onCandidate;
          if (emit === undefined) {
            reject(new Error('the client passed no onCandidate'));
            return;
          }
          options?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
          // One row arrives; the adapter stays pending (more rows could still come).
          emit({ command: 'git log', explanation: 'commit history' });
        }),
    );
    const { render } = await import('ink');
    const renderMock = vi.mocked(render);
    const renderCallIndex = renderMock.mock.calls.length;

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    // The ink mock auto-selects the first row of the arriving list (an early Enter).
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    expect(JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim())).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'git log',
      rbuffer: '  # commit history',
      query: 'list files in src',
    });
    expect(receivedSignal?.aborted).toBe(true);
    const app = renderMock.mock.results[renderCallIndex]?.value as {
      rerender: ReturnType<typeof vi.fn>;
    };
    const arriving = app.rerender.mock.calls[0]?.[0] as {
      props: { candidates: Array<{ command: string }>; listState?: string };
    };
    expect(arriving.props.listState).toBe('arriving');
    expect(arriving.props.candidates.map((c) => c.command)).toEqual(['git log']);
    const rerenders = app.rerender.mock.calls.length;

    // D-14: a row that arrives after Enter is neither rendered nor kept.
    emit?.({ command: 'ls -la', explanation: 'list files' });
    expect(app.rerender).toHaveBeenCalledTimes(rerenders);
  });

  /** The element passed to the most recent rerender of the given render call. */
  type StreamedElement = {
    props: {
      candidates: Array<{ command: string; explanation: string }> | null;
      listState?: string;
      error?: boolean;
      onSelect: (command: string, explanation: string) => Promise<void>;
      onCancel: () => Promise<void>;
    };
  };
  async function rerenderedElements(renderCallIndex: number): Promise<StreamedElement[]> {
    const { render } = await import('ink');
    const app = vi.mocked(render).mock.results[renderCallIndex]?.value as {
      rerender: ReturnType<typeof vi.fn>;
    };
    return app.rerender.mock.calls.map((call) => call[0] as StreamedElement);
  }

  it('a failure after a row arrived keeps the row selectable under a partial list (D-16)', async () => {
    inkMock.autoSelect = false;
    fetchCandidatesMock.mockImplementation(
      (_envelope: ContextEnvelope, options?: FetchOptions) =>
        new Promise((_resolve, reject) => {
          if (options?.onCandidate === undefined) {
            reject(new Error('the client passed no onCandidate'));
            return;
          }
          options.onCandidate({ command: 'git log', explanation: 'commit history' });
          setTimeout(() => reject(new Error('boom')), 0);
        }),
    );
    const { render } = await import('ink');
    const renderCallIndex = vi.mocked(render).mock.calls.length;

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    const run = runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    let last: StreamedElement | undefined;
    await vi.waitFor(async () => {
      last = (await rerenderedElements(renderCallIndex)).at(-1);
      expect(last?.props.listState).toBe('partial');
    });
    expect(last?.props.candidates?.map((c) => c.command)).toEqual(['git log']);
    expect(last?.props.error).toBeUndefined();
    // No result yet: the user still picks a row or presses Esc.
    expect(fs.existsSync(resultFile)).toBe(false);

    await last?.props.onSelect('git log', 'commit history');
    await run;
    expect(JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim())).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'git log',
      rbuffer: '  # commit history',
      query: 'list files in src',
    });
  });

  it('an AbortError after Esc with rows on screen writes nothing more and rerenders nothing (D-14)', async () => {
    inkMock.autoSelect = false;
    fetchCandidatesMock.mockImplementation(
      (_envelope: ContextEnvelope, options?: FetchOptions) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(abortError()), { once: true });
          options?.onCandidate?.({ command: 'git log', explanation: 'commit history' });
        }),
    );
    const { render } = await import('ink');
    const renderCallIndex = vi.mocked(render).mock.calls.length;

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    const run = runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    let elements: StreamedElement[] = [];
    await vi.waitFor(async () => {
      elements = await rerenderedElements(renderCallIndex);
      expect(elements).toHaveLength(1);
    });
    await elements[0]?.props.onCancel();
    await run;
    // Let the aborted fetch's rejection run through the client's catch handler.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim())).toEqual({ kind: 'cancel' });
    expect(await rerenderedElements(renderCallIndex)).toHaveLength(1);
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

  beforeEach(async () => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-resolved-guard-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);

    const { resolveClaudeDefaultAdapter } = await import('../src/providers/resolver.js');
    vi.mocked(resolveClaudeDefaultAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    const { resolveProviderAdapter } = await import('../src/providers/provider-pin.js');
    vi.mocked(resolveProviderAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    fetchCandidatesMock.mockReset();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('writes replace-buffer result and never writes cancel after selection', async () => {
    fetchCandidatesMock.mockResolvedValue([{ command: 'git status', explanation: '' }]);

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

describe('runForegroundClient: installed-tool awareness', () => {
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

  type RenderedCandidate = { command: string; explanation: string; missingTools?: string[] };

  /** Writes the handoff next to request.json with the REAL widget helper under zsh -f. */
  function writeRealHandoff(dir: string): void {
    const result = spawnSync(
      'zsh',
      [
        '-f',
        '-c',
        `source ${widgetPath}
         mkdir -p "$QQ_TEST_DIR/bin"
         print -r -- '#!/bin/sh' > "$QQ_TEST_DIR/bin/qqpresenttool"
         chmod +x "$QQ_TEST_DIR/bin/qqpresenttool"
         print -r -- '#!/bin/sh' > "$QQ_TEST_DIR/bin/fd"
         chmod +x "$QQ_TEST_DIR/bin/fd"
         path=("$QQ_TEST_DIR/bin" /usr/bin /bin)
         qqfntool() { :; }
         nvm() { :; }
         _qq_write_tool_handoff "$QQ_TEST_DIR"`,
      ],
      { encoding: 'utf8', env: { ...process.env, QQ_TEST_DIR: dir }, timeout: 5000 },
    );
    expect(result.status).toBe(0);
  }

  /** Candidates passed to the most recent app.rerender (the ink mock records them). */
  async function lastRerenderedCandidates(): Promise<RenderedCandidate[]> {
    const { render } = await import('ink');
    const results = vi.mocked(render).mock.results;
    const app = results[results.length - 1]?.value as {
      rerender: ReturnType<typeof vi.fn>;
    };
    const calls = app.rerender.mock.calls;
    const element = calls[calls.length - 1]?.[0] as { props: { candidates: RenderedCandidate[] } };
    return element.props.candidates;
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-tools-test-'));
    requestFile = path.join(tmpDir, 'request.json');
    resultFile = path.join(tmpDir, 'result.json');
    fs.writeFileSync(requestFile, `${JSON.stringify(sampleRequest)}\n`);

    const { resolveClaudeDefaultAdapter } = await import('../src/providers/resolver.js');
    vi.mocked(resolveClaudeDefaultAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    const { resolveProviderAdapter } = await import('../src/providers/provider-pin.js');
    vi.mocked(resolveProviderAdapter).mockImplementation(() => ({
      fetchCandidates: fetchCandidatesMock,
    }));
    fetchCandidatesMock.mockReset();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('case A: flags a missing tool from a real zsh handoff, keeps order, inserts verbatim', async () => {
    writeRealHandoff(tmpDir);
    fetchCandidatesMock.mockResolvedValue([
      { command: 'qqpresenttool --list | qqabsenttool', explanation: 'demo' },
      { command: 'qqfntool && cd /tmp', explanation: 'fn' },
    ]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const candidates = await lastRerenderedCandidates();
    expect(candidates.map((c) => c.command)).toEqual([
      'qqpresenttool --list | qqabsenttool',
      'qqfntool && cd /tmp',
    ]);
    expect(candidates[0].missingTools).toEqual(['qqabsenttool']);
    expect(candidates[1].missingTools).toBeUndefined();

    const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8').trim());
    expect(result).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'qqpresenttool --list | qqabsenttool',
      rbuffer: '  # demo',
      query: 'list files in src',
    });
  });

  it('case B: no handoff files means no flags', async () => {
    fetchCandidatesMock.mockResolvedValue([
      { command: 'qqabsenttool --x', explanation: 'missing' },
      { command: 'git status', explanation: 'status' },
    ]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const candidates = await lastRerenderedCandidates();
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate.missingTools).toBeUndefined();
    }
  });

  it('case C: QQ_TOOL_AWARENESS=0 in the client disables flags even with files present', async () => {
    writeRealHandoff(tmpDir);
    fetchCandidatesMock.mockResolvedValue([
      { command: 'qqpresenttool | qqabsenttool', explanation: 'demo' },
    ]);
    const saved = process.env.QQ_TOOL_AWARENESS;
    process.env.QQ_TOOL_AWARENESS = '0';
    try {
      const { runForegroundClient } = await import('../src/client/run-foreground.js');
      await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

      const candidates = await lastRerenderedCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].missingTools).toBeUndefined();
    } finally {
      if (saved === undefined) {
        delete process.env.QQ_TOOL_AWARENESS;
      } else {
        process.env.QQ_TOOL_AWARENESS = saved;
      }
    }
  });

  it('case D: malformed model output never throws or yields undefined words', async () => {
    writeRealHandoff(tmpDir);
    fetchCandidatesMock.mockResolvedValue([
      { command: '"rg\\', explanation: 'escape at end of input' },
      { command: 'constructor --x | toString', explanation: 'prototype-key words' },
      { command: 'echo "a" "`', explanation: 'unterminated backtick' },
      { command: `qqabsenttool ${'x'.repeat(9000)}`, explanation: 'over the length cap' },
    ]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await expect(
      runForegroundClient({ requestFile, resultFile, resultMode: 'llm' }),
    ).resolves.toBeUndefined();

    const candidates = await lastRerenderedCandidates();
    expect(candidates.map((c) => c.explanation)).toEqual([
      'escape at end of input',
      'prototype-key words',
      'unterminated backtick',
      'over the length cap',
    ]);
    expect(candidates[0].missingTools).toEqual(['rg']);
    expect(candidates[1].missingTools).toEqual(['constructor', 'toString']);
    expect(candidates[2].missingTools).toBeUndefined();
    expect(candidates[3].missingTools).toBeUndefined();
    for (const candidate of candidates) {
      for (const tool of candidate.missingTools ?? []) {
        expect(tool).not.toContain('undefined');
      }
    }
  });

  /** The envelope the adapter actually received (in-process fallback: no daemon socket). */
  function receivedEnvelope(): ContextEnvelope {
    expect(fetchCandidatesMock).toHaveBeenCalledTimes(1);
    return fetchCandidatesMock.mock.calls[0][0] as ContextEnvelope;
  }

  it('sends only installed catalog tools in the envelope', async () => {
    writeRealHandoff(tmpDir);
    fetchCandidatesMock.mockResolvedValue([{ command: 'fd -e ts', explanation: 'find' }]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const envelope = receivedEnvelope();
    const chunks = envelope.extras.filter((chunk) => chunk.kind === 'installed-tools');
    expect(chunks).toHaveLength(1);
    const tools = (chunks[0].payload as { tools: string[] }).tools;
    expect(tools).toContain('fd');
    // D-01 amended: a function-only name counts as installed.
    expect(tools).toContain('nvm');
    expect(tools).not.toContain('qqpresenttool');
    expect(tools).not.toContain('qqfntool');
    for (const tool of tools) {
      expect(CATALOG_SET.has(tool)).toBe(true);
    }
    expect(tools).toEqual([...tools].sort());

    const { buildSystemPrompt } = await import('../src/providers/steering.js');
    const system = buildSystemPrompt(envelope);
    expect(system).toContain('fd');
    expect(system).toContain('nvm');
    expect(system).toContain('standard system utilities are also present');
    expect(system).not.toContain('qqpresenttool');
  });

  it('sends no installed-tools chunk without the handoff', async () => {
    for (const file of Object.values(TOOL_HANDOFF_FILES)) {
      expect(fs.existsSync(path.join(tmpDir, file))).toBe(false);
    }
    fetchCandidatesMock.mockResolvedValue([{ command: 'git status', explanation: 'status' }]);

    const { runForegroundClient } = await import('../src/client/run-foreground.js');
    await runForegroundClient({ requestFile, resultFile, resultMode: 'llm' });

    const envelope = receivedEnvelope();
    expect(envelope.extras.some((chunk) => chunk.kind === 'installed-tools')).toBe(false);
    const { buildSystemPrompt, QUEQUE_SYSTEM } = await import('../src/providers/steering.js');
    expect(buildSystemPrompt(envelope)).toBe(QUEQUE_SYSTEM);
  });
});

describe('buildShellBuffers — install form (09-04, Pitfall 6)', () => {
  it('lands the cursor on the first placeholder after the install prefix', async () => {
    const { buildShellBuffers } = await import('../src/client/run-foreground.js');
    expect(buildShellBuffers('brew install fd && fd <pattern>', 'find files')).toEqual({
      lbuffer: 'brew install fd && fd ',
      rbuffer: 'pattern  # find files',
    });
  });
});
