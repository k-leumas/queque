import { randomBytes, randomUUID } from 'node:crypto';
import {
  accessSync,
  chmodSync,
  constants,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defaultConfigPath, telemetryConfigSchema } from './qq-config.js';

/**
 * Anonymous telemetry consent state (phase 10, D-06, D-09).
 *
 * The state lives in the `telemetry` block of ~/.config/qq/config.json (QQ_CONFIG_FILE
 * overrides the path). It is read fresh on every call, never through the per-process
 * cached config loader in qq-config.ts, so a running daemon sees `qq telemetry off`
 * without a restart. Writes touch only the `telemetry` key, keep the value of every other
 * key (the file is re-indented), refuse to replace a file that is not a JSON object, and
 * go through a temp file + rename.
 *
 * The environment gates override the file: DO_NOT_TRACK, QQ_TELEMETRY=0|false|off and CI.
 */

/** Environment variables that turn telemetry off whatever the config says, in priority order. */
export const TELEMETRY_BLOCK_REASONS = ['DO_NOT_TRACK', 'QQ_TELEMETRY', 'CI'] as const;

export type TelemetryBlockReason = (typeof TELEMETRY_BLOCK_REASONS)[number];

export interface TelemetryState {
  enabled: boolean;
  asked: boolean;
  /** Random install UUID, present only while telemetry is enabled (D-06). */
  installId?: string;
}

export type EffectiveTelemetry =
  | { on: true; installId: string }
  | { on: false; reason: TelemetryBlockReason | 'disabled' };

const DEFAULT_STATE: TelemetryState = { enabled: false, asked: false };

/** The config file could not be updated; nothing was changed. */
export class TelemetryConfigWriteError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`queque: cannot update ${path}: ${reason}. No changes made.`);
    this.name = 'TelemetryConfigWriteError';
    this.path = path;
  }
}

function normalized(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

/** A flag variable counts as set unless it is missing, empty, `0` or `false`. */
function flagSet(value: string | undefined): boolean {
  const flag = normalized(value);
  return flag !== undefined && flag !== '' && flag !== '0' && flag !== 'false';
}

/**
 * The environment gate that blocks telemetry, or null (D-09). DO_NOT_TRACK wins over
 * QQ_TELEMETRY, which wins over CI.
 */
export function telemetryBlockedBy(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryBlockReason | null {
  if (flagSet(env.DO_NOT_TRACK)) {
    return 'DO_NOT_TRACK';
  }
  const qqTelemetry = normalized(env.QQ_TELEMETRY);
  if (qqTelemetry === '0' || qqTelemetry === 'false' || qqTelemetry === 'off') {
    return 'QQ_TELEMETRY';
  }
  if (flagSet(env.CI)) {
    return 'CI';
  }
  return null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The consent state, read fresh from the file on every call. A missing file, invalid JSON
 * or an invalid `telemetry` block reads as the defaults (off, not asked).
 */
export function readTelemetryState(path: string = defaultConfigPath()): TelemetryState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
  if (!isJsonObject(parsed)) {
    return { ...DEFAULT_STATE };
  }
  const block = telemetryConfigSchema.safeParse(parsed.telemetry);
  if (!block.success) {
    return { ...DEFAULT_STATE };
  }
  const state: TelemetryState = {
    enabled: block.data.enabled ?? false,
    asked: block.data.asked ?? false,
  };
  if (block.data.installId !== undefined) {
    state.installId = block.data.installId;
  }
  return state;
}

/** The raw config object to update: `{}` for a missing file; throws for anything else odd. */
function readRawConfig(path: string): Record<string, unknown> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {};
    }
    throw new TelemetryConfigWriteError(path, `cannot read the file (${code ?? 'unknown error'})`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TelemetryConfigWriteError(path, 'the file is not valid JSON; fix or remove it first');
  }
  if (!isJsonObject(parsed)) {
    throw new TelemetryConfigWriteError(
      path,
      'the file is not a JSON object; fix or remove it first',
    );
  }
  return parsed;
}

/**
 * The file a write replaces (WR-02). A symlinked config.json (dotfile managers such as stow,
 * chezmoi or home-manager link it) resolves to its target, so the temp file and the rename
 * stay in the target's directory and the link itself survives; a dangling link resolves one
 * hop to the file it names. Anything else, including a missing file, is written at `path`.
 */
function writeTarget(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    // no file yet, or a dangling link
  }
  try {
    if (lstatSync(path).isSymbolicLink()) {
      return resolve(dirname(path), readlinkSync(path));
    }
  } catch {
    // nothing at path
  }
  return path;
}

/**
 * The nearest directory on the way up from `dir` that exists (the one a recursive mkdir
 * would create the rest under), or undefined if none can be found.
 */
function nearestExistingDir(dir: string): string | undefined {
  let current = dir;
  for (;;) {
    try {
      if (statSync(current).isDirectory()) {
        return current;
      }
      return undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        return undefined;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

/**
 * Whether a consent answer could be saved right now (CR-01). Runs the same checks the
 * write does before it touches anything: the file must be missing or a JSON object, and the
 * directory the temp file and the rename go to (or the nearest existing parent a new
 * directory would be created under) must be writable. A false here means "do not ask": an
 * answer that cannot be saved would be thrown away and the question asked again after every
 * accepted `??`. Never throws.
 */
export function telemetryStateWritable(path: string = defaultConfigPath()): boolean {
  try {
    readRawConfig(path);
    const dir = nearestExistingDir(dirname(writeTarget(path)));
    if (dir === undefined) {
      return false;
    }
    accessSync(dir, constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets only `raw.telemetry` and writes the file atomically with the provider-pin pattern:
 * a sibling temp file created exclusively (`wx`, mode 0600, so a planted file or symlink at
 * that name fails instead of being followed), chmod, then rename over the target. A
 * symlinked config.json is written through to its target, never replaced (WR-02). A new
 * directory is created 0700.
 */
function writeTelemetryState(next: TelemetryState, path: string): void {
  const raw = readRawConfig(path);
  const block: TelemetryState = { enabled: next.enabled, asked: next.asked };
  if (next.installId !== undefined) {
    block.installId = next.installId;
  }
  raw.telemetry = block;

  const target = writeTarget(path);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(raw, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    chmodSync(temp, 0o600);
    renameSync(temp, target);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {
      // already renamed, or never created
    }
    throw error;
  }
}

/**
 * Turns telemetry on or off and records that the user has been asked.
 *
 * On: keeps the install id of an already enabled install, else generates a new
 * `crypto.randomUUID()`. Off: deletes the install id (D-06), so turning telemetry on again
 * starts a new, unlinkable install id. The id is never derived from host, user or network
 * identifiers.
 */
export function setTelemetryEnabled(
  enabled: boolean,
  path: string = defaultConfigPath(),
): TelemetryState {
  const current = readTelemetryState(path);
  const next: TelemetryState = enabled
    ? {
        enabled: true,
        asked: true,
        installId: current.enabled && current.installId ? current.installId : randomUUID(),
      }
    : { enabled: false, asked: true };
  writeTelemetryState(next, path);
  return next;
}

/** Records the answer to the first-run consent prompt: yes enables, anything else declines. */
export function markTelemetryAsked(
  answer: boolean,
  path: string = defaultConfigPath(),
): TelemetryState {
  return setTelemetryEnabled(answer, path);
}

/**
 * Whether telemetry may be produced and sent right now: no environment gate, enabled in
 * the config, and an install id present. Reads the file fresh on every call.
 */
export function effectiveTelemetry(
  env: NodeJS.ProcessEnv = process.env,
  path: string = defaultConfigPath(),
): EffectiveTelemetry {
  const reason = telemetryBlockedBy(env);
  if (reason) {
    return { on: false, reason };
  }
  const state = readTelemetryState(path);
  if (!state.enabled || !state.installId) {
    return { on: false, reason: 'disabled' };
  }
  return { on: true, installId: state.installId };
}
