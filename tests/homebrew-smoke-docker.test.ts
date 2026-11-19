import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Homebrew install smoke (scripts/smoke-homebrew-docker.sh) gates every release. Only the
 * model is fake: the container's `claude` runs tests/fixtures/fake-claude-stream.mjs, so the
 * smoke needs no key and never skips. Its image caches the npm install layer (deps first, keyed
 * on a version-stripped package.json), CI adds a buildx gha layer cache, and .dockerignore is an
 * allow list that must track every COPY source of the heredoc Dockerfile.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf8');
const SMOKE = 'scripts/smoke-homebrew-docker.sh';
const RUNNER = 'scripts/docker-homebrew-smoke-runner.sh';
// Built from fragments so this file never holds the literal key names.
const KEY_NAMES = [['ANTHROPIC', 'API', 'KEY'].join('_'), ['anthropic', 'api', 'key'].join('_')];

const lines = (text: string) => text.split('\n');

describe('Homebrew Docker smoke', () => {
  it('never reads or passes an Anthropic key', () => {
    const smoke = read(SMOKE);
    for (const name of KEY_NAMES) {
      expect(smoke).not.toContain(name);
    }
    expect(smoke).not.toContain('read_env_local_key');
  });

  it('wires the fake claude into the container', () => {
    expect(read(SMOKE)).toContain(
      'tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro',
    );
    const runner = read(RUNNER);
    expect(runner).toContain('exec node /opt/fake/fake-claude-stream.mjs');
    expect(runner).not.toMatch(/:\?/);
    for (const name of KEY_NAMES) {
      expect(runner).not.toContain(name);
    }
  });

  it('.dockerignore ignores everything and re-includes every COPY source', () => {
    const rules = lines(read('.dockerignore'))
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    expect(rules[0]).toBe('*');
    const sources = lines(read(SMOKE))
      .filter((line) => /^COPY /.test(line) && !line.startsWith('COPY --from='))
      .flatMap((line) => line.trim().split(/\s+/).slice(1, -1));
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(rules).toContain(`!${source}`);
    }
  });

  it('builds with buildx and the gha cache only when QQ_SMOKE_DOCKER_CACHE=gha', () => {
    const smoke = read(SMOKE);
    expect(smoke).toContain('docker buildx build');
    expect(smoke).toContain('--load');
    expect(smoke).toMatch(/--cache-from\s+"type=gha[^"]*"/);
    const cacheTo = /--cache-to\s+"(type=gha[^"]*)"/.exec(smoke)?.[1] ?? '';
    expect(cacheTo).toContain('ignore-error=true');
    expect(smoke).toContain('QQ_SMOKE_DOCKER_CACHE');
    expect(smoke).toMatch(/\bgha\)/);
    expect(smoke).toMatch(/\(docker build\b|docker build --/);
  });

  it('installs npm deps before copying src and shell, fed by a COPY --from manifest', () => {
    const body = lines(read(SMOKE));
    const at = (pattern: RegExp) => body.findIndex((line) => pattern.test(line));
    const npm = at(/^RUN npm install --ignore-scripts/);
    const src = at(/^COPY src \.\/src$/);
    const shell = at(/^COPY shell \.\/shell$/);
    const manifest = at(/^COPY --from=manifest /);
    expect(npm).toBeGreaterThan(-1);
    expect(src).toBeGreaterThan(npm);
    expect(shell).toBeGreaterThan(npm);
    expect(manifest).toBeGreaterThan(-1);
    expect(manifest).toBeLessThan(npm);
  });
});
