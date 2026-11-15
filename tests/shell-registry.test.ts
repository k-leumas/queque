import { describe, expect, it } from 'vitest';
import {
  BASH_FAIL_BELOW,
  BASH_LOGIN_FILES,
  BASH_WARN_BELOW,
  BASHRC_SOURCE_RE,
  detectShell,
  getShellSpec,
  HOMEBREW_PREFIXES,
  loginFileSourcesBashrc,
  parseShellVersion,
  resolveAdapterPath,
  SHELL_SPECS,
  shippedShellNames,
  versionBelow,
  ZSH_FAIL_BELOW,
  ZSH_WARN_BELOW,
} from '../src/shared/shell-registry.js';

describe('SHELL_SPECS', () => {
  it('describes zsh', () => {
    const zsh = SHELL_SPECS.zsh;
    expect(zsh.shell).toBe('zsh');
    expect(zsh.shipped).toBe(true);
    expect(zsh.rcFile).toBe('.zshrc');
    expect(zsh.rcDisplay).toBe('~/.zshrc');
    expect(zsh.adapterFile).toBe('queque.zsh');
    expect(zsh.failBelow).toBe('5.0');
    expect(zsh.warnBelow).toBe('5.8');
    expect(zsh.bindingWidget).toBe('qq-question-widget');
    expect([...zsh.bindingKeymaps]).toEqual(['emacs', 'viins']);
    expect([...zsh.versionArgs]).toEqual(['-fc', 'print -r -- $ZSH_VERSION']);
  });

  it('describes bash', () => {
    const bash = SHELL_SPECS.bash;
    expect(bash.shell).toBe('bash');
    expect(bash.shipped).toBe(true);
    expect(bash.rcFile).toBe('.bashrc');
    expect(bash.rcDisplay).toBe('~/.bashrc');
    expect(bash.adapterFile).toBe('queque.bash');
    expect(bash.failBelow).toBe('5.0');
    expect(bash.warnBelow).toBe('5.1');
    expect(bash.bindingWidget).toBe('_qq_question');
    expect([...bash.bindingKeymaps]).toEqual(['emacs', 'vi-insert']);
    expect([...bash.versionArgs]).toEqual([
      '--noprofile',
      '--norc',
      '-c',
      'printf %s "$BASH_VERSION"',
    ]);
  });

  it('lists fish as not shipped', () => {
    expect(SHELL_SPECS.fish.shipped).toBe(false);
    expect(SHELL_SPECS.fish.adapterFile).toBe('queque.fish');
  });

  it('keeps the floors as named constants', () => {
    expect(ZSH_FAIL_BELOW).toBe(SHELL_SPECS.zsh.failBelow);
    expect(ZSH_WARN_BELOW).toBe(SHELL_SPECS.zsh.warnBelow);
    expect(BASH_FAIL_BELOW).toBe(SHELL_SPECS.bash.failBelow);
    expect(BASH_WARN_BELOW).toBe(SHELL_SPECS.bash.warnBelow);
  });

  it('getShellSpec returns the spec for a name', () => {
    expect(getShellSpec('bash')).toBe(SHELL_SPECS.bash);
    expect(getShellSpec('zsh')).toBe(SHELL_SPECS.zsh);
  });
});

describe('shippedShellNames()', () => {
  it('ships zsh and bash only', () => {
    expect(shippedShellNames().join(',')).toBe('zsh,bash');
  });
});

describe('detectShell()', () => {
  it('takes a shell name argument first', () => {
    expect(detectShell({ arg: 'bash', env: { SHELL: '/bin/zsh' } })).toBe('bash');
  });

  it('rejects an argument that is not a shell name', () => {
    expect(detectShell({ arg: 'tcsh', env: { SHELL: '/bin/zsh' } })).toBeNull();
  });

  it('reads the basename of $SHELL', () => {
    expect(detectShell({ env: { SHELL: '/usr/local/bin/bash' } })).toBe('bash');
  });

  it('falls back to the passwd login shell', () => {
    expect(detectShell({ env: { SHELL: '/bin/sh' }, userShell: '/usr/bin/zsh' })).toBe('zsh');
  });

  it('returns fish so callers can say it is not shipped', () => {
    expect(detectShell({ env: { SHELL: '/opt/homebrew/bin/fish' } })).toBe('fish');
  });

  it('returns null when nothing is usable', () => {
    expect(detectShell({})).toBeNull();
    expect(detectShell({ env: { SHELL: '/bin/sh' }, userShell: '/bin/sh' })).toBeNull();
    expect(detectShell({ env: {}, userShell: '' })).toBeNull();
  });
});

describe('parseShellVersion() / versionBelow()', () => {
  it('parses a bash version string', () => {
    expect(parseShellVersion('5.2.21(1)-release')).toEqual([5, 2, 21]);
    expect(parseShellVersion('3.2.57(1)-release')).toEqual([3, 2, 57]);
  });

  it('parses a zsh version string', () => {
    expect(parseShellVersion('5.9\n')).toEqual([5, 9]);
  });

  it('returns null for garbage', () => {
    expect(parseShellVersion('garbage')).toBeNull();
    expect(parseShellVersion('')).toBeNull();
  });

  it('compares against a floor', () => {
    expect(versionBelow([4, 4, 20], BASH_FAIL_BELOW)).toBe(true);
    expect(versionBelow([5, 0], BASH_FAIL_BELOW)).toBe(false);
    expect(versionBelow([5, 0, 18], BASH_WARN_BELOW)).toBe(true);
    expect(versionBelow([5, 2, 21], BASH_WARN_BELOW)).toBe(false);
    expect(versionBelow([3, 2, 57], BASH_FAIL_BELOW)).toBe(true);
  });
});

describe('loginFileSourcesBashrc()', () => {
  const reader =
    (files: Record<string, string>) =>
    (relPath: string): string | null =>
      files[relPath] ?? null;

  it('lists the bash login files in bash order', () => {
    expect([...BASH_LOGIN_FILES]).toEqual(['.bash_profile', '.bash_login', '.profile']);
  });

  it('finds a .bash_profile that sources .bashrc', () => {
    const result = loginFileSourcesBashrc(
      reader({ '.bash_profile': '[ -f ~/.bashrc ] && . ~/.bashrc\n' }),
    );
    expect(result).toEqual({ file: '~/.bash_profile', sourcesBashrc: true });
  });

  it('reports a .bash_profile that does not source .bashrc', () => {
    const result = loginFileSourcesBashrc(
      reader({ '.bash_profile': 'export PATH=/opt/bin:$PATH\n', '.profile': '. ~/.bashrc\n' }),
    );
    expect(result).toEqual({ file: '~/.bash_profile', sourcesBashrc: false });
  });

  it('falls through to .profile when no .bash_profile exists', () => {
    const result = loginFileSourcesBashrc(reader({ '.profile': '. "$HOME/.bashrc"\n' }));
    expect(result).toEqual({ file: '~/.profile', sourcesBashrc: true });
  });

  it('reports no login file', () => {
    expect(loginFileSourcesBashrc(reader({}))).toEqual({ file: null, sourcesBashrc: false });
  });

  it('matches the usual source spellings', () => {
    for (const line of [
      '. ~/.bashrc',
      'source ~/.bashrc',
      '. "$HOME/.bashrc"',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal shell text, not a template
      'source ${HOME}/.bashrc',
      "if [ -f ~/.bashrc ]; then source '$HOME/.bashrc'; fi",
      'test -r ~/.bashrc && . ~/.bashrc',
    ]) {
      expect(BASHRC_SOURCE_RE.test(line), line).toBe(true);
    }
  });

  it('does not match a mention without a source command', () => {
    for (const line of ['# see ~/.bashrc', 'cp ~/.bashrc ~/.bashrc.bak', 'echo ~/.bashrc.d']) {
      expect(BASHRC_SOURCE_RE.test(line), line).toBe(false);
    }
  });
});

describe('resolveAdapterPath()', () => {
  it('prefers the first Homebrew prefix that has the adapter', () => {
    const present = new Set(['/usr/local/share/queque/queque.bash']);
    const path = resolveAdapterPath(SHELL_SPECS.bash, {
      prefixes: HOMEBREW_PREFIXES,
      packageShellDir: '/pkg/shell',
      exists: (p) => present.has(p),
    });
    expect(path).toBe('/usr/local/share/queque/queque.bash');
  });

  it('falls back to the package shell dir', () => {
    const path = resolveAdapterPath(SHELL_SPECS.bash, {
      packageShellDir: '/pkg/shell',
      exists: () => false,
    });
    expect(path).toBe('/pkg/shell/bash/queque.bash');
  });

  it('resolves the zsh adapter the same way', () => {
    const path = resolveAdapterPath(SHELL_SPECS.zsh, {
      prefixes: ['/opt/homebrew'],
      packageShellDir: '/pkg/shell',
      exists: (p) => p === '/opt/homebrew/share/queque/queque.zsh',
    });
    expect(path).toBe('/opt/homebrew/share/queque/queque.zsh');
  });
});
