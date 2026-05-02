import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, modelListMock, anthropicCtorMock, vcsMock } = vi.hoisted(() => {
  const createMock = vi.fn();
  const modelListMock = vi.fn();
  const anthropicCtorMock = vi.fn();
  const vcsMock = vi.fn();

  return { createMock, modelListMock, anthropicCtorMock, vcsMock };
});

class AnthropicMock {
  messages: { create: typeof createMock };
  models: { list: typeof modelListMock };

  constructor(options: unknown) {
    anthropicCtorMock(options);
    this.messages = {
      create: createMock,
    };
    this.models = {
      list: modelListMock,
    };
  }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: AnthropicMock,
}));

vi.mock('../src/shared/vcs-context.js', () => ({
  detectVcsContext: vcsMock,
}));

describe('suggestShellResult', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    delete process.env.QQ_MODEL;
    createMock.mockReset();
    modelListMock.mockReset();
    anthropicCtorMock.mockClear();
    vcsMock.mockReset();
  });

  it('returns replace-buffer JSON from Claude and includes VCS context in the prompt', async () => {
    vcsMock.mockResolvedValue({
      kind: 'git',
      cwd: '/repo',
      root: '/repo',
      branch: 'main',
      dirty: true,
    });
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
      yield { id: 'claude-3-5-haiku-20241022' };
      yield { id: 'claude-3-haiku-20240307' };
    });
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '{"command":"git status"}',
        },
      ],
    });

    const { suggestShellResult } = await import('../src/providers/claude.js');
    const result = await suggestShellResult({
      version: 1,
      ttyPath: '/dev/tty',
      cwd: '/repo',
      shellPid: 1234,
      lbuffer: 'status',
      rbuffer: '',
    });

    expect(result).toEqual({
      kind: 'replace-buffer',
      lbuffer: 'git status',
      rbuffer: '',
    });
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(modelListMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);

    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe('claude-3-haiku-20240307');
    expect(request.messages[0].content).toContain('versionControl');
    expect(request.messages[0].content).toContain('"kind": "git"');
    expect(request.messages[0].content).toContain('"branch": "main"');
  });

  it('rejects malformed JSON from Claude', async () => {
    vcsMock.mockResolvedValue({
      kind: 'none',
      cwd: '/repo',
    });
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
    });
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'not json',
        },
      ],
    });

    const { suggestShellResult } = await import('../src/providers/claude.js');
    await expect(
      suggestShellResult({
        version: 1,
        ttyPath: '/dev/tty',
        cwd: '/repo',
        shellPid: 1234,
        lbuffer: 'status',
        rbuffer: '',
      }),
    ).rejects.toBeTruthy();
  });

  it('does not retry on model errors', async () => {
    vcsMock.mockResolvedValue({
      kind: 'none',
      cwd: '/repo',
    });
    modelListMock.mockImplementation(async function* () {
      yield { id: 'claude-sonnet-4-20250514' };
    });
    createMock.mockRejectedValueOnce(new Error('404 model not found'));

    const { suggestShellResult } = await import('../src/providers/claude.js');
    await expect(
      suggestShellResult({
        version: 1,
        ttyPath: '/dev/tty',
        cwd: '/repo',
        shellPid: 1234,
        lbuffer: 'status',
        rbuffer: '',
      }),
    ).rejects.toThrow('404 model not found');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].model).toBe('claude-sonnet-4-20250514');
  });
});
