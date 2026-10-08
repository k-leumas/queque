import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { execFileAsync } from '../src/providers/claude-exec.js';

const STDIN_UNTIL_EOF = `
let received = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  received += chunk;
});
process.stdin.on('end', () => {
  process.stdout.write('eof:' + received.length);
});
`;

describe('execFileAsync', () => {
  const children: ReturnType<typeof execFile>[] = [];

  afterEach(() => {
    for (const child of children) {
      child.kill('SIGKILL');
    }
    children.length = 0;
  });

  it('ignores stdin so a child waiting for EOF exits without hanging', async () => {
    const started = Date.now();
    const result = await execFileAsync(process.execPath, ['-e', STDIN_UNTIL_EOF], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 2000,
      encoding: 'utf8',
    });

    expect(result.stdout).toBe('eof:0');
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('documents that execFile ignores stdio and leaves stdin open', () => {
    const child = execFile(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    } as never);
    children.push(child);
    expect(child.stdin).not.toBeNull();
    child.kill('SIGKILL');
  });
});
