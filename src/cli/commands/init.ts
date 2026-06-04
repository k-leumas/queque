import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function initCommand(shell: string): void {
  if (!SUPPORTED_SHELLS.includes(shell as Shell)) {
    console.error(`Unsupported shell: '${shell}'. Supported: ${SUPPORTED_SHELLS.join(', ')}`);
    process.exit(1);
  }

  const zshrc = join(homedir(), '.zshrc');
  const marker = /\bqueque\b/;
  const scriptPath = _resolveScriptPath(shell as Shell);
  const snippet = `source "${scriptPath}"`;

  const existing = existsSync(zshrc) ? readFileSync(zshrc, 'utf8') : '';

  if (existing.search(marker)) {
    console.error('queque: shell integration already present in ~/.zshrc');
    process.exit(0);
  }

  appendFileSync(zshrc, `\n# queque shell integration\n${snippet}\n`);
  console.log('queque: added shell integration to ~/.zshrc — run: source ~/.zshrc');
}
