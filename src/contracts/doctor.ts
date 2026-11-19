import { z } from 'zod';

/**
 * `qq doctor --json` contract (D-18).
 *
 * The distro smoke asserts this shape and the auto-revert PR body embeds it, so it is
 * versioned and strict. Check ids are stable: add new ids, never rename or remove one.
 * The JSON is pasted into public PR bodies and bug reports, so every string is fixed copy
 * (plus versions, the socket path, a widget name or the literals `~/.zshrc`, `~/.bashrc`,
 * `~/.bash_profile`, `~/.bash_login`, `~/.profile` and `~/.inputrc`), never an environment
 * value, key material, a path under the home directory or file content. The `update` row
 * may also carry version numbers, a fixed upgrade command or the install marker's validated
 * upgrade text (printable ASCII, 120 chars max), never a path or an environment value.
 *
 * One report targets one shell (Phase 11): its version row is `zsh` or `bash`, and
 * `bash_profile` appears only for bash on macOS. `fish` is reserved for Phase 12 and not
 * emitted yet, so a report never has one row per id.
 */
export const DOCTOR_CHECK_IDS = [
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
  'bash',
  'fish',
  'bash_profile',
  'update',
] as const;

export const DOCTOR_STATUSES = ['ok', 'warn', 'fail'] as const;

export const DOCTOR_PLATFORMS = ['darwin', 'linux', 'other'] as const;

/** Longest summary or hint; a cap so no check can paste a large blob into a PR body. */
export const DOCTOR_TEXT_MAX = 200;

export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];
export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];
export type DoctorPlatform = (typeof DOCTOR_PLATFORMS)[number];

export const doctorCheckSchema = z.strictObject({
  id: z.enum(DOCTOR_CHECK_IDS),
  status: z.enum(DOCTOR_STATUSES),
  summary: z.string().max(DOCTOR_TEXT_MAX),
  hint: z.string().max(DOCTOR_TEXT_MAX).optional(),
});

export const doctorReportSchema = z.strictObject({
  version: z.literal(1),
  ok: z.boolean(),
  qqVersion: z.string(),
  platform: z.enum(DOCTOR_PLATFORMS),
  checks: z.array(doctorCheckSchema),
});

export type DoctorCheck = z.infer<typeof doctorCheckSchema>;
export type DoctorReport = z.infer<typeof doctorReportSchema>;

/**
 * Exit code for a report (D-17): 1 exactly when a check failed (a hard blocker that makes
 * `??` impossible), 0 otherwise. Warnings never change the exit code.
 */
export function doctorExitCode(report: DoctorReport): 0 | 1 {
  return report.checks.some((check) => check.status === 'fail') ? 1 : 0;
}
