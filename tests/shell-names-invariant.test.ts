/**
 * SHELL_NAMES invariant (Phase 11 D-02, the "promote" decision): every shell QueQue knows must
 * round-trip through the request contract, the per-shell registry, the telemetry allow list and
 * the doctor check ids. A new shell must pass this test before it ships: Phase 12 adds fish's
 * adapter at shell/fish/queque.fish, flips `SHELL_SPECS.fish.shipped` to true and adds 'fish'
 * to the shipped list below. The adapter contract is shell/README.md.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DOCTOR_CHECK_IDS } from '../src/contracts/doctor.js';
import { SHELL_NAMES, shellRequestSchema } from '../src/contracts/shell.js';
import { SHELL_KINDS } from '../src/contracts/telemetry.js';
import { SHELL_SPECS, shippedShellNames } from '../src/shared/shell-registry.js';

const ROOT = resolve(__dirname, '..');

const baseRequest = {
  version: 1,
  ttyPath: '/dev/tty',
  cwd: '/tmp',
  shellPid: 4242,
  lbuffer: 'list files',
  rbuffer: '',
} as const;

describe('SHELL_NAMES invariant', () => {
  it.each(SHELL_NAMES)('%s parses as the request shell', (name) => {
    expect(shellRequestSchema.parse({ ...baseRequest, shell: name }).shell).toBe(name);
  });

  it.each(SHELL_NAMES)('%s has a SHELL_SPECS entry for itself', (name) => {
    expect(SHELL_SPECS[name]?.shell).toBe(name);
  });

  it.each(SHELL_NAMES)('%s is in the telemetry SHELL_KINDS allow list', (name) => {
    expect(SHELL_KINDS).toContain(name);
  });

  it.each(SHELL_NAMES)('%s is a doctor check id', (name) => {
    expect(DOCTOR_CHECK_IDS).toContain(name);
  });

  it('SHELL_KINDS lists exactly SHELL_NAMES, in the same order', () => {
    expect([...SHELL_KINDS]).toEqual([...SHELL_NAMES]);
  });

  it('SHELL_SPECS has exactly one entry per SHELL_NAMES entry', () => {
    expect(new Set(Object.keys(SHELL_SPECS))).toEqual(new Set(SHELL_NAMES));
    expect(Object.keys(SHELL_SPECS)).toHaveLength(SHELL_NAMES.length);
  });

  it('the shipped shells are exactly zsh and bash (add fish when Phase 12 ships)', () => {
    expect(shippedShellNames()).toEqual(['zsh', 'bash']);
  });

  it.each(shippedShellNames())('the %s adapter file exists under shell/<name>/', (name) => {
    const adapter = resolve(ROOT, 'shell', name, SHELL_SPECS[name].adapterFile);
    expect(existsSync(adapter), `missing ${adapter}`).toBe(true);
  });
});
