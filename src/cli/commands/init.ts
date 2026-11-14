import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ShellName } from '../../contracts/shell.js';
import { bootstrapBuiltins } from '../../registry/bootstrap.js';
import { listShellAdapters } from '../../registry/shell-adapters.js';
import type { ShellSpec } from '../../shared/shell-registry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPORTED_SHELLS = ['zsh'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

const HOMEBREW_PREFIXES = ['/opt/homebrew', '/usr/local', '/home/linuxbrew/.linuxbrew'];

// Homebrew installs the shell script to $(brew --prefix)/share/queque/ — a path
// that is stable across `brew upgrade` (no version number). The formula's install
// block copies shell/zsh/queque.zsh there. For npm global installs the script stays
// inside the package directory, which npm updates in-place so the path is also stable.
function _resolveScriptPath(shell: Shell): string {
  for (const prefix of HOMEBREW_PREFIXES) {
    const p = resolve(prefix, 'share', 'queque', `queque.${shell}`);
    if (existsSync(p)) return p;
  }
  return resolve(__dirname, '../../shell', shell, `queque.${shell}`);
}

/**
 * Returns true when .zshrc already sources the queque shell script or contains
 * our integration marker — not merely any mention of "queque".
 */
export function hasShellIntegration(existing: string, shell: ShellName): boolean {
  if (/# queque shell integration/.test(existing)) {
    return true;
  }

  const scriptPattern = new RegExp(`source\\s+["'][^"']*queque\\.${shell.replace('.', '\\.')}["']`);
  return scriptPattern.test(existing);
}

// TDD RED stubs (11-04 Task 2): the public shape exists so typecheck passes; GREEN implements.
export interface InitDeps {
  home: string;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  userShell?: string;
  which(name: string): string | null;
  probeVersion(binary: string, args: readonly string[]): string | null;
  readFile(path: string): string | null;
  appendFile(path: string, text: string): void;
  out(line: string): void;
  err(line: string): void;
  adapterPath?: (spec: ShellSpec) => string;
}

export function defaultInitDeps(): InitDeps {
  throw new Error('not implemented');
}

export function runInit(
  _shellArg: string | undefined,
  _deps: InitDeps,
): { exitCode: 0 | 1; wrote: boolean } {
  return { exitCode: 1, wrote: false };
}

export function initCommand(shell: string): void {
  // Defensive bootstrap — main.ts also registers built-ins at startup.
  bootstrapBuiltins();
  const supportedShells = listShellAdapters().map((adapter) => adapter.shell);

  if (!supportedShells.includes(shell)) {
    console.error(`Unsupported shell: '${shell}'. Supported: ${supportedShells.join(', ')}`);
    process.exit(1);
  }

  const zshrc = join(homedir(), '.zshrc');
  const scriptPath = _resolveScriptPath(shell as Shell);
  const snippet = `source "${scriptPath}"`;

  const existing = existsSync(zshrc) ? readFileSync(zshrc, 'utf8') : '';

  if (hasShellIntegration(existing, shell as Shell)) {
    console.error('queque: shell integration already present in ~/.zshrc');
    process.exit(0);
  }

  appendFileSync(zshrc, `\n# queque shell integration\n${snippet}\n`);
  console.log('queque: added shell integration to ~/.zshrc — run: source ~/.zshrc');
}
