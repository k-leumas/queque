import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../src/shared/env-file.js';

describe('usableSecret', () => {
  it('returns undefined for missing, empty, and whitespace-only values', () => {
    expect(usableSecret(undefined)).toBeUndefined();
    expect(usableSecret(null)).toBeUndefined();
    expect(usableSecret('')).toBeUndefined();
    expect(usableSecret('   ')).toBeUndefined();
  });

  it('returns a trimmed non-empty secret', () => {
    expect(usableSecret('sk-ant-live')).toBe('sk-ant-live');
    expect(usableSecret('  sk-ant-live  ')).toBe('sk-ant-live');
  });
});

describe('readEnvValueFromDotEnvLocal', () => {
  it('finds ANTHROPIC_API_KEY in a parent .env.local file', () => {
    const root = mkdtempSync(join(tmpdir(), 'qq-env-'));
    const child = join(root, 'nested', 'repo');
    mkdirSync(child, { recursive: true });
    writeFileSync(join(root, '.env.local'), 'ANTHROPIC_API_KEY=test-value\nOTHER_KEY=ignored\n');

    expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY', child)).toBe('test-value');
  });

  it('returns null when the key is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'qq-env-'));
    writeFileSync(join(root, '.env.local'), 'OTHER_KEY=ignored\n');

    expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY', root)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Regression: the default startDir is never the module file path. In production
  // (Homebrew), import.meta.url resolves to the Cellar bundle path (e.g.
  // /usr/local/Cellar/queque/0.2.13/.../dist/cli/main.js), and searching upward from there
  // never finds the user's .env.local. Since WR-10 the default is the home directory, the
  // file the daemon reads (WR-08), so the in-process fallback never picks up a project's
  // .env.local from the shell's cwd.
  // ---------------------------------------------------------------------------
  describe('default startDir is the home directory (WR-10)', () => {
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();
    });

    afterEach(() => {
      process.chdir(originalCwd);
      vi.unstubAllEnvs();
    });

    function projectWithEnvLocal(value: string): string {
      const root = mkdtempSync(join(tmpdir(), 'qq-env-project-'));
      const child = join(root, 'project', 'src');
      mkdirSync(child, { recursive: true });
      writeFileSync(join(root, '.env.local'), `ANTHROPIC_API_KEY=${value}\n`);
      return child;
    }

    it('reads ~/.env.local, not the .env.local above the cwd', () => {
      const home = mkdtempSync(join(tmpdir(), 'qq-env-home-'));
      writeFileSync(join(home, '.env.local'), 'ANTHROPIC_API_KEY=home-value\n');
      vi.stubEnv('HOME', home);

      process.chdir(projectWithEnvLocal('project-value'));
      expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')).toBe('home-value');
    });

    it('ignores a project .env.local when the home directory has none', () => {
      const home = mkdtempSync(join(tmpdir(), 'qq-env-nohome-'));
      vi.stubEnv('HOME', home);

      process.chdir(projectWithEnvLocal('project-value'));
      expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')).toBeNull();
    });
  });

  // IN-16: with HOME under /tmp, a walk above ~ reached a world-writable /tmp/.env.local.
  describe('never reads a key file above the home directory (IN-16)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function homeUnderPlantedFile(): string {
      const root = mkdtempSync(join(tmpdir(), 'qq-env-above-'));
      writeFileSync(join(root, '.env.local'), 'OPENAI_API_KEY=planted-value\n');
      const home = join(root, 'home', 'user');
      mkdirSync(home, { recursive: true });
      vi.stubEnv('HOME', home);
      return home;
    }

    it('ignores a .env.local above ~ by default', () => {
      homeUnderPlantedFile();
      expect(readEnvValueFromDotEnvLocal('OPENAI_API_KEY')).toBeNull();
    });

    it('ignores a .env.local above ~ when the home directory is passed explicitly', () => {
      const home = homeUnderPlantedFile();
      expect(readEnvValueFromDotEnvLocal('OPENAI_API_KEY', home)).toBeNull();
      expect(readEnvValueFromDotEnvLocal('OPENAI_API_KEY', `${home}/`)).toBeNull();
    });

    it('still reads ~/.env.local itself', () => {
      const home = homeUnderPlantedFile();
      writeFileSync(join(home, '.env.local'), 'OPENAI_API_KEY=home-value\n');
      expect(readEnvValueFromDotEnvLocal('OPENAI_API_KEY')).toBe('home-value');
    });
  });
});
