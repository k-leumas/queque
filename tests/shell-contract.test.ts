import { describe, expect, it } from 'vitest';
import { buildBaseContext } from '../src/context/base-context.js';
import { baseContextSchema, normalizedRequestSchema } from '../src/contracts/request.js';
import { shellRequestSchema, shellResultSchema } from '../src/contracts/shell.js';
import { socketPathForUid } from '../src/shared/socket-path.js';

/** A request.json as a pre-Phase-11 zsh widget writes it: no `shell`, no `shellVersion`. */
const REQUEST_FIXTURE = {
  version: 1,
  ttyPath: '/dev/ttys001',
  cwd: '/home/user/project',
  shellPid: 12345,
  lbuffer: 'list files',
  rbuffer: '',
} as const;

describe('shellResultSchema', () => {
  it('accepts {kind: cancel} and rejects buffer fields on cancel', () => {
    // Valid cancel result
    const validCancel = shellResultSchema.safeParse({ kind: 'cancel' });
    expect(validCancel.success).toBe(true);

    // Cancel with extra buffer fields should fail
    const cancelWithBuffers = shellResultSchema.safeParse({
      kind: 'cancel',
      lbuffer: 'some text',
      rbuffer: '',
    });
    expect(cancelWithBuffers.success).toBe(false);
  });

  it('accepts {kind: replace-buffer, lbuffer, rbuffer} and rejects {buffer, cursor} shape', () => {
    // Valid replace-buffer result using lbuffer/rbuffer
    const validReplace = shellResultSchema.safeParse({
      kind: 'replace-buffer',
      lbuffer: 'echo hi',
      rbuffer: '',
    });
    expect(validReplace.success).toBe(true);

    // Deprecated {buffer, cursor} shape must be rejected
    const deprecatedShape = shellResultSchema.safeParse({
      kind: 'replace-buffer',
      buffer: 'echo hi',
      cursor: 7,
    });
    expect(deprecatedShape.success).toBe(false);
  });

  it('preserves separate lbuffer and rbuffer fields in the result', () => {
    const result = shellResultSchema.parse({
      kind: 'replace-buffer',
      lbuffer: 'git commit -m "',
      rbuffer: '"',
    });
    expect(result).toMatchObject({
      kind: 'replace-buffer',
      lbuffer: 'git commit -m "',
      rbuffer: '"',
    });
  });

  it('accepts {kind: error, message} ShellResult', () => {
    const validError = shellResultSchema.safeParse({
      kind: 'error',
      message: 'QueQue: API timeout — press any key',
    });
    expect(validError.success).toBe(true);
    expect(validError.data).toEqual({
      kind: 'error',
      message: 'QueQue: API timeout — press any key',
    });
  });

  it('rejects error variant without message field', () => {
    const noMessage = shellResultSchema.safeParse({ kind: 'error' });
    expect(noMessage.success).toBe(false);
  });
});

describe('shellRequestSchema', () => {
  it('preserves separate lbuffer and rbuffer fields', () => {
    const request = shellRequestSchema.parse({
      version: 1,
      ttyPath: '/dev/ttys001',
      cwd: '/home/user/project',
      shellPid: 12345,
      lbuffer: 'git status',
      rbuffer: '',
    });
    expect(request.lbuffer).toBe('git status');
    expect(request.rbuffer).toBe('');
    expect(request.shellPid).toBe(12345);
  });

  it('parses an old zsh payload without shell as zsh with no shellVersion', () => {
    const request = shellRequestSchema.parse(REQUEST_FIXTURE);
    expect(request.shell).toBe('zsh');
    expect(request.shellVersion).toBeUndefined();
  });

  it.each(['bash', 'fish'] as const)('accepts shell %s', (shell) => {
    expect(shellRequestSchema.parse({ ...REQUEST_FIXTURE, shell }).shell).toBe(shell);
  });

  it.each(['tcsh', ''])('rejects shell %j', (shell) => {
    expect(shellRequestSchema.safeParse({ ...REQUEST_FIXTURE, shell }).success).toBe(false);
  });

  it('accepts a bash version string and rejects one longer than 40 characters', () => {
    const ok = shellRequestSchema.safeParse({
      ...REQUEST_FIXTURE,
      shellVersion: '5.2.21(1)-release',
    });
    expect(ok.success).toBe(true);
    const long = shellRequestSchema.safeParse({ ...REQUEST_FIXTURE, shellVersion: 'x'.repeat(41) });
    expect(long.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 11 D-02: the base context names the shell the adapter reported, so no
// shared context code hardcodes zsh.
// ---------------------------------------------------------------------------

describe('baseContextSchema shellName', () => {
  const base = {
    queryText: 'list files',
    cwd: '/home/user/project',
    ttyPath: '/dev/ttys001',
    shellPid: 12345,
    platform: 'darwin',
    timestamp: '2026-11-14T00:00:00.000Z',
  };

  it.each(['zsh', 'bash', 'fish'] as const)('accepts shellName %s', (shellName) => {
    expect(baseContextSchema.safeParse({ ...base, shellName }).success).toBe(true);
  });

  it.each(['tcsh', ''])('rejects shellName %j', (shellName) => {
    expect(baseContextSchema.safeParse({ ...base, shellName }).success).toBe(false);
  });
});

describe('buildBaseContext shellName', () => {
  const normalized = (extra: Record<string, unknown> = {}) =>
    normalizedRequestSchema.parse({
      ...REQUEST_FIXTURE,
      ...extra,
      intent: 'general',
      confidence: 0.5,
    });

  it.each(['bash', 'fish'] as const)('copies shell %s from the request', (shell) => {
    expect(buildBaseContext(normalized({ shell })).shellName).toBe(shell);
  });

  it('gives zsh for a request parsed without shell', () => {
    expect(buildBaseContext(normalized()).shellName).toBe('zsh');
  });

  it('builds a context the base context schema accepts for bash', () => {
    const context = buildBaseContext(normalized({ shell: 'bash', shellVersion: '5.3.0(1)' }));
    expect(baseContextSchema.parse(context).shellName).toBe('bash');
  });
});

describe('socketPathForUid', () => {
  it('returns /tmp/qq-{uid}.sock', () => {
    const path = socketPathForUid(501);
    expect(path).toBe('/tmp/qq-501.sock');
  });
});
