/**
 * Characterization tests for the shipped missing-tool semantics (09-01 Task 1).
 * Inventories are built directly with `new Set([...])` (unit scope); in production builtins
 * come only from the zsh handoff's builtins.txt (D-02).
 */

import { describe, expect, it } from 'vitest';
import {
  annotateCandidates,
  isInstalled,
  missingTools,
  type ToolInventory,
} from '../src/shared/tool-awareness.js';

function inv(
  parts: { commands?: string[]; builtins?: string[]; functions?: string[] } = {},
): ToolInventory {
  return {
    commands: new Set(parts.commands ?? []),
    builtins: new Set(parts.builtins ?? []),
    functions: new Set(parts.functions ?? []),
  };
}

describe('missingTools', () => {
  it('flags only the external words that are not installed', () => {
    expect(missingTools('rg TODO | fzf', inv({ commands: ['rg'] }))).toEqual(['fzf']);
  });

  it('deduplicates repeated missing tools in first-seen order', () => {
    expect(missingTools('docker ps -q | xargs docker stop', inv({ commands: ['xargs'] }))).toEqual([
      'docker',
    ]);
  });

  it('treats a function-only name as installed (nvm)', () => {
    const inventory = inv({ functions: ['nvm'] });
    expect(missingTools('nvm use 20', inventory)).toEqual([]);
    expect(isInstalled(inventory, 'nvm')).toBe(true);
  });

  it('treats an alias-only name as installed (assumption-delta invariant)', () => {
    const inventory = inv({ functions: ['ll'] });
    expect(missingTools('ll -a', inventory)).toEqual([]);
    expect(isInstalled(inventory, 'll')).toBe(true);
    expect(isInstalled(inventory, 'nope')).toBe(false);
  });

  it('never flags builtins', () => {
    expect(missingTools('cd /tmp && kill -9 1', inv({ builtins: ['cd', 'kill'] }))).toEqual([]);
  });

  it('never flags reserved words', () => {
    expect(
      missingTools('if true; then git status; fi', inv({ commands: ['git'], builtins: ['true'] })),
    ).toEqual([]);
  });

  it('never flags placeholders, $VAR commands or path commands', () => {
    const empty = inv();
    expect(missingTools('<editor> ~/.zshrc', empty)).toEqual([]);
    expect(missingTools('$EDITOR x', empty)).toEqual([]);
    expect(missingTools('./scripts/deploy.sh', empty)).toEqual([]);
  });

  it('flags a tool installed by an earlier step of the same command (D-06)', () => {
    expect(missingTools('brew install fd && fd -e ts', inv({ commands: ['brew'] }))).toEqual([
      'fd',
    ]);
  });
});

describe('annotateCandidates', () => {
  const candidates = [
    { command: 'qqmissing --a', explanation: 'first' },
    { command: 'git status', explanation: 'second' },
    { command: 'qqother | qqmissing', explanation: 'third' },
  ];

  it('keeps the input order for 3 candidates and never drops one (D-13)', () => {
    const annotated = annotateCandidates(candidates, inv({ commands: ['git'] }));
    expect(annotated.map((c) => c.explanation)).toEqual(['first', 'second', 'third']);
    expect(annotated[0].missingTools).toEqual(['qqmissing']);
    expect(annotated[1].missingTools).toBeUndefined();
    expect(annotated[2].missingTools).toEqual(['qqother', 'qqmissing']);
  });

  it('returns unflagged copies for a null inventory', () => {
    const annotated = annotateCandidates(candidates, null);
    expect(annotated).toEqual(candidates);
    expect(annotated[0]).not.toBe(candidates[0]);
    for (const candidate of annotated) {
      expect('missingTools' in candidate).toBe(false);
    }
  });

  it('returns a 9000-character command unflagged without throwing', () => {
    const long = { command: `qqmissing ${'x'.repeat(9000)}`, explanation: 'long' };
    expect(() => annotateCandidates([long], inv())).not.toThrow();
    expect(annotateCandidates([long], inv())[0].missingTools).toBeUndefined();
  });
});
