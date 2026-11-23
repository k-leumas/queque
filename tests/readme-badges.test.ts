import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SHELL_NAMES } from '../src/contracts/shell.js';
import { SHELL_SPECS } from '../src/shared/shell-registry.js';

const ROOT = resolve(__dirname, '..');
const README = resolve(ROOT, 'README.md');
const WORKFLOWS = resolve(ROOT, '.github', 'workflows');
const REPO = 'k-leumas/queque';
const CI_RUNS = `https://github.com/${REPO}/actions/workflows/ci.yml`;
const REPO_BLOB = `https://github.com/${REPO}/blob/main/`;
const INSTALL_DOC = `${REPO_BLOB}docs/INSTALL.md`;
const CI_LINE = /^Tested in \[CI\]\([^)]+\) on (.+)$/m;

// Docker image name (the part before `:`) -> the name the README's CI line uses.
const DISTRO_NAMES = new Map<string, string>([
  ['ubuntu', 'Ubuntu'],
  ['debian', 'Debian'],
  ['fedora', 'Fedora'],
  ['archlinux', 'Arch Linux'],
  ['alpine', 'Alpine'],
]);

type Badge = { alt: string; img: string; href: string };

function parseBadges(markdown: string): Badge[] {
  const re = /\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g;
  return [...markdown.matchAll(re)].map((m) => ({
    alt: m[1] ?? '',
    img: m[2] ?? '',
    href: m[3] ?? '',
  }));
}

function ciImages(): string[] {
  const ci = readFileSync(resolve(WORKFLOWS, 'ci.yml'), 'utf8');
  const matches = [...ci.matchAll(/^\s*images:\s*'(\[.*\])'\s*$/gm)];
  expect(matches, "ci.yml must have exactly one `images: '[...]'` line").toHaveLength(1);
  const parsed: unknown = JSON.parse(matches[0]?.[1] ?? '[]');
  expect(Array.isArray(parsed), 'ci.yml images must be a JSON array').toBe(true);
  return parsed as string[];
}

function runsOnValues(): string[] {
  const values: string[] = [];
  for (const file of readdirSync(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = readFileSync(resolve(WORKFLOWS, file), 'utf8');
    for (const m of text.matchAll(/^\s*runs-on:\s*(.+?)\s*$/gm)) {
      values.push(m[1] ?? '');
    }
  }
  return values;
}

function readmeText(): string {
  return readFileSync(README, 'utf8');
}

function readmeBadges(): Badge[] {
  return parseBadges(readmeText());
}

function isStaticShieldsBadge(badge: Badge): boolean {
  try {
    const url = new URL(badge.img);
    return url.host === 'img.shields.io' && url.pathname.startsWith('/badge/');
  } catch {
    return false;
  }
}

// Decoded dash-separated parts of a static shields badge: [label, message, colour] or
// [message, colour] when the badge has no label segment.
function staticBadgeParts(badge: Badge): string[] {
  const segment = new URL(badge.img).pathname.slice('/badge/'.length);
  return segment.split('-').map((part) => decodeURIComponent(part));
}

function ciLine(): { text: string; href: string } {
  const text = readmeText();
  const m = CI_LINE.exec(text);
  expect(m, 'README.md must have one line starting `Tested in [CI](...) on`').not.toBeNull();
  const href = /^Tested in \[CI\]\(([^)]+)\)/.exec(m?.[0] ?? '')?.[1] ?? '';
  return { text: m?.[1] ?? '', href };
}

describe('README badges', () => {
  it('the CI line names every distro in the CI matrix and links the CI runs', () => {
    const images = ciImages();
    expect(images.length, 'ci.yml images array must not be empty').toBeGreaterThan(0);
    const { text, href } = ciLine();
    expect(href, 'the CI line must link the CI runs page').toBe(CI_RUNS);
    for (const image of images) {
      expect(image, `ci.yml image "${image}" must look like name:tag`).toMatch(/^[^:\s]+:[^:\s]+$/);
      const [name = '', tag = ''] = image.split(':');
      const display = DISTRO_NAMES.get(name);
      expect(
        display,
        `no display name for image "${name}"; add it to DISTRO_NAMES in tests/readme-badges.test.ts`,
      ).toBeDefined();
      expect(text, `README CI line must name ${display} (from ci.yml "${image}")`).toContain(
        display as string,
      );
      if (tag !== 'latest') {
        expect(
          text,
          `README CI line must show ${display} ${tag} (from ci.yml "${image}")`,
        ).toContain(tag);
      }
    }
  });

  it('the CI line says macOS is tested by hand while no workflow runs on macOS', () => {
    const macRunner = runsOnValues().some((v) => /macos/i.test(v));
    const { text } = ciLine();
    if (!macRunner) {
      expect(text, 'macOS has no CI runner, so the CI line must say "macOS (by hand)"').toContain(
        'macOS (by hand)',
      );
    }
  });

  it('README has no distro badge row', () => {
    const distroBadges = readmeBadges().filter(
      (b) => isStaticShieldsBadge(b) && b.href === CI_RUNS,
    );
    expect(distroBadges, 'distros are listed in the one-line CI sentence, not as badges').toEqual(
      [],
    );
  });

  it('shell badges match the shell registry', () => {
    const badges = readmeBadges().filter(isStaticShieldsBadge);
    for (const name of SHELL_NAMES) {
      const spec = SHELL_SPECS[name];
      const matching = badges.filter((b) => {
        const parts = staticBadgeParts(b);
        return parts.length === 3 && parts[0] === name;
      });
      if (!spec.shipped) {
        expect(
          matching.length,
          `README must not show a "${name}" badge while ${name} is not shipped`,
        ).toBe(0);
        continue;
      }
      expect(
        matching.length,
        `README must have exactly one "${name}" shell badge in the shell row`,
      ).toBe(1);
      const badge = matching[0] as Badge;
      const [, message = ''] = staticBadgeParts(badge);
      const version = `${spec.failBelow}+`;
      expect(badge.alt, `README ${name} badge alt text must be "${name} ${version}"`).toBe(
        `${name} ${version}`,
      );
      expect(message, `README ${name} badge must show "${version}" (SHELL_SPECS failBelow)`).toBe(
        version,
      );
      expect(
        badge.href.startsWith(`${INSTALL_DOC}#`),
        `README ${name} badge must link a docs/INSTALL.md section`,
      ).toBe(true);
    }
  });

  it('README shows only the CI status badge and no Supported platforms table', () => {
    const text = readmeText();
    expect(
      /img\.shields\.io\/github\/actions\/workflow\/status\//.test(text),
      'README.md must not show shields workflow-status badges; use the one native CI badge',
    ).toBe(false);
    const native = [...text.matchAll(/\/actions\/workflows\/([^/\s)"]+)\/badge\.svg/g)].map(
      (m) => m[1],
    );
    expect(native, 'README.md must show exactly one workflow badge, for ci.yml').toEqual([
      'ci.yml',
    ]);
    expect(
      /^### Supported platforms$/m.test(text),
      'README.md must not bring back the Supported platforms table; the CI line carries it',
    ).toBe(false);
  });
});
