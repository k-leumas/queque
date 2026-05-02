import { describe, expect, it } from 'vitest';
import { type NormalizedRequest } from '../src/contracts/request.js';
import { classifyIntent } from '../src/intent/router.js';

function makeRequest(lbuffer: string): NormalizedRequest {
  return {
    version: 1,
    lbuffer,
    rbuffer: '',
    cwd: '/home/user/project',
    ttyPath: '/dev/tty',
    shellPid: 1234,
    intent: 'unknown',
  };
}

describe('classifyIntent', () => {
  describe('D-03: git prefix → shell-command with git-prefix signal', () => {
    it('routes "git status" as shell-command', () => {
      const result = classifyIntent(makeRequest('git status'));
      expect(result.intent).toBe('shell-command');
      expect(result.signals).toContain('git-prefix');
    });

    it('routes "git log --oneline" as shell-command', () => {
      const result = classifyIntent(makeRequest('git log --oneline'));
      expect(result.intent).toBe('shell-command');
      expect(result.signals).toContain('git-prefix');
    });

    it('routes " git status" (leading space) as shell-command — ZLE strips leading whitespace before ?? trigger, so trimmed query matches', () => {
      const result = classifyIntent(makeRequest(' git status'));
      expect(result.intent).toBe('shell-command');
      expect(result.signals).toContain('git-prefix');
    });

    it('routes "command git status" as shell-command via shell-command signal (NOT git-prefix — Phase 2 scope limit)', () => {
      const result = classifyIntent(makeRequest('command git status'));
      expect(result.intent).toBe('shell-command');
      expect(result.signals).not.toContain('git-prefix');
    });
  });

  describe('D-02: package manager scripts → codebase', () => {
    it('routes "pnpm build" as codebase', () => {
      const result = classifyIntent(makeRequest('pnpm build'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('pkg-manager-script');
    });

    it('routes "npm test" as codebase', () => {
      const result = classifyIntent(makeRequest('npm test'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('pkg-manager-script');
    });

    it('routes "yarn lint" as codebase', () => {
      const result = classifyIntent(makeRequest('yarn lint'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('pkg-manager-script');
    });

    it('routes "pnpm run dev" as codebase', () => {
      const result = classifyIntent(makeRequest('pnpm run dev'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('pkg-manager-script');
    });

    it('does NOT route "how to run pnpm build" as codebase — natural language mention, not a literal invocation', () => {
      const result = classifyIntent(makeRequest('how to run pnpm build'));
      expect(result.intent).not.toBe('codebase');
    });
  });

  describe('D-01: codebase requires explicit file path signal', () => {
    it('routes query with path separator as codebase', () => {
      const result = classifyIntent(makeRequest('fix the bug in src/auth.ts'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('routes query with relative path ./config.ts as codebase', () => {
      const result = classifyIntent(makeRequest('fix ./config.ts'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('routes query with tilde path ~/dotfiles/.zshrc as codebase', () => {
      const result = classifyIntent(makeRequest('open ~/dotfiles/.zshrc'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('routes query with dotfile .env as codebase', () => {
      const result = classifyIntent(makeRequest('edit .env'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('routes query with filename with space "my file.txt" as codebase', () => {
      const result = classifyIntent(makeRequest('rename my file.txt to notes.txt'));
      expect(result.intent).not.toBe('general');
    });

    it('routes query with bare extension utils.py as codebase', () => {
      const result = classifyIntent(makeRequest('debug utils.py'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('routes query with .html extension as codebase', () => {
      const result = classifyIntent(makeRequest('look at index.html'));
      expect(result.intent).toBe('codebase');
      expect(result.signals).toContain('file-path-signal');
    });

    it('does NOT route code verbs without file path as codebase', () => {
      const result = classifyIntent(makeRequest('refactor this component'));
      expect(result.intent).not.toBe('codebase');
    });

    it('does NOT route "fix the tests" (no file path) as codebase', () => {
      const result = classifyIntent(makeRequest('fix the tests'));
      expect(result.intent).not.toBe('codebase');
    });

    it('does NOT route "fix the api" as codebase — "api" is not a path signal', () => {
      const result = classifyIntent(makeRequest('fix the api'));
      expect(result.intent).not.toBe('codebase');
    });
  });

  describe('shell-command precedence over file-path signal', () => {
    it('routes "ls ./foo.txt" as shell-command (shell prefix wins over file-path signal)', () => {
      const result = classifyIntent(makeRequest('ls ./foo.txt'));
      expect(result.intent).toBe('shell-command');
    });

    it('routes "cat package.json" as shell-command (shell prefix wins over file-path signal)', () => {
      const result = classifyIntent(makeRequest('cat package.json'));
      expect(result.intent).toBe('shell-command');
    });

    it('routes pipe command as shell-command', () => {
      const result = classifyIntent(makeRequest('ls -la | grep foo'));
      expect(result.intent).toBe('shell-command');
    });
  });

  describe('filesystem intent', () => {
    it('routes rename with file extension as filesystem', () => {
      const result = classifyIntent(makeRequest('rename hero.png to hero-banner.png'));
      expect(result.intent).toBe('filesystem');
    });

    it('routes find files query as filesystem', () => {
      const result = classifyIntent(makeRequest('find files ending in .pdf'));
      expect(result.intent).toBe('filesystem');
    });
  });

  describe('general and unknown fallback', () => {
    it('routes conceptual question as general', () => {
      const result = classifyIntent(makeRequest('what does the -v flag do in grep'));
      expect(result.intent).toBe('general');
    });

    it('routes empty query as unknown — this is the ONLY path to unknown intent', () => {
      const result = classifyIntent(makeRequest(''));
      expect(result.intent).toBe('unknown');
    });

    it('routes whitespace-only query as unknown (trims to empty string)', () => {
      const result = classifyIntent(makeRequest('   '));
      expect(result.intent).toBe('unknown');
    });

    it('routes non-empty query with no signal as general (never unknown)', () => {
      const result = classifyIntent(makeRequest('hello'));
      expect(result.intent).toBe('general');
      expect(result.intent).not.toBe('unknown');
    });
  });
});
