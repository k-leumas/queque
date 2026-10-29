import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type DoctorDeps,
  defaultDoctorDeps,
  doctorCommand,
  formatDoctorReport,
  parseZshBindings,
  runDoctorChecks,
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
    zshVersion: async () => '5.9',
    zshBindings: async () => ({ emacs: 'qq-question-widget', viins: 'qq-question-widget' }),
    readZshrc: () => 'source "/opt/homebrew/share/queque/queque.zsh"\n',
    probeTmp: () => true,
    socketOwner: () => 501,
    pingDaemon: async () => 'yes',
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
    expect(report.checks.map((c) => c.id)).toEqual([...DOCTOR_CHECK_IDS]);
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
    const report = await runDoctorChecks(healthyDeps({ zshVersion: async () => '4.3.17' }));
    expect(check(report, 'zsh').status).toBe('fail');
    expect(doctorExitCode(report)).toBe(1);
  });

  it('warns for zsh 5.3 (untested) and still exits 0', async () => {
    const report = await runDoctorChecks(healthyDeps({ zshVersion: async () => '5.3' }));
    expect(check(report, 'zsh').status).toBe('warn');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('passes for zsh 5.8.1', async () => {
    const report = await runDoctorChecks(healthyDeps({ zshVersion: async () => '5.8.1' }));
    expect(check(report, 'zsh').status).toBe('ok');
  });

  it('passes for zsh 5.9', async () => {
    const report = await runDoctorChecks(healthyDeps({ zshVersion: async () => '5.9' }));
    expect(check(report, 'zsh').status).toBe('ok');
  });

  it('warns when zsh is on PATH but its version cannot be read', async () => {
    const report = await runDoctorChecks(healthyDeps({ zshVersion: async () => null }));
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
        zshBindings: async () => ({ emacs: 'qq-question-widget', viins: 'self-insert' }),
      }),
    );
    expect(check(report, 'binding').status).toBe('warn');
    expect(check(report, 'binding').summary).toContain('self-insert');
    expect(doctorExitCode(report)).toBe(0);
  });

  it('warns when the bindings cannot be read', async () => {
    const report = await runDoctorChecks(healthyDeps({ zshBindings: async () => null }));
    expect(check(report, 'binding').status).toBe('warn');
  });

  it('warns when ~/.zshrc does not load QueQue', async () => {
    const report = await runDoctorChecks(healthyDeps({ readZshrc: () => null }));
    expect(check(report, 'integration').status).toBe('warn');
    expect(check(report, 'integration').hint).toContain('qq init zsh && source ~/.zshrc');
  });

  it('is ok with "starts on the next ??" when the daemon is not answering', async () => {
    const report = await runDoctorChecks(healthyDeps({ pingDaemon: async () => 'unknown' }));
    expect(check(report, 'daemon').status).toBe('ok');
    expect(check(report, 'daemon').summary).toContain('starts on the next ??');
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
        readZshrc: () => null,
        zshBindings: async () => null,
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
          readZshrc: () => 'export SECRET=canary-zshrc-content\n',
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
    expect(parseZshBindings(out)).toEqual({ emacs: 'qq-question-widget', viins: 'self-insert' });
  });

  it('returns null widgets for marker lines without a binding', () => {
    expect(parseZshBindings('__qq_emacs__ \n__qq_viins__ garbage\n')).toEqual({
      emacs: null,
      viins: null,
    });
  });

  it('returns null when no marker line appeared', () => {
    expect(parseZshBindings('"?" qq-question-widget\n')).toBeNull();
  });
});

describe('defaultDoctorDeps (real machine, read-only)', () => {
  it('reads the zsh version with stdin closed', async () => {
    const version = await defaultDoctorDeps().zshVersion();
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
    expect(parsed.checks).toHaveLength(DOCTOR_CHECK_IDS.length);
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
