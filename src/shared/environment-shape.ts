import type { z } from 'zod';
import type { environmentPayloadSchema } from '../contracts/telemetry.js';

/** The `qq_environment` payload: enums, zsh major.minor, node major and a Zellij flag. */
export type EnvironmentShape = z.infer<typeof environmentPayloadSchema>;

export interface EnvironmentShapeInput {
  env?: NodeJS.ProcessEnv;
  platform?: string;
  arch?: string;
  nodeVersion?: string;
  /** The text of /etc/os-release, or null when it cannot be read. */
  readOsRelease?: () => string | null;
}

export function collectEnvironmentShape(
  _input: EnvironmentShapeInput = {},
): EnvironmentShape | null {
  throw new Error('collectEnvironmentShape is not implemented yet');
}
