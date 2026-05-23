import { describe, expect, it } from 'vitest';
import { shellRequestSchema, shellResultSchema } from '../src/contracts/shell.js';
import { socketPathForUid } from '../src/shared/socket-path.js';

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
      message: 'Que-Que: API timeout — press any key',
    });
    expect(validError.success).toBe(true);
    expect(validError.data).toEqual({
      kind: 'error',
      message: 'Que-Que: API timeout — press any key',
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
});

describe('socketPathForUid', () => {
  it('returns /tmp/qq-{uid}.sock', () => {
    const path = socketPathForUid(501);
    expect(path).toBe('/tmp/qq-501.sock');
  });
});
