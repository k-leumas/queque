import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installMarkerSchema } from '../src/shared/install-detect.js';

/**
 * The Homebrew formula writes `.install-source` next to dist/ so detectInstall names
 * `brew upgrade queque` (quick 261117-jpp). The formula lives in two workflow install blocks
 * and is emulated by the Docker smoke; all three must write the same valid marker.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf8');

const EXPECTED = { source: 'homebrew', upgrade: 'brew upgrade queque' };

function formulaMarkers(relPath: string): string[] {
  return [...read(relPath).matchAll(/\.install-source"\)\.write '([^']*)'/g)].map(
    (m) => m[1] ?? '',
  );
}

describe('Homebrew install marker', () => {
  it.each(['.github/workflows/release.yaml', '.github/workflows/homebrew.yml'])(
    '%s writes exactly one valid homebrew marker',
    (relPath) => {
      const markers = formulaMarkers(relPath);
      expect(markers).toHaveLength(1);
      const json = JSON.parse(markers[0] ?? '');
      expect(installMarkerSchema.parse(json)).toEqual(EXPECTED);
    },
  );

  it('both formula install blocks write byte-identical JSON', () => {
    expect(formulaMarkers('.github/workflows/release.yaml')).toEqual(
      formulaMarkers('.github/workflows/homebrew.yml'),
    );
  });

  it('the Docker smoke emulation writes the same bytes as the formula', () => {
    const smoke = [
      ...read('scripts/smoke-homebrew-docker.sh').matchAll(
        /printf '%s' '([^']*)' >"\$libexec\/lib\/node_modules\/@k-leumas\/queque-cli\/\.install-source"/g,
      ),
    ].map((m) => m[1]);
    expect(smoke).toHaveLength(1);
    expect(smoke).toEqual(formulaMarkers('.github/workflows/release.yaml'));
  });

  it('the npm tarball never ships a marker', () => {
    const pkg = JSON.parse(read('package.json')) as { files: string[] };
    expect(pkg.files.some((entry) => entry.includes('install-source'))).toBe(false);
  });
});
