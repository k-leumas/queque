import type { DoctorReport } from '../../contracts/doctor.js';
import type { DetectedProvider } from '../../providers/detect.js';
import type { ProviderPinState } from '../../providers/provider-pin.js';

/** zsh below this version cannot run the widget: `zsh` fails (D-20). */
export const ZSH_FAIL_BELOW = '5.0';
/** zsh below this version is untested: `zsh` warns (D-20; 5.8 is Ubuntu 22.04, the oldest CI). */
export const ZSH_WARN_BELOW = '5.8';

/** Unix socket path limits from the Node docs (107 bytes on Linux, 103 on macOS). */
export const SOCKET_PATH_MAX_BYTES = { linux: 107, darwin: 103 } as const;

export interface ZshBindings {
  emacs: string | null;
  viins: string | null;
}

/** Everything doctor reads, injectable so tests never spawn or touch the real machine. */
export interface DoctorDeps {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  homeDir: string;
  uid: number;
  socketPath: string;
  nodeVersion: string;
  qqVersion: string;
  which(name: string): string | null;
  zshVersion(): Promise<string | null>;
  zshBindings(): Promise<ZshBindings | null>;
  readZshrc(): string | null;
  probeTmp(): boolean;
  socketOwner(path: string): number | null;
  pingDaemon(path: string): Promise<'yes' | 'no' | 'unknown'>;
  loadProviderPin(): ProviderPinState;
  detectProvider(): Promise<DetectedProvider>;
}

export function defaultDoctorDeps(): DoctorDeps {
  // TDD RED stub: replaced in GREEN.
  throw new Error('defaultDoctorDeps: not implemented');
}

export async function runDoctorChecks(
  deps: DoctorDeps = defaultDoctorDeps(),
): Promise<DoctorReport> {
  // TDD RED stub: replaced in GREEN.
  return { version: 1, ok: true, qqVersion: deps.qqVersion, platform: 'other', checks: [] };
}
