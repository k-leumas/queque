import { describe, expect, it } from 'vitest';
import { parsePorcelainLine } from '../src/context/providers/git-context.js';

describe('parsePorcelainLine', () => {
  it('parses a normal modified file', () => {
    expect(parsePorcelainLine(' M src/index.ts')).toBe('src/index.ts');
  });

  it('parses an added file', () => {
    expect(parsePorcelainLine('A  src/new-file.ts')).toBe('src/new-file.ts');
  });

  it('parses an untracked file', () => {
    expect(parsePorcelainLine('?? src/untracked.ts')).toBe('src/untracked.ts');
  });

  it('parses a renamed file and returns the destination only', () => {
    expect(parsePorcelainLine('R  old-name.ts -> new-name.ts')).toBe('new-name.ts');
  });

  it('parses a copied file and returns the destination only', () => {
    expect(parsePorcelainLine('C  template.ts -> new-copy.ts')).toBe('new-copy.ts');
  });

  it('parses a merge conflict line', () => {
    expect(parsePorcelainLine('UU src/conflicted.ts')).toBe('src/conflicted.ts');
  });

  it('parses a filename with spaces', () => {
    expect(parsePorcelainLine(' M "my file with spaces.ts"')).toBe('my file with spaces.ts');
  });

  it('parses a renamed file with spaces in the destination', () => {
    expect(parsePorcelainLine('R  old.ts -> "new name.ts"')).toBe('new name.ts');
  });

  it('returns null for lines shorter than four characters', () => {
    expect(parsePorcelainLine('M')).toBeNull();
    expect(parsePorcelainLine('')).toBeNull();
  });
});
