import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BASH_BINDINGS_SCRIPT,
  type DoctorDeps,
  defaultDoctorDeps,
  doctorCommand,
  formatDoctorReport,
  parseBashBindings,
  parseZshBindings,
  runDoctorChecks,
  type ShellBindings,
} from '../src/cli/commands/doctor.js';
import {
  DOCTOR_CHECK_IDS,
  type DoctorCheck,
  type DoctorCheckId,
  type DoctorReport,
  doctorExitCode,
  doctorReportSchema,
} from '../src/contracts/doctor.js';

const SOCKET = '/tmp/qq-501.sock';

/** The zsh target's twelve rows, in order (Phase 10; unchanged by Phase 11). */
const ZSH_IDS: DoctorCheckId[] = [
  'zsh',
  'jq',
  'tmp',
  'socket',
  'daemon',
  'integration',
  'binding',
  'term',
  'locale',
  'provider',
  'node',
  'telemetry',
];
const BASH_LINUX_IDS: DoctorCheckId[] = ['bash', ...ZSH_IDS.slice(1)];
const BASH_DARWIN_IDS: DoctorCheckId[] = [
  ...BASH_LINUX_IDS.slice(0, 6),
  'bash_profile',
  ...BASH_LINUX_IDS.slice(6),
];

function zshBound(emacs: string | null, viins: string | null): ShellBindings {
  return { keymaps: { emacs, viins }, bracketedPaste: null, bleLoaded: false };
}

function bashBound(overrides: Partial<ShellBindings> = {}): ShellBindings {
  return {
    keymaps: { emacs: '_qq_question', 'vi-insert': '_qq_question' },
    bracketedPaste: true,
    bleLoaded: false,
    ...overrides,
  };
}

const HEALTHY_RC: Record<string, string> = {
  '.zshrc': 'source "/opt/homebrew/share/queque/queque.zsh"\n',
  '.bashrc': 'source "/opt/homebrew/share/queque/queque.bash"\n',
  '.bash_profile': '[ -f ~/.bashrc ] && . ~/.bashrc\n',
};

/** A machine where `??` works: every check is ✓. Each case overrides one dependency. */
function healthyDeps(overrides: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    env: { TERM: 'xterm-256color', LANG: 'en_US.UTF-8', PATH: '/usr/bin:/bin' },
    platform: 'linux',
    homeDir: '/home/tester',
    uid: 501,
    socketPath: SOCKET,
    nodeVersion: '24.11.0',
    qqVersion: '0.7.0',
    which: (name) => `/usr/bin/${name}`,
    shellVersion: async (shell) => (shell === 'bash' ? '5.3.3(1)-release' : '5.9'),
    shellBindings: async (shell) =>
      shell === 'bash' ? bashBound() : zshBound('qq-question-widget', 'qq-question-widget'),
    readRc: (relPath) => HEALTHY_RC[relPath] ?? null,
    probeTmp: () => true,
    socketOwner: () => 501,
    pingDaemon: async () => 'yes',
    socketConnectable: async () => false,
    loadProviderPin: () => ({ kind: 'absent' }),
    detectProvider: async () => ({ kind: 'anthropic-key' }),
    telemetryStatus: () => ({
      blockedBy: null,
      state: { enabled: false, asked: false },
      keyPresent: false,
    }),
    ...overrides,
  };
}

function check(report: DoctorReport, id: DoctorCheckId) {
  const found = report.checks.find((c) => c.id === id);
  return found ?? { id, status: undefined, summary: undefined, hint: undefined };
}

describe('runDoctorChecks: healthy machine', () => {
  it('runs all twelve checks in id order with telemetry last, all ok, exit 0', async () => {
    const report = await runDoctorChecks(healthyDeps());
    expect(report.checks.map((c) => c.id)).toEqual(ZSH_IDS);
    expect(report.checks).toHaveLength(12);
    expect(report.checks.at(-1)?.id).toBe('telemetry');
    expect(report.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(report.ok).toBe(true);
    expect(doctorExitCode(report)).toBe(0);
  });

  it('parses with doctorReportSchema and reports version 1, qqVersion and platform', async () => {
    const report = await runDoctorChecks(healthyDeps({ platform: 'darwin' }));
    expect(doctorReportSchema.parse(report)).toEqual(report);
    expect(report.version).toBe(1);
    expect(report.qqVersion).toBe('0.7.0');
    expect(report.platform).toBe('darwin');
  });

  it('maps an unknown platform to other', async () => {
    const report = await runDoctorChecks(healthyDeps({ platform: 'freebsd' }));
    expect(report.platform).toBe('other');
  });
});

describe('runDoctorChecks: zsh (D-20)', () => {
  it('fails when zsh is missing, exit 1', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ which: (name) => (name === 'zsh' ? null : `/usr/bin/${name}`) }),
    );
    expect(check(report, 'zsh').status).toBe('fail');
    expect(report.ok).toBe(false);
    expect(doctorExitCode(report)).toBe(1);
  });

  it('fails for zsh 4.3.17', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellVersion: async () => '4.3.17' }));
    expect(check(report, 'zsh').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('warns for zsh 5.3 (untested) and still exits 0', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellVersion: async () => '5.3' }));
    expect(check(report, 'zsh').status).toBe('warn');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('passes for zsh 5.8.1', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellVersion: async () => '5.8.1' }));
    expect(check(report, 'zsh').status).toBe('ok');
  });

  it('passes for zsh 5.9', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellVersion: async () => '5.9' }));
    expect(check(report, 'zsh').status).toBe('ok');
  });

  it('warns when zsh is on PATH but its version cannot be read', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellVersion: async () => null }));
    expect(check(report, 'zsh').status).toBe('warn');
  });
});

describe('runDoctorChecks: hard blockers (D-17, D-19)', () => {
  it('fails when jq is missing, exit 1', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ which: (name) => (name === 'jq' ? null : `/usr/bin/${name}`) }),
    );
    expect(check(report, 'jq').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('fails when the /tmp probe fails', async () => {
    const report = await runDoctorChecks(healthyDeps({ probeTmp: () => false }));
    expect(check(report, 'tmp').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('fails for a 108-byte socket path on linux', async () => {
    const report = await runDoctorChecks(healthyDeps({ socketPath: `/tmp/${'x'.repeat(103)}` }));
    expect(check(report, 'socket').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('passes a 107-byte socket path on linux', async () => {
    const report = await runDoctorChecks(healthyDeps({ socketPath: `/tmp/${'x'.repeat(102)}` }));
    expect(check(report, 'socket').status).toBe('ok');
  });

  it('fails for a 104-byte socket path on darwin', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ platform: 'darwin', socketPath: `/tmp/${'x'.repeat(99)}` }),
    );
    expect(check(report, 'socket').status).toBe('fail');
  });

  it('fails when the existing socket is owned by another uid', async () => {
    const report = await runDoctorChecks(healthyDeps({ socketOwner: () => 0 }));
    expect(check(report, 'socket').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('passes when the socket does not exist yet', async () => {
    const report = await runDoctorChecks(healthyDeps({ socketOwner: () => null }));
    expect(check(report, 'socket').status).toBe('ok');
  });
});

describe('runDoctorChecks: warnings keep exit 0 (D-17)', () => {
  it('warns for provider none and exits 0 (fake claude on Linux)', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ detectProvider: async () => ({ kind: 'none', message: 'nothing found' }) }),
    );
    expect(check(report, 'provider').status).toBe('warn');
    expect(report.ok).toBe(true);
    expect(doctorExitCode(report)).toBe(0);
  });

  it('warns for an invalid provider pin', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        loadProviderPin: () => ({ kind: 'invalid', path: '/home/tester/p.json', message: 'x' }),
      }),
    );
    expect(check(report, 'provider').status).toBe('warn');
  });

  it('passes for a valid provider pin without detecting', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        loadProviderPin: () => ({
          kind: 'pinned',
          pin: { version: 1, provider: 'ollama', model: 'm' },
        }),
        detectProvider: async () => {
          throw new Error('detectProvider must not run for a valid pin');
        },
      }),
    );
    expect(check(report, 'provider').status).toBe('ok');
  });

  it('warns when TERM is unset', async () => {
    const report = await runDoctorChecks(healthyDeps({ env: { LANG: 'en_US.UTF-8' } }));
    expect(check(report, 'term').status).toBe('warn');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('warns when TERM is dumb', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ env: { TERM: 'dumb', LANG: 'en_US.UTF-8' } }),
    );
    expect(check(report, 'term').status).toBe('warn');
  });

  it('warns for LANG=C with no UTF-8 in LC_ALL or LC_CTYPE', async () => {
    const report = await runDoctorChecks(healthyDeps({ env: { TERM: 'xterm', LANG: 'C' } }));
    expect(check(report, 'locale').status).toBe('warn');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('uses LC_ALL before LANG for the locale', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ env: { TERM: 'xterm', LC_ALL: 'C.UTF-8', LANG: 'C' } }),
    );
    expect(check(report, 'locale').status).toBe('ok');
  });

  it('warns and names the widget when ? is bound to another widget', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        shellBindings: async () => zshBound('qq-question-widget', 'self-insert'),
      }),
    );
    expect(check(report, 'binding').status).toBe('warn');
    expect(check(report, 'binding').summary).toContain('self-insert');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('warns when the bindings cannot be read', async () => {
    const report = await runDoctorChecks(healthyDeps({ shellBindings: async () => null }));
    expect(check(report, 'binding').status).toBe('warn');
  });

  it('warns when ~/.zshrc does not load QueQue', async () => {
    const report = await runDoctorChecks(healthyDeps({ readRc: () => null }));
    expect(check(report, 'integration').status).toBe('warn');
    expect(check(report, 'integration').hint).toContain('qq init zsh && source ~/.zshrc');
  });

  it('is ok with "starts on the next ??" when nothing listens on the socket', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ pingDaemon: async () => 'unknown', socketConnectable: async () => false }),
    );
    expect(check(report, 'daemon').status).toBe('ok');
    expect(check(report, 'daemon').summary).toContain('starts on the next ??');
  });

  it('warns, never "not running", when a listener accepts but does not answer (WR-03)', async () => {
    const socketConnectable = vi.fn(async () => true);
    const report = await runDoctorChecks(
      healthyDeps({ pingDaemon: async () => 'unknown', socketConnectable }),
    );
    const daemon = check(report, 'daemon');
    expect(daemon.status).toBe('warn');
    expect(daemon.summary).toContain('does not answer');
    expect(daemon.summary).not.toContain('not running');
    expect(daemon.hint).toContain(SOCKET);
    expect(socketConnectable).toHaveBeenCalledWith(SOCKET);
    expect(doctorExitCode(report)).toBe(0);
  });

  it('a throwing connect probe falls back to "not running"', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        pingDaemon: async () => 'unknown',
        socketConnectable: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(check(report, 'daemon').status).toBe('ok');
  });

  it('warns for a real listener that accepts and never replies (WR-03)', async () => {
    const { createServer } = await import('node:net');
    const { pingDaemonFetchCap, tryConnect } = await import('../src/daemon/bootstrap.js');
    const sockDir = mkdtempSync('/tmp/qq-dr-');
    const socketPath = join(sockDir, 's.sock');
    const held: import('node:net').Socket[] = [];
    const server = createServer((conn) => {
      held.push(conn);
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    try {
      const report = await runDoctorChecks(
        healthyDeps({ socketPath, pingDaemon: pingDaemonFetchCap, socketConnectable: tryConnect }),
      );
      expect(check(report, 'daemon').status).toBe('warn');
    } finally {
      for (const conn of held) conn.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sockDir, { recursive: true, force: true });
    }
  });

  it('does not probe the connection when the ping answered', async () => {
    const socketConnectable = vi.fn(async () => true);
    await runDoctorChecks(healthyDeps({ socketConnectable }));
    expect(socketConnectable).not.toHaveBeenCalled();
  });

  it('warns when the daemon is outdated', async () => {
    const report = await runDoctorChecks(healthyDeps({ pingDaemon: async () => 'no' }));
    expect(check(report, 'daemon').status).toBe('warn');
  });

  it('warns for Node below 24', async () => {
    const report = await runDoctorChecks(healthyDeps({ nodeVersion: '22.11.0' }));
    expect(check(report, 'node').status).toBe('warn');
    expect(doctorExitCode(report)).toBe(0);
  });
});

const CANARY_INSTALL_ID = '0f0e0d0c-0b0a-4908-8706-050403020100';

describe('runDoctorChecks: telemetry (D-18, never a blocker)', () => {
  type TelemetryStatus = ReturnType<DoctorDeps['telemetryStatus']>;
  const off = { enabled: false, asked: false };
  const on = { enabled: true, asked: true, installId: CANARY_INSTALL_ID };

  async function telemetryRow(status: TelemetryStatus) {
    const report = await runDoctorChecks(healthyDeps({ telemetryStatus: () => status }));
    return check(report, 'telemetry');
  }

  it('says off, not asked yet, for a fresh install', async () => {
    const row = await telemetryRow({ blockedBy: null, state: off, keyPresent: false });
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('telemetry off (not asked yet)');
  });

  it('says plain off once the user declined', async () => {
    const row = await telemetryRow({
      blockedBy: null,
      state: { enabled: false, asked: true },
      keyPresent: true,
    });
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('telemetry off');
  });

  it('names DO_NOT_TRACK when it blocks telemetry, even if the config says on', async () => {
    const row = await telemetryRow({ blockedBy: 'DO_NOT_TRACK', state: on, keyPresent: true });
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('telemetry off (DO_NOT_TRACK is set)');
  });

  it('names QQ_TELEMETRY and CI by name only', async () => {
    const qq = await telemetryRow({ blockedBy: 'QQ_TELEMETRY', state: off, keyPresent: true });
    expect(qq.summary).toBe('telemetry off (QQ_TELEMETRY is set)');
    const ci = await telemetryRow({ blockedBy: 'CI', state: on, keyPresent: true });
    expect(ci.summary).toBe('telemetry off (CI is set)');
  });

  it('says on when enabled with a project key', async () => {
    const row = await telemetryRow({ blockedBy: null, state: on, keyPresent: true });
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('telemetry on');
  });

  it('says nothing is sent when enabled in a build without a project key', async () => {
    const row = await telemetryRow({ blockedBy: null, state: on, keyPresent: false });
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('telemetry on (no project key in this build: nothing is sent)');
  });

  it('treats enabled without an install id as off', async () => {
    const row = await telemetryRow({
      blockedBy: null,
      state: { enabled: true, asked: true },
      keyPresent: true,
    });
    expect(row.summary).toBe('telemetry off');
  });

  it('stays ok when the state cannot be read', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        telemetryStatus: () => {
          throw new Error('canary-telemetry-error');
        },
      }),
    );
    expect(check(report, 'telemetry').status).toBe('ok');
    expect(JSON.stringify(report)).not.toContain('canary-telemetry-error');
  });

  it('never changes the exit code', async () => {
    const healthy = await runDoctorChecks(
      healthyDeps({
        telemetryStatus: () => ({ blockedBy: 'CI', state: on, keyPresent: false }),
      }),
    );
    expect(doctorExitCode(healthy)).toBe(0);
    const blocked = await runDoctorChecks(
      healthyDeps({
        probeTmp: () => false,
        telemetryStatus: () => ({ blockedBy: null, state: on, keyPresent: true }),
      }),
    );
    expect(doctorExitCode(blocked)).toBe(1);
    expect(check(blocked, 'telemetry').status).toBe('ok');
  });
});

describe('runDoctorChecks: report contract', () => {
  it('gives every warn and fail line a one-line hint (D-18)', async () => {
    const report = await runDoctorChecks(
      healthyDeps({
        env: { LANG: 'C' },
        which: () => null,
        probeTmp: () => false,
        socketOwner: () => 0,
        pingDaemon: async () => 'no',
        readRc: () => null,
        shellBindings: async () => null,
        nodeVersion: '20.0.0',
        detectProvider: async () => ({ kind: 'none', message: 'x' }),
      }),
    );
    const problems = report.checks.filter((c) => c.status !== 'ok');
    expect(problems.length).toBeGreaterThan(8);
    for (const c of problems) {
      expect(c.hint, c.id).toBeTruthy();
      expect(c.hint, c.id).not.toContain('\n');
    }
  });

  it('sets ok to "no check failed" and doctorExitCode to 1 exactly then', () => {
    const base: DoctorReport = {
      version: 1,
      ok: true,
      qqVersion: '0.7.0',
      platform: 'linux',
      checks: [{ id: 'term', status: 'warn', summary: 's', hint: 'h' }],
    };
    expect(doctorExitCode(base)).toBe(0);
    expect(
      doctorExitCode({ ...base, ok: false, checks: [{ id: 'jq', status: 'fail', summary: 's' }] }),
    ).toBe(1);
  });

  it('rejects unknown check ids and extra keys', () => {
    const bad = { version: 1, ok: true, qqVersion: 'x', platform: 'linux', checks: [], extra: 1 };
    expect(doctorReportSchema.safeParse(bad).success).toBe(false);
    const badId = {
      version: 1,
      ok: true,
      qqVersion: 'x',
      platform: 'linux',
      checks: [{ id: 'nope', status: 'ok', summary: 's' }],
    };
    expect(doctorReportSchema.safeParse(badId).success).toBe(false);
  });
});

describe('runDoctorChecks: no leaks (T-10-07)', () => {
  it('never puts environment values, the home directory or file contents in the report', async () => {
    const env = {
      ANTHROPIC_API_KEY: 'sk-ant-canary-123',
      QQ_DOCTOR_CANARY: 'canary-value-xyz',
      TERM: 'canary-term',
      LANG: 'canary-locale',
      PATH: '/home/canary-user/bin',
    };
    const reports = await Promise.all([
      runDoctorChecks(healthyDeps({ env, homeDir: '/home/canary-user' })),
      runDoctorChecks(
        healthyDeps({
          env,
          homeDir: '/home/canary-user',
          readRc: () => 'export SECRET=canary-zshrc-content\n',
          loadProviderPin: () => ({
            kind: 'invalid',
            path: '/home/canary-user/.config/qq/provider.json',
            message: 'unknown key canary-pin-key',
          }),
        }),
      ),
      runDoctorChecks(
        healthyDeps({
          env,
          homeDir: '/home/canary-user',
          detectProvider: async () => ({ kind: 'none', message: 'canary-detect-message' }),
        }),
      ),
      runDoctorChecks(
        healthyDeps({
          env: { ...env, DO_NOT_TRACK: 'canary-dnt-value' },
          homeDir: '/home/canary-user',
          telemetryStatus: () => ({
            blockedBy: 'DO_NOT_TRACK',
            state: { enabled: true, asked: true, installId: CANARY_INSTALL_ID },
            keyPresent: true,
          }),
        }),
      ),
      runDoctorChecks(
        healthyDeps({
          env,
          homeDir: '/home/canary-user',
          telemetryStatus: () => ({
            blockedBy: null,
            state: { enabled: true, asked: true, installId: CANARY_INSTALL_ID },
            keyPresent: true,
          }),
        }),
      ),
    ]);
    for (const report of reports) {
      const json = JSON.stringify(report);
      expect(json).not.toContain(CANARY_INSTALL_ID);
      expect(json).not.toContain('canary-dnt-value');
      expect(json).not.toContain('sk-ant-canary-123');
      expect(json).not.toContain('canary-value-xyz');
      expect(json).not.toContain('/home/canary-user');
      expect(json).not.toContain('canary-term');
      expect(json).not.toContain('canary-locale');
      expect(json).not.toContain('canary-zshrc-content');
      expect(json).not.toContain('canary-pin-key');
      expect(json).not.toContain('canary-detect-message');
    }
  });
});

describe('parseZshBindings', () => {
  it('reads the widget after each marker and ignores other ~/.zshrc output', () => {
    const out =
      'welcome banner\n__qq_emacs__ "?" qq-question-widget\n__qq_viins__ "?" self-insert\n';
    expect(parseZshBindings(out)).toEqual(zshBound('qq-question-widget', 'self-insert'));
  });

  it('returns null widgets for marker lines without a binding', () => {
    expect(parseZshBindings('__qq_emacs__ \n__qq_viins__ garbage\n')).toEqual(zshBound(null, null));
  });

  it('returns null when no marker line appeared', () => {
    expect(parseZshBindings('"?" qq-question-widget\n')).toBeNull();
  });
});

describe('defaultDoctorDeps (real machine, read-only)', () => {
  it('reads the zsh version with stdin closed', async () => {
    const version = await defaultDoctorDeps().shellVersion('zsh');
    expect(version).toMatch(/^\d+\.\d+/);
  });

  it('reads a bash version with stdin closed, without rc files', async () => {
    const version = await defaultDoctorDeps().shellVersion('bash');
    expect(version).toMatch(/^\d+\.\d+/);
  });

  it('finds node on PATH and probes /tmp', () => {
    const deps = defaultDoctorDeps();
    expect(deps.which('node')).not.toBeNull();
    expect(deps.which('definitely-not-a-qq-binary')).toBeNull();
    expect(deps.probeTmp()).toBe(true);
  });

  it('reads the telemetry state from QQ_CONFIG_FILE and the gates from the environment', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-doctor-tel-'));
    try {
      vi.stubEnv('QQ_CONFIG_FILE', join(dir, 'config.json'));
      vi.stubEnv('DO_NOT_TRACK', '1');
      vi.stubEnv('QQ_TELEMETRY_KEY', '');
      const status = defaultDoctorDeps().telemetryStatus();
      expect(status.blockedBy).toBe('DO_NOT_TRACK');
      expect(status.state).toEqual({ enabled: false, asked: false });
      // vitest bakes an empty key (D-22), so the build has no project key.
      expect(status.keyPresent).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('formatDoctorReport', () => {
  const zshOk: DoctorCheck = { id: 'zsh', status: 'ok', summary: 'zsh 5.9' };
  const jqFail: DoctorCheck = {
    id: 'jq',
    status: 'fail',
    summary: 'jq not found on PATH',
    hint: 'install jq',
  };
  const termWarn: DoctorCheck = {
    id: 'term',
    status: 'warn',
    summary: 'TERM is dumb',
    hint: 'set TERM',
  };
  const report: DoctorReport = {
    version: 1,
    ok: false,
    qqVersion: '0.7.0',
    platform: 'linux',
    checks: [zshOk, jqFail, termWarn],
  };

  it('prints one marked line per check and a hint suffix on warn and fail lines', () => {
    const lines = formatDoctorReport(report).trimEnd().split('\n');
    expect(lines).toEqual([
      '✓ zsh 5.9',
      '✗ jq not found on PATH — fix: install jq',
      '⚠ TERM is dumb — fix: set TERM',
      'qq doctor: 2 problems found',
    ]);
  });

  it('says no problems found when every check is ok', () => {
    const clean = { ...report, ok: true, checks: [zshOk] };
    expect(formatDoctorReport(clean)).toBe('✓ zsh 5.9\nqq doctor: no problems found\n');
  });

  it('uses the singular for one problem', () => {
    const one = { ...report, checks: [zshOk, termWarn] };
    expect(formatDoctorReport(one)).toContain('qq doctor: 1 problem found');
  });
});

describe('doctorCommand', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  function captureStdout(): () => string {
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      out += String(chunk);
      return true;
    });
    return () => out;
  }

  it('prints the checklist and leaves exit code 0 on a healthy machine', async () => {
    const output = captureStdout();
    await doctorCommand({}, healthyDeps());
    expect(output()).toContain('✓ zsh 5.9');
    expect(output()).toContain('qq doctor: no problems found');
    expect(process.exitCode).toBe(0);
  });

  it('prints JSON that parses with doctorReportSchema for --json', async () => {
    const output = captureStdout();
    await doctorCommand({ json: true }, healthyDeps());
    const parsed = doctorReportSchema.parse(JSON.parse(output()));
    expect(parsed.checks).toHaveLength(12);
    expect(output().endsWith('\n')).toBe(true);
  });

  it('sets exit code 1 for a hard blocker', async () => {
    captureStdout();
    await doctorCommand({}, healthyDeps({ probeTmp: () => false }));
    expect(process.exitCode).toBe(1);
  });

  it('keeps exit code 0 when only warnings are present', async () => {
    captureStdout();
    await doctorCommand(
      { json: true },
      healthyDeps({ detectProvider: async () => ({ kind: 'none', message: 'x' }) }),
    );
    expect(process.exitCode).toBe(0);
  });
});

describe('DOCTOR_CHECK_IDS (add, never rename)', () => {
  it('keeps the Phase 10 ids first and appends bash, fish and bash_profile', () => {
    expect(DOCTOR_CHECK_IDS.slice(0, 12)).toEqual(ZSH_IDS);
    expect(DOCTOR_CHECK_IDS.slice(12)).toEqual(['bash', 'fish', 'bash_profile']);
  });
});

/** A healthy machine whose login shell is bash (`$SHELL`). */
function bashDeps(overrides: Partial<DoctorDeps> = {}): DoctorDeps {
  return healthyDeps({ env: { ...healthyDeps().env, SHELL: '/usr/local/bin/bash' }, ...overrides });
}

describe('runDoctorChecks: target shell (D-08, D-02)', () => {
  it('a bash target on linux has twelve rows starting with bash, all ok', async () => {
    const report = await runDoctorChecks(healthyDeps(), { shell: 'bash' });
    expect(report.checks.map((c) => c.id)).toEqual(BASH_LINUX_IDS);
    expect(report.checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('a bash target on darwin adds bash_profile after integration', async () => {
    const report = await runDoctorChecks(healthyDeps({ platform: 'darwin' }), { shell: 'bash' });
    expect(report.checks.map((c) => c.id)).toEqual(BASH_DARWIN_IDS);
    expect(report.checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('a zsh target on darwin has no bash_profile row', async () => {
    const report = await runDoctorChecks(healthyDeps({ platform: 'darwin' }));
    expect(report.checks.map((c) => c.id)).toEqual(ZSH_IDS);
  });

  it('options.shell wins over $SHELL', async () => {
    const report = await runDoctorChecks(bashDeps(), { shell: 'zsh' });
    expect(report.checks[0]?.id).toBe('zsh');
  });

  it('picks bash from SHELL=/usr/local/bin/bash', async () => {
    const report = await runDoctorChecks(bashDeps());
    expect(report.checks[0]?.id).toBe('bash');
  });

  it('falls back to the passwd shell when SHELL is /bin/sh', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ env: { ...healthyDeps().env, SHELL: '/bin/sh' }, userShell: '/bin/zsh' }),
    );
    expect(report.checks[0]?.id).toBe('zsh');
  });

  it('uses the passwd bash when SHELL is unset', async () => {
    const report = await runDoctorChecks(healthyDeps({ userShell: '/opt/local/bin/bash' }));
    expect(report.checks[0]?.id).toBe('bash');
  });

  it('targets zsh when SHELL is fish (not shipped yet)', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ env: { ...healthyDeps().env, SHELL: '/usr/bin/fish' } }),
    );
    expect(report.checks[0]?.id).toBe('zsh');
    expect(report.checks.some((c) => c.id === 'fish')).toBe(false);
  });

  it('probes the target shell for its version, bindings and rc file', async () => {
    const shellVersion = vi.fn(async () => '5.2.21(1)-release');
    const shellBindings = vi.fn(async () => bashBound());
    const readRc = vi.fn((relPath: string) => HEALTHY_RC[relPath] ?? null);
    await runDoctorChecks(healthyDeps({ shellVersion, shellBindings, readRc }), { shell: 'bash' });
    expect(shellVersion).toHaveBeenCalledWith('bash');
    expect(shellBindings).toHaveBeenCalledWith('bash');
    expect(readRc).toHaveBeenCalledWith('.bashrc');
    expect(readRc).not.toHaveBeenCalledWith('.zshrc');
  });
});

describe('runDoctorChecks: bash version (D-12)', () => {
  async function bashRow(version: string | null, which?: DoctorDeps['which']) {
    const report = await runDoctorChecks(
      healthyDeps({ shellVersion: async () => version, ...(which ? { which } : {}) }),
      { shell: 'bash' },
    );
    return { report, row: check(report, 'bash') };
  }

  it('fails when bash is not on PATH, exit 1', async () => {
    const { report, row } = await bashRow('5.3.3(1)-release', (name) =>
      name === 'bash' ? null : `/usr/bin/${name}`,
    );
    expect(row.status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('fails for bash 3.2.57 naming 3.2 and the 5.0 floor', async () => {
    const { report, row } = await bashRow('3.2.57(1)-release');
    expect(row.status).toBe('fail');
    expect(row.summary).toContain('3.2');
    expect(row.summary).toContain('5.0');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('fails for bash 4.4.20', async () => {
    const { row } = await bashRow('4.4.20(1)-release');
    expect(row.status).toBe('fail');
  });

  it('warns for bash 5.0.18 (untested, bracketed paste off by default)', async () => {
    const { report, row } = await bashRow('5.0.18(1)-release');
    expect(row.status).toBe('warn');
    expect(row.summary).toContain('bracketed paste');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('passes for bash 5.1.16', async () => {
    const { row } = await bashRow('5.1.16(1)-release');
    expect(row.status).toBe('ok');
  });

  it('passes for bash 5.3.3 and prints major.minor.patch only', async () => {
    const { row } = await bashRow('5.3.3(1)-release');
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('bash 5.3.3');
  });

  it('never prints the build suffix', async () => {
    for (const raw of ['3.2.57(1)-release', '5.0.18(1)-release', '5.2.21(1)-release']) {
      const { row } = await bashRow(raw);
      expect(row.summary).not.toContain('(1)');
      expect(row.summary).not.toContain('release');
    }
  });

  it('gives a brew hint on darwin', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ platform: 'darwin', shellVersion: async () => '3.2.57(1)-release' }),
      { shell: 'bash' },
    );
    expect(check(report, 'bash').hint).toContain('brew install bash');
  });
});

describe('runDoctorChecks: bash integration and macOS login file (D-09)', () => {
  it('is ok when ~/.bashrc sources the adapter', async () => {
    const report = await runDoctorChecks(healthyDeps(), { shell: 'bash' });
    expect(check(report, 'integration').status).toBe('ok');
    expect(check(report, 'integration').summary).toBe('~/.bashrc loads QueQue');
  });

  it('warns with the bash init hint when ~/.bashrc does not load QueQue', async () => {
    const report = await runDoctorChecks(
      healthyDeps({ readRc: (relPath) => (relPath === '.bashrc' ? 'alias ll=ls\n' : null) }),
      { shell: 'bash' },
    );
    expect(check(report, 'integration').status).toBe('warn');
    expect(check(report, 'integration').hint).toContain('qq init bash && source ~/.bashrc');
  });

  function darwinBash(rc: Record<string, string>) {
    return runDoctorChecks(
      healthyDeps({ platform: 'darwin', readRc: (relPath) => rc[relPath] ?? null }),
      { shell: 'bash' },
    );
  }

  it('bash_profile is ok when ~/.bash_profile sources ~/.bashrc', async () => {
    const report = await darwinBash(HEALTHY_RC);
    expect(check(report, 'bash_profile').status).toBe('ok');
  });

  it('bash_profile warns naming ~/.bash_profile when it skips ~/.bashrc', async () => {
    const report = await darwinBash({ ...HEALTHY_RC, '.bash_profile': 'export PATH\n' });
    const row = check(report, 'bash_profile');
    expect(row.status).toBe('warn');
    expect(row.summary).toContain('~/.bash_profile');
    expect(row.hint).toBe('add [ -f ~/.bashrc ] && . ~/.bashrc to ~/.bash_profile');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('bash_profile names ~/.profile when that is the first login file', async () => {
    const report = await darwinBash({ '.bashrc': HEALTHY_RC['.bashrc'] ?? '', '.profile': 'x\n' });
    expect(check(report, 'bash_profile').summary).toContain('~/.profile');
  });

  it('bash_profile warns when no login file exists', async () => {
    const report = await darwinBash({ '.bashrc': HEALTHY_RC['.bashrc'] ?? '' });
    const row = check(report, 'bash_profile');
    expect(row.status).toBe('warn');
    expect(row.hint).toBe('add [ -f ~/.bashrc ] && . ~/.bashrc to ~/.bash_profile');
  });

  it('reads ~/.bashrc and the login file through readRc only', async () => {
    const readRc = vi.fn((relPath: string) => HEALTHY_RC[relPath] ?? null);
    await runDoctorChecks(healthyDeps({ platform: 'darwin', readRc }), { shell: 'bash' });
    expect(readRc.mock.calls.map(([p]) => p)).toEqual(
      expect.arrayContaining(['.bashrc', '.bash_profile']),
    );
  });

  it('has no bash_profile row on linux', async () => {
    const report = await runDoctorChecks(healthyDeps({ readRc: () => null }), { shell: 'bash' });
    expect(report.checks.some((c) => c.id === 'bash_profile')).toBe(false);
  });
});

describe('runDoctorChecks: bash binding', () => {
  async function bindingRow(bindings: ShellBindings | null) {
    const report = await runDoctorChecks(healthyDeps({ shellBindings: async () => bindings }), {
      shell: 'bash',
    });
    return check(report, 'binding');
  }

  it('is ok when ? runs _qq_question in emacs and vi-insert with paste on', async () => {
    const row = await bindingRow(bashBound());
    expect(row.status).toBe('ok');
    expect(row.summary).toBe('? is bound to _qq_question in emacs and vi-insert');
  });

  it('warns naming self-insert when vi-insert does not run QueQue', async () => {
    const row = await bindingRow(
      bashBound({ keymaps: { emacs: '_qq_question', 'vi-insert': 'self-insert' } }),
    );
    expect(row.status).toBe('warn');
    expect(row.summary).toContain('self-insert');
    expect(row.summary).toContain('vi-insert');
  });

  it('warns with the inputrc hint when bracketed paste is off', async () => {
    const row = await bindingRow(bashBound({ bracketedPaste: false }));
    expect(row.status).toBe('warn');
    expect(row.hint).toContain('set enable-bracketed-paste on');
    expect(row.hint).toContain('~/.inputrc');
  });

  it('warns that ble.sh replaces readline when it is loaded', async () => {
    const row = await bindingRow(bashBound({ bleLoaded: true }));
    expect(row.status).toBe('warn');
    expect(row.summary).toContain('ble.sh');
  });

  it('warns when the bindings cannot be read', async () => {
    const row = await bindingRow(null);
    expect(row.status).toBe('warn');
    expect(row.summary).toContain('interactive bash');
  });

  it('skips the probe (warn) when the version check failed', async () => {
    const shellBindings = vi.fn(async () => bashBound());
    const report = await runDoctorChecks(
      healthyDeps({ shellVersion: async () => '3.2.57(1)-release', shellBindings }),
      { shell: 'bash' },
    );
    expect(check(report, 'binding').status).toBe('warn');
    expect(shellBindings).not.toHaveBeenCalled();
  });

  it('skips the probe when the bash version cannot be read', async () => {
    const shellBindings = vi.fn(async () => bashBound());
    await runDoctorChecks(healthyDeps({ shellVersion: async () => null, shellBindings }), {
      shell: 'bash',
    });
    expect(shellBindings).not.toHaveBeenCalled();
  });
});

describe('parseBashBindings', () => {
  const ESC = String.fromCharCode(27);

  it('reads both keymaps, paste and ble from marker lines and ignores readline noise', () => {
    const out = [
      `${ESC}[?1034hwelcome to bash`,
      '__qq_emacs__ "?" "_qq_question"',
      '__qq_vi-insert__ "?": "_qq_question"',
      '__qq_paste__ set enable-bracketed-paste on',
      '__qq_ble__ ',
      '',
    ].join('\n');
    expect(parseBashBindings(out)).toEqual(bashBound());
  });

  it('reads a readline function from the bind -p fallback', () => {
    const out = '__qq_emacs__ "?" "_qq_question"\n__qq_vi-insert__ "?": self-insert\n';
    expect(parseBashBindings(out)?.keymaps['vi-insert']).toBe('self-insert');
  });

  it('reads a marker that follows a readline escape on the same line', () => {
    const out = `__qq_emacs__ \n${ESC}[?1034h__qq_paste__ set enable-bracketed-paste off\n`;
    expect(parseBashBindings(out)?.bracketedPaste).toBe(false);
  });

  it('marks ble.sh loaded for any BLE_VERSION value', () => {
    expect(parseBashBindings('__qq_ble__ 0.4.0-devel3\n')?.bleLoaded).toBe(true);
  });

  it('returns null keymaps and unknown paste for empty markers', () => {
    expect(parseBashBindings('__qq_emacs__ \n__qq_vi-insert__ \n__qq_paste__ \n')).toEqual({
      keymaps: { emacs: null, 'vi-insert': null },
      bracketedPaste: null,
      bleLoaded: false,
    });
  });

  it('returns null when no marker line appeared', () => {
    expect(parseBashBindings('"?" "_qq_question"\n')).toBeNull();
  });

  it('the probe script prints every marker with builtins only', () => {
    for (const marker of ['__qq_%s__', '__qq_paste__', '__qq_ble__']) {
      expect(BASH_BINDINGS_SCRIPT).toContain(marker);
    }
    expect(BASH_BINDINGS_SCRIPT).toContain('emacs vi-insert');
    expect(BASH_BINDINGS_SCRIPT).toContain('-X');
    expect(BASH_BINDINGS_SCRIPT).toContain('enable-bracketed-paste');
  });
});

describe('runDoctorChecks: no leaks for a bash target (T-11-25)', () => {
  it('never prints HOME, the SHELL path, rc content or the build string', async () => {
    const env = {
      HOME: '/home/canary-user',
      SHELL: '/opt/canary/bin/bash',
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      PATH: '/opt/canary/bin:/usr/bin',
    };
    const variants: Partial<DoctorDeps>[] = [
      {},
      { readRc: () => 'export SECRET=canary-rc-xyz\n' },
      { shellBindings: async () => bashBound({ bracketedPaste: false, bleLoaded: true }) },
      { shellVersion: async () => '3.2.57(1)-release' },
      { shellVersion: async () => '5.0.18(1)-release' },
    ];
    for (const variant of variants) {
      const report = await runDoctorChecks(
        healthyDeps({
          env,
          homeDir: '/home/canary-user',
          platform: 'darwin',
          readRc: (relPath) => `export SECRET=canary-rc-xyz\n${HEALTHY_RC[relPath] ?? ''}`,
          shellVersion: async () => '5.2.21(1)-release',
          ...variant,
        }),
      );
      expect(report.checks[0]?.id).toBe('bash');
      for (const text of [JSON.stringify(report), formatDoctorReport(report)]) {
        expect(text).not.toContain('canary-user');
        expect(text).not.toContain('/opt/canary');
        expect(text).not.toContain('canary-rc-xyz');
        expect(text).not.toContain('(1)-release');
      }
    }
  });
});
