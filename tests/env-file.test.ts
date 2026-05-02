import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
});
