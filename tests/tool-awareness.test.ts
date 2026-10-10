/**
 * Characterization tests for the shipped missing-tool semantics (09-01 Task 1).
 * Inventories are built directly with `new Set([...])` (unit scope); in production builtins
 * come only from the zsh handoff's builtins.txt (D-02).
 */

import { describe, expect, it } from 'vitest';
import {
  annotateCandidates,
  buildInstallForm,
  INSTALL_COMMANDS,
  isInstalled,
  LINUX_INSTALLER_ORDER,
  missingTools,
  PACKAGE_ALIASES,
  packageFor,
  pickInstaller,
  planInstall,
  SAFE_PACKAGE_NAME_RE,
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

describe('pickInstaller (D-11)', () => {
  it('uses brew on darwin when brew is installed', () => {
    expect(pickInstaller(inv({ commands: ['brew'] }), 'darwin')).toBe('brew');
  });

  it('returns null on darwin without brew', () => {
    expect(pickInstaller(inv({ commands: ['apt'] }), 'darwin')).toBeNull();
  });

  it('accepts brew present only as a function on darwin', () => {
    expect(pickInstaller(inv({ functions: ['brew'] }), 'darwin')).toBe('brew');
  });

  it('picks the first of apt, dnf, pacman on linux', () => {
    expect(LINUX_INSTALLER_ORDER).toEqual(['apt', 'dnf', 'pacman']);
    expect(pickInstaller(inv({ commands: ['dnf', 'pacman'] }), 'linux')).toBe('dnf');
    expect(pickInstaller(inv({ commands: ['apt', 'dnf'] }), 'linux')).toBe('apt');
    expect(pickInstaller(inv({ commands: ['pacman'] }), 'linux')).toBe('pacman');
  });

  it('returns null on linux with no manager and on unsupported platforms', () => {
    expect(pickInstaller(inv({ commands: ['brew'] }), 'linux')).toBeNull();
    expect(pickInstaller(inv({ commands: ['brew', 'apt'] }), 'win32')).toBeNull();
  });
});

describe('packageFor and PACKAGE_ALIASES (D-12)', () => {
  it('maps known binaries to their Homebrew formula', () => {
    expect(packageFor('rg', 'brew')).toBe('ripgrep');
    expect(packageFor('magick', 'brew')).toBe('imagemagick');
    expect(packageFor('convert', 'brew')).toBe('imagemagick');
    expect(packageFor('nvim', 'brew')).toBe('neovim');
    expect(packageFor('http', 'brew')).toBe('httpie');
    expect(packageFor('timeout', 'brew')).toBe('coreutils');
    expect(packageFor('gdate', 'brew')).toBe('coreutils');
    expect(packageFor('nproc', 'brew')).toBe('coreutils');
    expect(packageFor('sha256sum', 'brew')).toBe('coreutils');
    expect(packageFor('gsed', 'brew')).toBe('gnu-sed');
    expect(packageFor('kubectl', 'brew')).toBe('kubernetes-cli');
    expect(packageFor('dig', 'brew')).toBe('bind');
  });

  it('installs an unmapped tool under its own name on every manager', () => {
    for (const installer of ['brew', 'apt', 'dnf', 'pacman'] as const) {
      expect(packageFor('xh', installer)).toBe('xh');
      expect(packageFor('constructor', installer)).toBe('constructor');
    }
    expect(packageFor('fd', 'brew')).toBe('fd');
    expect(packageFor('fd', 'pacman')).toBe('fd');
  });

  it('uses each Linux manager its own package names (WR-01)', () => {
    // Not in Debian/Ubuntu main (needs the Kubernetes apt repo), so no package is named.
    expect(packageFor('kubectl', 'apt')).toBeNull();
    expect(packageFor('kubectl', 'dnf')).toBe('kubernetes-client');
    expect(packageFor('kubectl', 'pacman')).toBe('kubectl');
    expect(packageFor('dig', 'apt')).toBe('bind9-dnsutils');
    expect(packageFor('dig', 'dnf')).toBe('bind-utils');
    expect(packageFor('dig', 'pacman')).toBe('bind');
    expect(packageFor('ag', 'apt')).toBe('silversearcher-ag');
    expect(packageFor('ag', 'dnf')).toBe('the_silver_searcher');
    expect(packageFor('fdfind', 'apt')).toBe('fd-find');
    expect(packageFor('batcat', 'apt')).toBe('bat');
    expect(packageFor('fd', 'dnf')).toBe('fd-find');
    expect(packageFor('rg', 'apt')).toBe('ripgrep');
    expect(packageFor('timeout', 'dnf')).toBe('coreutils');
  });

  it('names no package where the Homebrew name would be wrong or the binary differs (WR-01)', () => {
    // macOS-only names: no Linux package installs gsed/gtimeout/gdate/gtime.
    for (const installer of ['apt', 'dnf', 'pacman'] as const) {
      expect(packageFor('gsed', installer)).toBeNull();
      expect(packageFor('gtimeout', installer)).toBeNull();
      expect(packageFor('gdate', installer)).toBeNull();
      expect(packageFor('gtime', installer)).toBeNull();
    }
    // apt's fd-find/bat install fdfind/batcat, so `&& fd`/`&& bat` would still fail.
    expect(packageFor('fd', 'apt')).toBeNull();
    expect(packageFor('bat', 'apt')).toBeNull();
    // Debian binary names have no Homebrew formula.
    expect(packageFor('fdfind', 'brew')).toBeNull();
    expect(packageFor('batcat', 'brew')).toBeNull();
    // A Homebrew alias with no verified entry for this manager is never guessed.
    expect(packageFor('magick', 'apt')).toBeNull();
    expect(packageFor('vd', 'pacman')).toBeNull();
  });

  it('never emits a Homebrew-only formula name on a Linux manager', () => {
    for (const installer of ['apt', 'dnf', 'pacman'] as const) {
      for (const tool of ['kubectl', 'dig', 'ag', 'gsed', 'gtimeout', 'gdate', 'gtime']) {
        const pkg = packageFor(tool, installer);
        if (pkg === null) continue;
        expect(['kubernetes-cli', 'gnu-sed', 'gnu-time']).not.toContain(pkg);
        if (installer !== 'pacman') expect(pkg).not.toBe('bind');
        if (installer === 'apt') expect(pkg).not.toBe('the_silver_searcher');
      }
    }
  });

  it('every alias value is a safe package name or null', () => {
    expect(PACKAGE_ALIASES.brew.size).toBeGreaterThanOrEqual(30);
    for (const installer of ['brew', 'apt', 'dnf', 'pacman'] as const) {
      for (const value of PACKAGE_ALIASES[installer].values()) {
        if (value !== null) expect(value).toMatch(SAFE_PACKAGE_NAME_RE);
      }
    }
  });
});

describe('planInstall — exact install forms (D-09, D-10)', () => {
  it('maps the package and prefixes the installer', () => {
    expect(planInstall('rg TODO -t ts', ['rg'], 'brew')).toEqual({
      form: 'brew install ripgrep && rg TODO -t ts',
      packages: ['ripgrep'],
      blocked: null,
    });
  });

  it('covers every missing tool in one step and does not wrap a pipeline', () => {
    expect(planInstall('fd . | xh get example.com', ['fd', 'xh'], 'brew').form).toBe(
      'brew install fd xh && fd . | xh get example.com',
    );
  });

  it('does not wrap an &&-only chain', () => {
    expect(planInstall('fd x && rg y', ['fd', 'rg'], 'brew').form).toBe(
      'brew install fd ripgrep && fd x && rg y',
    );
  });

  it('deduplicates packages in first-seen order', () => {
    expect(
      planInstall('magick a.png b.jpg && convert c.png d.jpg', ['magick', 'convert'], 'brew')
        .packages,
    ).toEqual(['imagemagick']);
  });

  it('installs coreutils for timeout', () => {
    expect(planInstall('timeout 5 fd x', ['timeout', 'fd'], 'brew').form).toBe(
      'brew install coreutils fd && timeout 5 fd x',
    );
  });

  it('uses sudo and no auto-confirm on linux managers', () => {
    expect(planInstall('fdfind -e ts', ['fdfind'], 'apt').form).toBe(
      'sudo apt install fd-find && fdfind -e ts',
    );
    expect(planInstall('fd x', ['fd'], 'pacman').form?.startsWith('sudo pacman -S ')).toBe(true);
    expect(planInstall('fd x', ['fd'], 'dnf').form?.startsWith('sudo dnf install ')).toBe(true);
    expect(INSTALL_COMMANDS).toEqual({
      brew: 'brew install',
      apt: 'sudo apt install',
      dnf: 'sudo dnf install',
      pacman: 'sudo pacman -S',
    });
  });

  it('never emits -y or --noconfirm', () => {
    for (const installer of ['brew', 'apt', 'dnf', 'pacman'] as const) {
      const form = planInstall('fd x', ['fd'], installer).form ?? '';
      expect(form).not.toContain('-y');
      expect(form).not.toContain('--noconfirm');
    }
  });
});

describe('planInstall — list wrapping (T-09-11)', () => {
  it('wraps a ; list in a brace group', () => {
    expect(planInstall('cd src; fd x', ['fd'], 'brew').form).toBe(
      'brew install fd && { cd src; fd x; }',
    );
  });

  it('does not double a trailing ;', () => {
    expect(planInstall('cd src; fd x;', ['fd'], 'brew').form).toBe(
      'brew install fd && { cd src; fd x; }',
    );
  });

  it('wraps an || list', () => {
    expect(planInstall('fd x || echo none', ['fd'], 'brew').form).toBe(
      'brew install fd && { fd x || echo none; }',
    );
  });

  it('wraps a trailing & after a 2>&1 redirection without adding ;', () => {
    expect(planInstall('nohup fd x 2>&1 &', ['fd'], 'brew').form).toBe(
      'brew install fd && { nohup fd x 2>&1 & }',
    );
  });

  it('treats a newline as a list operator', () => {
    expect(planInstall('cd src\nfd x', ['fd'], 'brew').form).toBe(
      'brew install fd && { cd src\nfd x; }',
    );
  });

  it('leaves a comment alone when no wrap is needed', () => {
    expect(planInstall('fd x # find stuff', ['fd'], 'brew').form).toBe(
      'brew install fd && fd x # find stuff',
    );
  });
});

describe('planInstall — blocked plans (T-09-10, T-09-20)', () => {
  it('blocks a list with a comment (the } would be commented out)', () => {
    expect(planInstall('cd src; fd x # note', ['fd'], 'brew')).toEqual({
      form: null,
      packages: [],
      blocked: 'unwrappable-command',
    });
  });

  it('blocks a list with a heredoc (the terminator would move)', () => {
    expect(planInstall('fd x; cat <<EOF\nbody\nEOF', ['fd'], 'brew')).toEqual({
      form: null,
      packages: [],
      blocked: 'unwrappable-command',
    });
  });

  it('blocks a quoted or metacharacter-bearing missing word', () => {
    expect(planInstall('"rm -rf ~"', ['rm -rf ~'], 'brew')).toEqual({
      form: null,
      packages: [],
      blocked: 'unsafe-package-name',
    });
  });

  it('blocks when the manager has no package we can name (WR-01)', () => {
    expect(planInstall('dig example.com', ['dig'], 'apt').form).toBe(
      'sudo apt install bind9-dnsutils && dig example.com',
    );
    expect(planInstall('gsed -i s/a/b/ f', ['gsed'], 'apt')).toEqual({
      form: null,
      packages: [],
      blocked: 'unknown-package',
    });
    expect(planInstall('fd x | rg y', ['fd', 'rg'], 'apt')).toEqual({
      form: null,
      packages: [],
      blocked: 'unknown-package',
    });
    expect(planInstall('kubectl get pods', ['kubectl'], 'apt')).toEqual({
      form: null,
      packages: [],
      blocked: 'unknown-package',
    });
  });

  it('blocks when there is no package manager', () => {
    expect(planInstall('fd x', ['fd'], null)).toEqual({
      form: null,
      packages: [],
      blocked: 'no-package-manager',
    });
  });

  it('buildInstallForm returns null for an unwrappable command', () => {
    expect(buildInstallForm('cd src; fd x # note', ['fd'], 'brew')).toBeNull();
    expect(buildInstallForm('fd x', ['fd'], 'brew')).toBe('brew install fd && fd x');
  });
});

describe('annotateCandidates — install plans', () => {
  it('attaches an install plan only to flagged candidates and keeps the order', () => {
    const annotated = annotateCandidates(
      [
        { command: 'fd -e ts', explanation: 'flagged' },
        { command: 'git status', explanation: 'clean' },
      ],
      inv({ commands: ['brew', 'git'] }),
      'darwin',
    );
    expect(annotated.map((c) => c.explanation)).toEqual(['flagged', 'clean']);
    expect(annotated[0].install).toEqual({
      form: 'brew install fd && fd -e ts',
      packages: ['fd'],
      blocked: null,
    });
    expect('install' in annotated[1]).toBe(false);
  });

  it('never offers to install a wrapper option value (CR-02: sudo --user root)', () => {
    const annotated = annotateCandidates(
      [
        { command: 'sudo --user root fd x', explanation: 'as root' },
        { command: "watch -n 2 'kubectl get pods'", explanation: 'pods' },
      ],
      inv({ commands: ['brew', 'sudo', 'watch', 'kubectl'] }),
      'darwin',
    );
    expect(annotated[0].missingTools).toEqual(['fd']);
    expect(annotated[0].install?.form).toBe('brew install fd && sudo --user root fd x');
    expect('missingTools' in annotated[1]).toBe(false);
  });

  it('marks flagged candidates blocked when no manager exists', () => {
    const annotated = annotateCandidates(
      [{ command: 'fd -e ts', explanation: 'flagged' }],
      inv(),
      'linux',
    );
    expect(annotated[0].install?.blocked).toBe('no-package-manager');
  });
});

describe('no use-before-install or wrong-OS logic (D-07)', () => {
  it('judges an install step after use by the normal rule', () => {
    expect(missingTools('fd -e ts && brew install fd', inv({ commands: ['brew'] }))).toEqual([
      'fd',
    ]);
  });

  it('judges a wrong-OS installer by the normal rule', () => {
    expect(missingTools('apt install jq', inv({ commands: ['brew', 'jq'] }))).toEqual(['apt']);
  });
});
