import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPORTED_SHELLS = ['zsh'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

const HOMEBREW_PREFIXES = ['/opt/homebrew', '/usr/local', '/home/linuxbrew/.linuxbrew'];

// Homebrew installs the shell script to $(brew --prefix)/share/queque/ — a path
// that is stable across `brew upgrade` (no version number). The formula's install
// block copies shell/zsh/queque.zsh there. For npm global installs the script stays
// inside the package directory, which npm updates in-place so the path is also stable.
function resolveScriptPath(shell: Shell): string {
  for (const prefix of HOMEBREW_PREFIXES) {
    const p = resolve(prefix, 'share', 'queque', `queque.${shell}`);
    if (existsSync(p)) return p;
  }
  return resolve(__dirname, '../../shell', shell, `queque.${shell}`);
}

export function initCommand(shell: string): void {
  if (!SUPPORTED_SHELLS.includes(shell as Shell)) {
    console.error(`Unsupported shell: '${shell}'. Supported: ${SUPPORTED_SHELLS.join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(`source "${resolveScriptPath(shell as Shell)}"\n`);
}
