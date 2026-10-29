import { readFileSync } from 'node:fs';
import type { z } from 'zod';
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
 * PRETTY_NAME), the zsh version is cut to major.minor, node to its major. Nothing else from
 * the environment is read. The daemon dedupes repeats per install.
 */
export type EnvironmentShape = z.infer<typeof environmentPayloadSchema>;

export interface EnvironmentShapeInput {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  nodeVersion?: string;
  /** The text of /etc/os-release, or null when it cannot be read. */
  readOsRelease?: () => string | null;
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

/** `5.9` → `5.9`, `5.8.1` → `5.8`, anything not starting with digits.digits → `unknown`. */
function zshMajorMinor(version: string | undefined): string {
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
  const result = environmentPayloadSchema.safeParse({
    os,
    arch: archKind(input.arch ?? process.arch),
    distro,
    // The widget exports QQ_ZSH_VERSION="$ZSH_VERSION"; $ZSH_VERSION itself is not exported.
    zsh: zshMajorMinor(env.QQ_ZSH_VERSION),
    node_major: major,
    zellij: env.ZELLIJ !== undefined,
  });
  return result.success ? result.data : null;
}
