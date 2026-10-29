import * as net from 'node:net';
import { type IpcRequest, type IpcResponse, ipcResponseSchema } from '../../contracts/ipc.js';
import { usableSecret } from '../../shared/env-file.js';
import { defaultConfigPath } from '../../shared/qq-config.js';
import { socketPath as defaultSocketPath } from '../../shared/socket-path.js';
import {
  readTelemetryState,
  setTelemetryEnabled,
  TelemetryConfigWriteError,
  telemetryBlockedBy,
} from '../../shared/telemetry-config.js';
import {
  resolveTelemetryEndpoint,
  type TelemetryEndpoint,
} from '../../shared/telemetry-endpoint.js';

/**
 * `qq telemetry [status|on|off|show]` (phase 10, D-06, D-09, D-12, D-22).
 *
 * Output is fixed copy plus the state, the names of blocking environment variables and the
 * endpoint host. It never prints the install id or the value of any environment variable.
 * `show` is the exception by design: it prints the daemon's pending and last sent bodies byte
 * for byte, because those bodies are exactly what leaves the machine.
 *
 * Nothing here is interactive: stdout for results, stderr for errors and usage.
 */

/** Everything `qq telemetry` touches, injectable so tests use a temp config and a fake daemon. */
export interface TelemetryCliDeps {
  env: NodeJS.ProcessEnv;
  /** Config file to read and write; defaults to `defaultConfigPath()` (honours QQ_CONFIG_FILE). */
  configPath?: string;
  socketPath: string;
  endpoint(): TelemetryEndpoint | null;
  /** One request to the daemon; null when no daemon answers in time or the reply is invalid. */
  requestDaemon(request: IpcRequest): Promise<IpcResponse | null>;
  out(text: string): void;
  err(text: string): void;
}

/** How long a `telemetry-show` / `telemetry-reset` request waits for the daemon's reply. */
export const DAEMON_REQUEST_TIMEOUT_MS = 500;

const USAGE = 'usage: qq telemetry [status|on|off|show]';
const DAEMON_NOT_RUNNING = 'daemon not running: nothing buffered';
const NO_KEY_NOTE = 'note: this build has no project key, so nothing is sent';

/**
 * Sends one JSON line to the daemon socket and resolves with its first reply line, validated
 * with `ipcResponseSchema`. Resolves null on a connect error, a closed socket, an invalid
 * reply or after `timeoutMs` (the same one-shot pattern as `requestDaemonShutdown`).
 */
export function requestDaemonOnce(
  socketPath: string,
  request: IpcRequest,
  timeoutMs: number = DAEMON_REQUEST_TIMEOUT_MS,
): Promise<IpcResponse | null> {
  return new Promise((resolve) => {
    let settled = false;
    let buf = '';
    const done = (response: IpcResponse | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      client.destroy();
      resolve(response);
    };

    const client = net.createConnection(socketPath);
    const timer = setTimeout(() => {
      done(null);
    }, timeoutMs);

    client.on('connect', () => {
      client.write(`${JSON.stringify(request)}\n`);
    });
    client.on('data', (chunk) => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl === -1) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(buf.slice(0, nl));
      } catch {
        done(null);
        return;
      }
      const response = ipcResponseSchema.safeParse(parsed);
      done(response.success ? response.data : null);
    });
    client.on('error', () => {
      done(null);
    });
    client.on('close', () => {
      done(null);
    });
  });
}

export function defaultTelemetryCliDeps(): TelemetryCliDeps {
  const socket = defaultSocketPath();
  return {
    env: process.env,
    socketPath: socket,
    endpoint: () => resolveTelemetryEndpoint(process.env),
    requestDaemon: (request) => requestDaemonOnce(socket, request),
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  };
}

/**
 * The host part of where batches go (no scheme, path, key or credentials). With a project key
 * that is the resolved endpoint; without one it is the configured host, so `status` can still
 * say where data would go.
 */
function endpointHost(deps: TelemetryCliDeps, endpoint: TelemetryEndpoint | null): string {
  const raw =
    endpoint?.host ?? usableSecret(deps.env.QQ_TELEMETRY_HOST) ?? __QUEQUE_TELEMETRY_HOST__;
  try {
    const url = new URL(raw);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.host !== '') {
      return url.host;
    }
  } catch {
    // fall through
  }
  return 'not configured';
}

function printStatus(deps: TelemetryCliDeps, configPath: string): void {
  const blockedBy = telemetryBlockedBy(deps.env);
  const state = readTelemetryState(configPath);
  const configOn = state.enabled && state.installId !== undefined;
  const endpoint = deps.endpoint();
  const lines = [`telemetry: ${blockedBy === null && configOn ? 'on' : 'off'}`];
  if (blockedBy !== null) {
    lines.push(`reason: ${blockedBy} is set (it overrides the config)`);
  } else if (!configOn) {
    lines.push('reason: not turned on (run `qq telemetry on`)');
  }
  lines.push(
    `config: ${configOn ? 'on' : 'off'}`,
    `asked: ${state.asked ? 'yes' : 'no'}`,
    `project key: ${endpoint === null ? 'absent in this build (nothing is sent)' : 'present'}`,
    `endpoint: ${endpointHost(deps, endpoint)}`,
  );
  deps.out(`${lines.join('\n')}\n`);
}

function turnOn(deps: TelemetryCliDeps, configPath: string): void {
  setTelemetryEnabled(true, configPath);
  const lines = ['telemetry: on'];
  const blockedBy = telemetryBlockedBy(deps.env);
  if (blockedBy !== null) {
    lines.push(`note: ${blockedBy} is set, so telemetry stays off until it is unset`);
  }
  if (deps.endpoint() === null) {
    lines.push(NO_KEY_NOTE);
  }
  lines.push('see what would be sent: qq telemetry show');
  deps.out(`${lines.join('\n')}\n`);
}

async function turnOff(deps: TelemetryCliDeps, configPath: string): Promise<void> {
  // D-06: the install id is deleted from the config first, then the daemon drops its buffer
  // and last sent body. A daemon that is not running holds nothing to drop.
  setTelemetryEnabled(false, configPath);
  const reply = await deps.requestDaemon({ kind: 'telemetry-reset' });
  const lines = ['telemetry: off', 'install id deleted'];
  if (reply?.kind === 'telemetry-buffer') {
    lines.push('daemon buffer cleared');
  }
  deps.out(`${lines.join('\n')}\n`);
}

async function show(deps: TelemetryCliDeps): Promise<void> {
  const reply = await deps.requestDaemon({ kind: 'telemetry-show' });
  if (reply === null) {
    deps.out(`${DAEMON_NOT_RUNNING}\n`);
    return;
  }
  if (reply.kind !== 'telemetry-buffer') {
    deps.out('the daemon did not return a telemetry buffer (it may be outdated): nothing shown\n');
    return;
  }
  // D-12: the bodies exactly as the daemon holds them; nothing else is added.
  deps.out(`pending:\n${reply.pending ?? '(none)'}\nlast sent:\n${reply.lastSent ?? '(none)'}\n`);
}

/**
 * `qq telemetry [action]`: no action means `status`. An unknown action prints usage on
 * stderr and sets exit code 1. A config file that cannot be updated (invalid JSON, not an
 * object, unreadable) is never overwritten: the reason goes to stderr and exit code is 1.
 */
export async function telemetryCommand(
  action: string | undefined,
  deps: TelemetryCliDeps = defaultTelemetryCliDeps(),
): Promise<void> {
  const configPath = deps.configPath ?? defaultConfigPath();
  try {
    switch (action ?? 'status') {
      case 'status':
        printStatus(deps, configPath);
        return;
      case 'on':
        turnOn(deps, configPath);
        return;
      case 'off':
        await turnOff(deps, configPath);
        return;
      case 'show':
        await show(deps);
        return;
      default:
        deps.err(`qq telemetry: unknown telemetry action\n${USAGE}\n`);
        process.exitCode = 1;
        return;
    }
  } catch (error) {
    if (error instanceof TelemetryConfigWriteError) {
      deps.err(`${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
