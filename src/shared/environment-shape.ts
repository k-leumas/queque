import { readFileSync } from 'node:fs';
import type { z } from 'zod';
import type { ShellName } from '../contracts/shell.js';
import {
  type ArchKind,
  DISTRO_IDS,
  type DistroId,
  environmentPayloadSchema,
  type OsKind,
} from '../contracts/telemetry.js';

/**
 * The `qq_environment` payload (phase 10, D-10): which platforms QueQue runs on, as enums.
 *
 * Every value is mapped onto the allow list in src/contracts/telemetry.ts before it leaves
 * this function: an os-release ID outside DISTRO_IDS becomes `other` (never the raw ID or
 * PRETTY_NAME), the shell version is cut to major.minor (never the `$BASH_VERSION` /
 * `$ZSH_VERSION` build string), node to its major. Nothing else from the environment is read.
 * The daemon dedupes repeats per install.
 */
export type EnvironmentShape = z.infer<typeof environmentPayloadSchema>;

export interface EnvironmentShapeInput {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  nodeVersion?: string;
  /** The text of /etc/os-release, or null when it cannot be read. */
  readOsRelease?: () => string | null;
  /** The request's shell (Phase 11 D-11); absent from zsh widgets older than Phase 11. */
  shell?: ShellName;
  /** The raw `$BASH_VERSION` / `$ZSH_VERSION` from the request; only major.minor is kept. */
  shellVersion?: string;
}

/** Distro ids that can come from an os-release `ID=` line (`macos` is darwin only). */
const LINUX_DISTRO_IDS: ReadonlySet<string> = new Set(
  DISTRO_IDS.filter((id) => id !== 'macos' && id !== 'other'),
);

function defaultReadOsRelease(): string | null {
  try {
    return readFileSync('/etc/os-release', 'utf8');
  } catch {
    return null;
  }
}

function osKind(platform: string): OsKind {
  return platform === 'darwin' || platform === 'linux' ? platform : 'other';
}

function archKind(arch: string): ArchKind {
  return arch === 'x64' || arch === 'arm64' ? arch : 'other';
}

/** The os-release `ID`, unquoted and lowercased, mapped to the enum; `other` otherwise. */
function linuxDistro(osRelease: string | null): DistroId {
  if (osRelease === null) {
    return 'other';
  }
  const match = /^ID=(.*)$/m.exec(osRelease);
  const id = match?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .toLowerCase();
  return id !== undefined && LINUX_DISTRO_IDS.has(id) ? (id as DistroId) : 'other';
}

/**
 * `5.9` → `5.9`, `5.8.1` → `5.8`, `5.2.21(1)-release` → `5.2`; anything not starting with
 * digits.digits → `unknown`. Works for any shell's version string.
 */
export function shellMajorMinor(version: string | undefined): string {
  const match = /^(\d{1,2})\.(\d{1,2})(?![0-9])/.exec(version?.trim() ?? '');
  return match ? `${match[1]}.${match[2]}` : 'unknown';
}

function nodeMajor(version: string): number | null {
  const match = /^v?(\d+)\./.exec(version);
  return match ? Number(match[1]) : null;
}

/**
 * The environment shape, or null when it would not validate (for example a node major
 * outside the schema bound of 18-99): sending nothing beats sending a wrong value.
 */
export function collectEnvironmentShape(
  input: EnvironmentShapeInput = {},
): EnvironmentShape | null {
  const env = input.env ?? process.env;
  const os = osKind(input.platform ?? process.platform);
  const distro: DistroId =
    os === 'darwin'
      ? 'macos'
      : os === 'linux'
        ? linuxDistro((input.readOsRelease ?? defaultReadOsRelease)())
        : 'other';
  const major = nodeMajor(input.nodeVersion ?? process.version);
  if (major === null) {
    return null;
  }
  // D-02 back-compat: only an old zsh widget sends no `shell` (every shipped adapter sends it
  // and the request schema defaults it to zsh), so `unknown` would only mislabel zsh users.
  const shell = input.shell ?? 'zsh';
  // The zsh widget exports QQ_ZSH_VERSION="$ZSH_VERSION"; $ZSH_VERSION itself is not exported.
  const shellVersion = shellMajorMinor(
    input.shellVersion ?? (shell === 'zsh' ? env.QQ_ZSH_VERSION : undefined),
  );
  const result = environmentPayloadSchema.safeParse({
    os,
    arch: archKind(input.arch ?? process.arch),
    distro,
    shell,
    shell_version: shellVersion,
    zsh: shell === 'zsh' ? shellVersion : 'unknown',
    node_major: major,
    zellij: env.ZELLIJ !== undefined,
  });
  return result.success ? result.data : null;
}
