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

/**
 * Slices one job out of release.yaml: from its two-space-indented `  name:` key up to the next
 * two-space-indented job key (or the end of the file).
 */
function jobBlock(name: string): string {
  const text = read('.github/workflows/release.yaml');
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start === -1) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 2);
}

describe('Release workflow smoke jobs', () => {
  it('brew-smoke always runs the smoke with the gha cache and no secret', () => {
    const job = jobBlock('brew-smoke');
    expect(job).toContain('./scripts/smoke-homebrew-docker.sh');
    expect(job).toContain('QQ_SMOKE_DOCKER_CACHE: gha');
    expect(job).toContain('docker/setup-buildx-action@');
    expect(job).toContain('crazy-max/ghaction-github-runtime@');
    expect(job).toContain('contents: read');
    expect(job).not.toMatch(/\bif:/);
    expect(job).not.toContain('setup-node');
    expect(job).not.toContain('pnpm/action-setup');
    expect(job).not.toContain('apt-get');
    for (const name of KEY_NAMES) {
      expect(job).not.toContain(name);
    }
  });

  it('test restores the apt deps from cache and runs the gates, not the smoke', () => {
    const job = jobBlock('test');
    expect(job).toContain('cache-apt-pkgs-action@');
    expect(job).toContain('packages: zsh jq bash tmux');
    for (const gate of ['pnpm lint', 'pnpm typecheck', 'pnpm test:run', 'pnpm build']) {
      expect(job).toContain(gate);
    }
    expect(job).not.toContain('smoke-homebrew-docker.sh');
    for (const name of KEY_NAMES) {
      expect(job).not.toContain(name);
    }
  });

  it('tag-and-changelog needs both jobs and the skip step is gone', () => {
    expect(jobBlock('tag-and-changelog')).toContain('needs: [test, brew-smoke]');
    expect(read('.github/workflows/release.yaml')).not.toContain('Skip Homebrew install smoke');
  });
});
