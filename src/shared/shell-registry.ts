import type { ShellName } from '../contracts/shell.js';

// TDD RED stub (11-04 Task 1): the public shape exists so typecheck passes; behaviour lands in
// the GREEN commit.

export interface ShellSpec {
  shell: ShellName;
  shipped: boolean;
  rcFile: string;
  rcDisplay: string;
  adapterFile: string;
  binary: string;
  versionArgs: readonly string[];
  failBelow: string;
  warnBelow: string;
  bindingWidget: string;
  bindingKeymaps: readonly string[];
}

export const ZSH_FAIL_BELOW = '5.0';
export const ZSH_WARN_BELOW = '5.8';
export const BASH_FAIL_BELOW = '5.0';
export const BASH_WARN_BELOW = '5.1';

const stubSpec = (shell: ShellName): ShellSpec => ({
  shell,
  shipped: false,
  rcFile: '',
  rcDisplay: '',
  adapterFile: '',
  binary: shell,
  versionArgs: [],
  failBelow: '',
  warnBelow: '',
  bindingWidget: '',
  bindingKeymaps: [],
});

export const SHELL_SPECS: Readonly<Record<ShellName, ShellSpec>> = {
  zsh: stubSpec('zsh'),
  bash: stubSpec('bash'),
  fish: stubSpec('fish'),
};

export function getShellSpec(_shell: ShellName): ShellSpec {
  return stubSpec('zsh');
}

export function shippedShellNames(): ShellName[] {
  return [];
}

export function detectShell(_input: {
  arg?: string;
  env?: NodeJS.ProcessEnv;
  userShell?: string;
}): ShellName | null {
  return null;
}

export const HOMEBREW_PREFIXES: readonly string[] = [];

export function resolveAdapterPath(
  _spec: ShellSpec,
  _opts?: {
    prefixes?: readonly string[];
    packageShellDir?: string;
    exists?: (p: string) => boolean;
  },
): string {
  return '';
}

export function parseShellVersion(_raw: string): number[] | null {
  return null;
}

export function versionBelow(_version: readonly number[], _threshold: string): boolean {
  return false;
}

export const BASH_LOGIN_FILES = ['.bash_profile', '.bash_login', '.profile'] as const;

export const BASHRC_SOURCE_RE = /$^/;

export function loginFileSourcesBashrc(_readRc: (relPath: string) => string | null): {
  file: string | null;
  sourcesBashrc: boolean;
} {
  return { file: null, sourcesBashrc: false };
}
