import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readEnvValueFromDotEnvLocal } from '../src/shared/env-file.js';

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
  // Regression: default startDir must be process.cwd(), NOT the module file path.
  // In production (Homebrew), import.meta.url resolves to the Cellar bundle path
  // (e.g. /usr/local/Cellar/queque/0.2.13/.../dist/cli/main.js) — searching upward
  // from there never finds the user's project .env.local.
  // ---------------------------------------------------------------------------
  describe('default startDir is process.cwd() (production bundle regression)', () => {
    let originalCwd: string;

    beforeEach(() => {
      originalCwd = process.cwd();
    });

    afterEach(() => {
      process.chdir(originalCwd);
    });

    it('finds .env.local when cwd is a child of the directory containing it', () => {
      const root = mkdtempSync(join(tmpdir(), 'qq-env-cwd-'));
      const child = join(root, 'project', 'src');
      mkdirSync(child, { recursive: true });
      writeFileSync(join(root, '.env.local'), 'ANTHROPIC_API_KEY=cwd-value\n');

      process.chdir(child);
      expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')).toBe('cwd-value');
    });

    it('returns null when no .env.local exists above cwd', () => {
      const root = mkdtempSync(join(tmpdir(), 'qq-env-nocwd-'));
      process.chdir(root);
      // deliberately pass an unreachable startDir to prove the default uses cwd
      expect(readEnvValueFromDotEnvLocal('ANTHROPIC_API_KEY')).toBeNull();
    });
  });
});
