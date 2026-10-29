import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseLsofPidList, replaceStaleListener } from '../src/daemon/bootstrap.js';

// Defect 1 (Phase 10): on Alpine, `lsof` is busybox, which ignores `-t <path>` and lists
// every open file of every process (`PID<TAB>/bin/busybox<TAB>FD<TAB>TARGET`). The old
// parse turned that into a pid list, and replaceStaleListener SIGTERMed and SIGKILLed it
// all, including the container's PID 1. The fake lsof below prints busybox-format lines in
// which every number is the pid of a sacrificial `sleep 30` child, so a broken parse can
// only ever hit that child, never the test runner or PID 1.

const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

describe('parseLsofPidList', () => {
  it('returns the pids of a bare pid list', () => {
    expect(parseLsofPidList('123\n456\n', 999)).toEqual([123, 456]);
  });

  it('never returns the selfPid', () => {
    expect(parseLsofPidList('123\n999\n', 999)).toEqual([123]);
  });

  it('ignores blank lines and surrounding whitespace', () => {
    expect(parseLsofPidList('\n123\n\n  456  \n', 999)).toEqual([123, 456]);
  });

  it('returns no pids for busybox-format output', () => {
    const busybox = '1\t/bin/busybox\t0\t/dev/null\n10\t/bin/busybox\t1\tpipe:[4272030]\n';
    expect(parseLsofPidList(busybox, 999).length).toBe(0);
  });

  it('returns no pids when a bare pid line is mixed with a busybox line', () => {
    const mixed = '123\n10\t/bin/busybox\t1\tpipe:[4272030]\n';
    expect(parseLsofPidList(mixed, 999).length).toBe(0);
  });
});

describe('replaceStaleListener with busybox lsof', () => {
  let fakeBinDir: string;
  let savedPath: string | undefined;
  let child: ChildProcess;
  const socketPath = `/tmp/qq-lsof-test-${process.pid}.sock`;

  // The fake lsof is written and run once up front. The first exec of a new file is slow on
  // macOS (syspolicyd scans it, see bug-206), and listenerPids only waits 1 s for lsof, so a
  // fresh script per test timed out under full-suite load. The child pid comes in via env.
  beforeAll(() => {
    fakeBinDir = mkdtempSync(path.join(tmpdir(), 'qq-fake-lsof-'));
    const fakeLsof = path.join(fakeBinDir, 'lsof');
    writeFileSync(
      fakeLsof,
      [
        '#!/bin/sh',
        `printf '%s\\t/bin/busybox\\t%s\\t/dev/null\\n' "$QQ_FAKE_LSOF_PID" "$QQ_FAKE_LSOF_PID"`,
        `printf '%s\\t/bin/busybox\\t%s\\tpipe:[4272030]\\n' "$QQ_FAKE_LSOF_PID" "$QQ_FAKE_LSOF_PID"`,
        '',
      ].join('\n'),
    );
    chmodSync(fakeLsof, 0o755);
    execFileSync(fakeLsof, { stdio: 'ignore', timeout: 30_000 });
    savedPath = process.env.PATH;
    process.env.PATH = `${fakeBinDir}${path.delimiter}${savedPath ?? ''}`;
  });

  afterAll(() => {
    process.env.PATH = savedPath;
    delete process.env.QQ_FAKE_LSOF_PID;
    rmSync(fakeBinDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    appendDebugLogMock.mockClear();
    child = spawn('sleep', ['30'], { stdio: 'ignore' });
    const spid = child.pid;
    if (spid === undefined) throw new Error('sacrificial child did not start');
    process.env.QQ_FAKE_LSOF_PID = String(spid);
  });

  afterEach(() => {
    child.kill('SIGKILL');
    rmSync(socketPath, { force: true });
  });

  // listenerPids returns [] when its 1 s lsof timeout trips, so both tests assert the
  // "ignored" line (a timed-out lsof can never pass as a clean parse) and retry under load.
  it('leaves the process named by busybox lsof lines alive', { retry: 2 }, async () => {
    await replaceStaleListener(socketPath);
    // Let a delivered signal surface as the child's exit before checking.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const pid = child.pid as number;
    let alive = child.exitCode === null && child.signalCode === null;
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
    }
    expect(appendDebugLogMock).toHaveBeenCalledWith('daemon', 'lsof output ignored', {
      lines: 2,
    });
    expect(alive).toBe(true);
  });

  it('logs that the lsof output was ignored', { retry: 2 }, async () => {
    await replaceStaleListener(socketPath);
    expect(appendDebugLogMock).toHaveBeenCalledWith('daemon', 'lsof output ignored', {
      lines: 2,
    });
  });
});
