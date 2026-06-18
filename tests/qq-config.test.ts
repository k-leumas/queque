import { describe, expect, it } from 'vitest';
import { qqConfigFileSchema } from '../src/shared/qq-config.js';

describe('qqConfigFileSchema', () => {
  it('accepts a minimal privacy and safety config', () => {
    const parsed = qqConfigFileSchema.parse({
      privacy: {
        sensitivePathPatterns: ['\\.env'],
        redactLogKeys: ['token'],
        allowFileRead: false,
      },
      safety: {
        destructiveCommandPatterns: ['\\bsudo\\b'],
      },
    });

    expect(parsed.privacy?.sensitivePathPatterns).toEqual(['\\.env']);
  });

  it('accepts an empty object', () => {
    expect(qqConfigFileSchema.parse({})).toEqual({});
  });
});
