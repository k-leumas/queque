import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedRequest } from '../src/contracts/request.js';

const { detectVcsContextMock, execFileMock } = vi.hoisted(() => ({
  detectVcsContextMock: vi.fn(),
  execFileMock: vi.fn(),
}));

vi.mock('../src/shared/vcs-context.js', () => ({
  detectVcsContext: detectVcsContextMock,
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

function buildRequest(overrides: Partial<NormalizedRequest> = {}): NormalizedRequest {
  return {
    version: 1,
    ttyPath: '/dev/tty',
    cwd: '/repo',
    shellPid: 1234,
    lbuffer: 'fix src/index.ts',
    rbuffer: '',
    intent: 'codebase',
    ...overrides,
  };
}

describe('gatherContext', () => {
  beforeEach(async () => {
    vi.resetModules();
    detectVcsContextMock.mockReset();
    execFileMock.mockReset();
    detectVcsContextMock.mockResolvedValue({
      kind: 'git',
      cwd: '/repo',
      root: '/repo',
      branch: 'main',
      dirty: true,
    });
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: (error: null, result: { stdout: string }) => void,
      ) => {
        callback(null, { stdout: '' });
      },
    );
    // bootstrapBuiltins is no longer called inside gatherContext (WR-002 fix).
    // Tests must bootstrap explicitly. Use dynamic import to get the freshly
    // reset module instance after vi.resetModules().
    const { bootstrapBuiltins } = await import('../src/registry/bootstrap.js');
    bootstrapBuiltins();
  });

  it('always includes base context and git extras for codebase requests', async () => {
    const { gatherContext } = await import('../src/context/pipeline.js');
    const envelope = await gatherContext(buildRequest());

    expect(envelope.base).toMatchObject({
      queryText: 'fix src/index.ts',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: process.platform,
    });
    expect(Date.parse(envelope.base.timestamp)).not.toBeNaN();

    const gitChunk = envelope.extras.find((chunk) => chunk.kind === 'git');
    expect(gitChunk).toEqual({
      kind: 'git',
      payload: {
        cwd: '/repo',
        root: '/repo',
        branch: 'main',
        dirty: true,
        changedFiles: [],
      },
    });
  });

  it('omits git extras for filesystem requests, even inside a git repo', async () => {
    const { gatherContext } = await import('../src/context/pipeline.js');
    const envelope = await gatherContext(
      buildRequest({
        lbuffer: 'rename hero.png to hero-banner.png',
        intent: 'filesystem',
      }),
    );

    expect(envelope.extras).toEqual([
      {
        kind: 'filesystem',
        payload: {
          cwd: '/repo',
          apparentFilename: 'hero.png',
        },
      },
    ]);
  });

  it('includes git extras for git-prefixed shell commands', async () => {
    const { gatherContext } = await import('../src/context/pipeline.js');
    const envelope = await gatherContext(
      buildRequest({
        lbuffer: 'git commit -m "msg"',
        intent: 'shell-command',
      }),
    );

    expect(envelope.extras.some((chunk) => chunk.kind === 'git')).toBe(true);
  });

  it('does not include git extras for non-git shell commands', async () => {
    const { gatherContext } = await import('../src/context/pipeline.js');
    const envelope = await gatherContext(
      buildRequest({
        lbuffer: 'ls -la',
        intent: 'shell-command',
      }),
    );

    expect(envelope.extras).toEqual([]);
    expect(detectVcsContextMock).not.toHaveBeenCalled();
  });

  it('keeps git payload privacy-safe by excluding file content fields', async () => {
    const { gatherContext } = await import('../src/context/pipeline.js');
    const envelope = await gatherContext(buildRequest());
    const gitChunk = envelope.extras.find((chunk) => chunk.kind === 'git');

    expect(gitChunk).toBeDefined();
    expect(gitChunk?.payload).not.toHaveProperty('content');
    expect(gitChunk?.payload).not.toHaveProperty('bytes');
    expect(gitChunk?.payload).not.toHaveProperty('text');
    expect(gitChunk?.payload).not.toHaveProperty('lines');
  });
});
