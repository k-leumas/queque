import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPPORTED_SHELLS = ['zsh'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

function shellScriptPath(shell: Shell): string {
  return resolve(__dirname, '../../shell', shell, `queque.${shell}`);
}

export function initCommand(shell: string): void {
  if (!SUPPORTED_SHELLS.includes(shell as Shell)) {
    console.error(`Unsupported shell: '${shell}'. Supported: ${SUPPORTED_SHELLS.join(', ')}`);
    process.exit(1);
  }
  process.stdout.write(`source "${shellScriptPath(shell as Shell)}"\n`);
}
