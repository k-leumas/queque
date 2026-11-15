import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasShellIntegration, type InitDeps, runInit } from '../src/cli/commands/init.js';

describe('hasShellIntegration', () => {
  it('returns false for an empty or unrelated .zshrc', () => {
    expect(hasShellIntegration('', 'zsh')).toBe(false);
    expect(hasShellIntegration('export PATH=$PATH\n', 'zsh')).toBe(false);
  });

  it('returns false when queque appears only in an unrelated shell function stub', () => {
    expect(hasShellIntegration('queque() { :; }\n', 'zsh')).toBe(false);
  });

  it('returns true when the queque source line is present', () => {
    expect(hasShellIntegration('source "/opt/homebrew/share/queque/queque.zsh"\n', 'zsh')).toBe(
      true,
    );
  });

  it('returns true when the integration marker comment is present', () => {
    expect(hasShellIntegration('# queque shell integration\n', 'zsh')).toBe(true);
  });

  for (const shell of ['zsh', 'bash'] as const) {
    describe(`source forms for ${shell}`, () => {
      const p = `/p/queque.${shell}`;
      const present = [
        `source "${p}"`,
        `source '${p}'`,
        `. "${p}"`,
        `. '${p}'`,
        `. ${p}`,
        `source ${p}`,
        `[ -f ${p} ] && . ${p}`,
        `export X=1; source "${p}"`,
        `source "/Users/Jo Doe/queque.${shell}"`,
      ];
      for (const line of present) {
        it(`counts ${line}`, () => {
          expect(hasShellIntegration(`# rc\n${line}\n`, shell)).toBe(true);
        });
      }

      it('ignores a bare mention', () => {
        expect(hasShellIntegration(`# see queque.${shell}\n`, shell)).toBe(false);
        expect(hasShellIntegration(`cp ${p} /tmp\n`, shell)).toBe(false);
        expect(hasShellIntegration(`source "${p}.bak"\n`, shell)).toBe(false);
      });
    });
  }

  it("ignores the other shell's adapter", () => {
    expect(hasShellIntegration('source "/p/queque.zsh"\n', 'bash')).toBe(false);
    expect(hasShellIntegration('. /p/queque.bash\n', 'zsh')).toBe(false);
  });
});

describe('initCommand marker check', () => {
  it('documents the old search()-as-boolean bug that RegExp.test avoids', () => {
    const marker = /\bqueque\b/;
    const withoutMarker = 'export PATH=$PATH\n';

    expect(marker.test(withoutMarker)).toBe(false);
    expect(Boolean(withoutMarker.search(marker))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runInit with injected deps: an in-memory home whose write log proves which paths were touched.
// ---------------------------------------------------------------------------

const HOME = '/home/u';
const BASH_ADAPTER = '/pkg/shell/bash/queque.bash';
const ZSH_ADAPTER = '/pkg/shell/zsh/queque.zsh';

interface FakeOptions {
  files?: Record<string, string>;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  userShell?: string;
  which?: Record<string, string>;
  versions?: Record<string, string>;
}

function fakeInit(options: FakeOptions = {}) {
  const files = new Map(Object.entries(options.files ?? {}));
  const appended: string[] = [];
  const probed: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const deps: InitDeps = {
    home: HOME,
    env: options.env ?? {},
    platform: options.platform ?? 'linux',
    userShell: options.userShell,
    which: (name) => options.which?.[name] ?? null,
    probeVersion: (binary) => {
      probed.push(binary);
      return options.versions?.[binary] ?? null;
    },
    readFile: (path) => files.get(path) ?? null,
    appendFile: (path, text) => {
      appended.push(path);
      files.set(path, (files.get(path) ?? '') + text);
    },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    adapterPath: (spec) => (spec.shell === 'bash' ? BASH_ADAPTER : ZSH_ADAPTER),
  };
  return { deps, files, appended, probed, out, err };
}

const BASHRC = `${HOME}/.bashrc`;
const ZSHRC = `${HOME}/.zshrc`;
const BASH_PROFILE = `${HOME}/.bash_profile`;

describe('runInit() detection and rc writes', () => {
  it('detects bash from $SHELL and appends to ~/.bashrc', () => {
    const f = fakeInit({
      env: { SHELL: '/usr/local/bin/bash' },
      versions: { '/usr/local/bin/bash': '5.2.21(1)-release' },
    });
    const result = runInit(undefined, f.deps);
    expect(result).toEqual({ exitCode: 0, wrote: true });
    expect(f.files.get(BASHRC)).toBe(`\n# queque shell integration\nsource "${BASH_ADAPTER}"\n`);
    expect(f.appended).toEqual([BASHRC]);
    expect(f.out).toEqual(['queque: added shell integration to ~/.bashrc — run: source ~/.bashrc']);
  });

  it('qq init bash never touches .zshrc or .bash_profile when absent', () => {
    const f = fakeInit({
      env: { SHELL: '/bin/zsh' },
      which: { bash: '/opt/homebrew/bin/bash' },
      versions: { '/opt/homebrew/bin/bash': '5.3.9(1)-release' },
    });
    expect(runInit('bash', f.deps).exitCode).toBe(0);
    expect(f.files.has(ZSHRC)).toBe(false);
    expect(f.files.has(BASH_PROFILE)).toBe(false);
    expect(f.appended).toEqual([BASHRC]);
  });

  it('qq init bash leaves existing .zshrc and .bash_profile byte-identical', () => {
    const zshrc = 'export A=1\n';
    const profile = 'export PATH=/opt/bin:$PATH\n';
    const f = fakeInit({
      platform: 'darwin',
      env: { SHELL: '/opt/homebrew/bin/bash' },
      files: { [ZSHRC]: zshrc, [BASH_PROFILE]: profile },
      versions: { '/opt/homebrew/bin/bash': '5.3.9(1)-release' },
    });
    expect(runInit('bash', f.deps).exitCode).toBe(0);
    expect(f.files.get(ZSHRC)).toBe(zshrc);
    expect(f.files.get(BASH_PROFILE)).toBe(profile);
    expect(f.appended).toEqual([BASHRC]);
  });

  it('qq init zsh leaves an existing .bashrc byte-identical', () => {
    const bashrc = 'alias ll="ls -l"\n';
    const f = fakeInit({ env: { SHELL: '/bin/bash' }, files: { [BASHRC]: bashrc } });
    expect(runInit('zsh', f.deps)).toEqual({ exitCode: 0, wrote: true });
    expect(f.files.get(BASHRC)).toBe(bashrc);
    expect(f.appended).toEqual([ZSHRC]);
  });

  it('the zsh argument wins over a bash $SHELL and skips the bash probe', () => {
    const f = fakeInit({ env: { SHELL: '/bin/bash' } });
    runInit('zsh', f.deps);
    expect(f.files.get(ZSHRC)).toContain(`source "${ZSH_ADAPTER}"`);
    expect(f.probed).toEqual([]);
    expect(f.out).toEqual(['queque: added shell integration to ~/.zshrc — run: source ~/.zshrc']);
  });

  it('a second run leaves the rc file unchanged and exits 0', () => {
    const f = fakeInit({
      env: { SHELL: '/usr/local/bin/bash' },
      versions: { '/usr/local/bin/bash': '5.2.21(1)-release' },
    });
    runInit(undefined, f.deps);
    const after = f.files.get(BASHRC);
    const again = runInit(undefined, f.deps);
    expect(again).toEqual({ exitCode: 0, wrote: false });
    expect(f.files.get(BASHRC)).toBe(after);
    expect(f.appended).toEqual([BASHRC]);
    expect(f.err).toContain('queque: shell integration already present in ~/.bashrc');
  });

  it('a dot-source line already in ~/.bashrc is not duplicated', () => {
    const bashrc = '. "/somewhere/queque.bash"\n';
    const f = fakeInit({
      env: { SHELL: '/usr/local/bin/bash' },
      files: { [BASHRC]: bashrc },
      versions: { '/usr/local/bin/bash': '5.2.21(1)-release' },
    });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 0, wrote: false });
    expect(f.files.get(BASHRC)).toBe(bashrc);
  });
});

describe('runInit() bash binary pinning', () => {
  it('probes the $SHELL bash, not the PATH bash', () => {
    const f = fakeInit({
      env: { SHELL: '/opt/homebrew/bin/bash' },
      which: { bash: '/bin/bash' },
      versions: { '/opt/homebrew/bin/bash': '5.2.21(1)-release', '/bin/bash': '3.2.57(1)-release' },
    });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 0, wrote: true });
    expect(f.probed).toEqual(['/opt/homebrew/bin/bash']);
  });

  it('probes the PATH bash when $SHELL is not bash', () => {
    const f = fakeInit({
      env: { SHELL: '/bin/zsh' },
      which: { bash: '/opt/homebrew/bin/bash' },
      versions: { '/opt/homebrew/bin/bash': '5.2.21(1)-release' },
    });
    expect(runInit('bash', f.deps)).toEqual({ exitCode: 0, wrote: true });
    expect(f.probed).toEqual(['/opt/homebrew/bin/bash']);
  });
});

describe('runInit() bash version gate', () => {
  it('refuses macOS /bin/bash 3.2 with the brew hint', () => {
    const f = fakeInit({
      platform: 'darwin',
      env: { SHELL: '/bin/bash' },
      versions: { '/bin/bash': '3.2.57(1)-release' },
    });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual(['bash 5+ needed: brew install bash']);
    expect(f.appended).toEqual([]);
  });

  it('names chsh when a newer bash is installed but not the login shell', () => {
    const f = fakeInit({
      platform: 'darwin',
      env: { SHELL: '/bin/bash' },
      which: { bash: '/opt/homebrew/bin/bash' },
      versions: { '/bin/bash': '3.2.57(1)-release', '/opt/homebrew/bin/bash': '5.3.9(1)-release' },
    });
    expect(runInit(undefined, f.deps).exitCode).toBe(1);
    expect(f.err[0]).toBe('bash 5+ needed: brew install bash');
    expect(f.err).toHaveLength(2);
    expect(f.err[1]).toContain('/etc/shells');
    expect(f.err[1]).toContain('chsh');
    expect(f.err[1]).not.toContain('/opt/homebrew');
    expect(f.appended).toEqual([]);
  });

  it('refuses bash 4.4 elsewhere with the generic copy', () => {
    const f = fakeInit({
      platform: 'linux',
      env: { SHELL: '/bin/bash' },
      versions: { '/bin/bash': '4.4.20(1)-release' },
    });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual(['bash 5.0 or newer is needed for the ?? trigger']);
    expect(f.appended).toEqual([]);
  });

  it('says bash was not found when no bash exists', () => {
    const f = fakeInit({ env: { SHELL: '/bin/zsh' } });
    expect(runInit('bash', f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err.join('\n')).toMatch(/bash not found/);
    expect(f.appended).toEqual([]);
  });

  it('treats an unreadable version as not found', () => {
    const f = fakeInit({ env: { SHELL: '/bin/bash' }, versions: { '/bin/bash': 'garbage' } });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err.join('\n')).toMatch(/bash not found/);
  });
});

describe('runInit() unsupported and undetectable shells', () => {
  const FISH = 'queque: fish support is coming in a later release; supported now: zsh, bash';

  it('qq init fish writes nothing and exits 1', () => {
    const f = fakeInit({ env: { SHELL: '/bin/zsh' } });
    expect(runInit('fish', f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual([FISH]);
    expect(f.appended).toEqual([]);
  });

  it('a detected fish login shell writes nothing and exits 1', () => {
    const f = fakeInit({ env: { SHELL: '/usr/bin/fish' }, userShell: '/usr/bin/fish' });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual([FISH]);
  });

  it('an undetectable shell names both init commands', () => {
    const f = fakeInit({ env: { SHELL: '/bin/sh' }, userShell: '/bin/sh' });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual(['queque: could not detect your shell; run qq init zsh or qq init bash']);
  });

  it('falls back to the passwd shell when $SHELL is sh', () => {
    const f = fakeInit({ env: { SHELL: '/bin/sh' }, userShell: '/bin/zsh' });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 0, wrote: true });
    expect(f.appended).toEqual([ZSHRC]);
  });

  it('qq init tcsh lists the supported shells', () => {
    const f = fakeInit({ env: { SHELL: '/bin/zsh' } });
    expect(runInit('tcsh', f.deps)).toEqual({ exitCode: 1, wrote: false });
    expect(f.err).toEqual(["Unsupported shell: 'tcsh'. Supported: zsh, bash"]);
  });
});

describe('runInit() macOS login-shell hint', () => {
  const HINT = 'queque: macOS terminals start login shells; make ~/.bash_profile source ~/.bashrc';

  it('prints the hint when .bash_profile does not source .bashrc', () => {
    const profile = 'export PATH=/opt/bin:$PATH\n';
    const f = fakeInit({
      platform: 'darwin',
      env: { SHELL: '/opt/homebrew/bin/bash' },
      files: { [BASH_PROFILE]: profile },
      versions: { '/opt/homebrew/bin/bash': '5.3.9(1)-release' },
    });
    expect(runInit(undefined, f.deps)).toEqual({ exitCode: 0, wrote: true });
    expect(f.err).toContain(HINT);
    expect(f.err.join('\n')).toContain('[ -f ~/.bashrc ] && . ~/.bashrc');
    expect(f.files.get(BASH_PROFILE)).toBe(profile);
    expect(f.appended).toEqual([BASHRC]);
  });

  it('stays quiet when .bash_profile sources .bashrc', () => {
    const f = fakeInit({
      platform: 'darwin',
      env: { SHELL: '/opt/homebrew/bin/bash' },
      files: { [BASH_PROFILE]: '[ -f ~/.bashrc ] && . ~/.bashrc\n' },
      versions: { '/opt/homebrew/bin/bash': '5.3.9(1)-release' },
    });
    runInit(undefined, f.deps);
    expect(f.err).toEqual([]);
  });

  it('does not print the hint on linux', () => {
    const f = fakeInit({
      platform: 'linux',
      env: { SHELL: '/usr/bin/bash' },
      versions: { '/usr/bin/bash': '5.2.21(1)-release' },
    });
    runInit(undefined, f.deps);
    expect(f.err).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The same rules against a real temp home: only the chosen rc file appears on disk.
// ---------------------------------------------------------------------------

describe('runInit() against a temp home', () => {
  let home: string | undefined;

  afterEach(() => {
    if (home) {
      rmSync(home, { recursive: true, force: true });
      home = undefined;
    }
  });

  function diskDeps(dir: string, shellEnv: string): InitDeps {
    const f = fakeInit({ env: { SHELL: shellEnv }, versions: { [shellEnv]: '5.2.21(1)-release' } });
    return {
      ...f.deps,
      home: dir,
      readFile: (path) => {
        try {
          return readFileSync(path, 'utf8');
        } catch {
          return null;
        }
      },
      appendFile: (path, text) => writeFileSync(path, text, { flag: 'a' }),
    };
  }

  it('qq init bash creates only .bashrc', () => {
    home = mkdtempSync(join(tmpdir(), 'qq-init-'));
    expect(runInit('bash', diskDeps(home, '/usr/bin/bash')).exitCode).toBe(0);
    expect(readdirSync(home)).toEqual(['.bashrc']);
  });

  it('qq init zsh creates only .zshrc', () => {
    home = mkdtempSync(join(tmpdir(), 'qq-init-'));
    expect(runInit('zsh', diskDeps(home, '/bin/zsh')).exitCode).toBe(0);
    expect(readdirSync(home)).toEqual(['.zshrc']);
  });
});
