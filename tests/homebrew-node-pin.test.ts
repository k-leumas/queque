import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Homebrew formula pins its Node to the major in .nvmrc, the single source of truth that
 * CI and setup-node already read, so a new Homebrew `node` major can never break `qq` for brew
 * users. Each formula workflow resolves the major from .nvmrc at release time; no workflow or
 * script hardcodes it. node@N is keg-only (not on PATH), so bin/qq is a wrapper that runs that
 * Node explicitly instead of a symlink to the `#!/usr/bin/env node` script.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf8');
const FORMULAS = ['.github/workflows/release.yaml', '.github/workflows/homebrew.yml'];
// Literal GitHub expression and shell text, not template placeholders.
const PINNED = ['node@$', '{{ steps.node.outputs.major }}'].join('');

function dependsOn(relPath: string): string[] {
  const block = /depends_on: \|\n((?: {12}.*\n)+)/.exec(read(relPath))?.[1] ?? '';
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

describe('Homebrew Node pin', () => {
  it('.nvmrc starts with a Node major', () => {
    expect(read('.nvmrc').trim()).toMatch(/^v?\d+(\.|$)/);
  });

  it.each(FORMULAS)('%s resolves the major from .nvmrc and never hardcodes one', (relPath) => {
    const text = read(relPath);
    expect(text).toContain('MAJOR="$(tr -d \'v[:space:]\' < .nvmrc | cut -d. -f1)"');
    expect(text).toContain('echo "major=$MAJOR" >> "$GITHUB_OUTPUT"');
    expect(text).not.toMatch(/node@\d/);
  });

  it.each(FORMULAS)('%s depends on the pinned node, never unpinned node', (relPath) => {
    const deps = dependsOn(relPath);
    expect(deps).toContain(`"${PINNED}"`);
    expect(deps).not.toContain('"node"');
  });

  it.each(FORMULAS)('%s builds and runs qq with the pinned Node, not a symlink', (relPath) => {
    const text = read(relPath);
    expect(text).not.toContain('bin.install_symlink');
    expect(text).toContain(`ENV.prepend_path "PATH", Formula["${PINNED}"].opt_bin`);
    expect(text).toContain(
      `exec "#{Formula["${PINNED}"].opt_bin}/node" "#{libexec}/lib/node_modules/@k-leumas/queque-cli/dist/cli/main.js" "$@"`,
    );
    expect(text).toContain('chmod 0755, bin/"qq"');
  });

  it('the Docker smoke builds on the .nvmrc major too', () => {
    const smoke = read('scripts/smoke-homebrew-docker.sh');
    expect(smoke).toContain('NODE_MAJOR="$(tr -d \'v[:space:]\' < .nvmrc | cut -d. -f1)"');
    expect(smoke).toContain('--build-arg "NODE_MAJOR=$NODE_MAJOR"');
    expect(smoke).toContain(['FROM node:$', '{NODE_MAJOR}-bookworm'].join(''));
    expect(smoke).not.toMatch(/FROM node:\d/);
  });
});
