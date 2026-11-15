import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const README = resolve(ROOT, 'README.md');
const WORKFLOWS = resolve(ROOT, '.github', 'workflows');
const REPO = 'k-leumas/queque';
const CI_RUNS = `https://github.com/${REPO}/actions/workflows/ci.yml`;
const REPO_BLOB = `https://github.com/${REPO}/blob/main/`;
const INSTALL_DOC = `${REPO_BLOB}docs/INSTALL.md`;
const TESTS_PASSING_LINE = /^Tests passing on:\\$/m;

const WORKFLOW_BADGES: readonly { name: string; file: string }[] = [
  { name: 'CI', file: 'ci.yml' },
  { name: 'Nightly', file: 'nightly.yml' },
  { name: 'Release', file: 'release.yaml' },
];

// Docker image name (the part before `:`) -> simple-icons logo slug.
const LOGO_SLUGS = new Map<string, string>([
  ['ubuntu', 'ubuntu'],
  ['debian', 'debian'],
  ['fedora', 'fedora'],
  ['archlinux', 'archlinux'],
  ['alpine', 'alpinelinux'],
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

// The "Tests passing on:" row: static shields badges linking the CI runs page. The CI
// workflow-status badge is excluded by its /github/actions/ path; the shell and macOS badges
// link docs/INSTALL.md.
function distroBadges(): Badge[] {
  return readmeBadges().filter((b) => isStaticShieldsBadge(b) && b.href === CI_RUNS);
}

function badgeMarkdown(badge: Badge): string {
  return `[![${badge.alt}](${badge.img})](${badge.href})`;
}

describe('README badges', () => {
  it('workflow status badges link to existing workflows on main', () => {
    const badges = readmeBadges();
    for (const { name, file } of WORKFLOW_BADGES) {
      const matching = badges.filter((b) => b.alt === name);
      expect(
        matching.length,
        `README must have exactly one "${name}" workflow badge; add it under the H1 in README.md`,
      ).toBe(1);
      const badge = matching[0] as Badge;
      const url = new URL(badge.img);
      expect(url.host, `${name} badge must be served by img.shields.io`).toBe('img.shields.io');
      expect(url.pathname, `${name} badge must point at the ${file} workflow status`).toBe(
        `/github/actions/workflow/status/${REPO}/${file}`,
      );
      expect(url.searchParams.get('branch'), `${name} badge must report branch main`).toBe('main');
      expect(url.searchParams.get('label'), `${name} badge label must be "${name}"`).toBe(name);
      expect(badge.href, `${name} badge must link to its workflow runs page`).toBe(
        `https://github.com/${REPO}/actions/workflows/${file}`,
      );
      expect(
        existsSync(resolve(WORKFLOWS, file)),
        `.github/workflows/${file} must exist for the ${name} badge`,
      ).toBe(true);
    }
  });

  it('distro badges equal the CI matrix', () => {
    const images = ciImages();
    expect(images.length, 'ci.yml images array must not be empty').toBeGreaterThan(0);
    for (const image of images) {
      expect(image, `ci.yml image "${image}" must look like name:tag`).toMatch(/^[^:\s]+:[^:\s]+$/);
    }
    const refs = distroBadges().map((b) => b.alt);
    expect(
      refs,
      'README distro badges must equal ci.yml images; update the "Tests passing on:" badges in README.md',
    ).toEqual(images);
  });

  it('distro badges show only the distro name, logo and CI link', () => {
    const badges = distroBadges();
    expect(badges.length, 'README must have "Tests passing on:" distro badges').toBeGreaterThan(0);
    for (const badge of badges) {
      const ref = badge.alt;
      const [name = '', tag = ''] = ref.split(':');
      const url = new URL(badge.img);
      expect(url.protocol, `${ref} badge must use https`).toBe('https:');
      expect(url.host, `${ref} badge must be served by img.shields.io`).toBe('img.shields.io');
      expect(url.pathname.startsWith('/badge/'), `${ref} badge must be a static /badge/ URL`).toBe(
        true,
      );
      const parts = staticBadgeParts(badge);
      expect(
        parts,
        `${ref} badge must have only a message and a colour (no label segment)`,
      ).toHaveLength(2);
      const [message = ''] = parts;
      expect(message, `${ref} badge message must contain the image tag "${tag}"`).toContain(tag);
      const slug = LOGO_SLUGS.get(name);
      expect(
        slug,
        `no simple-icons logo slug for image "${name}"; add it to LOGO_SLUGS in tests/readme-badges.test.ts`,
      ).toBeDefined();
      expect(url.searchParams.get('logo'), `${ref} badge logo must be "${slug}"`).toBe(slug);
      expect(badge.href, `${ref} badge must link to the CI runs page`).toBe(CI_RUNS);
    }
  });

  it('the distro row sits under a Tests passing on: line', () => {
    const text = readmeText();
    const label = TESTS_PASSING_LINE.exec(text);
    expect(
      label,
      'README.md must have a line that is exactly `Tests passing on:\\` above the distro badges',
    ).not.toBeNull();
    const first = distroBadges()[0];
    expect(first, 'README must have "Tests passing on:" distro badges').toBeDefined();
    const firstIndex = text.indexOf(badgeMarkdown(first as Badge));
    expect(
      label?.index ?? -1,
      'the `Tests passing on:\\` line must come before the first distro badge in README.md',
    ).toBeLessThan(firstIndex);
  });

  it('the macOS badge links to the install guide, not CI, while no workflow runs on macOS', () => {
    const macRunner = runsOnValues().some((v) => /macos/i.test(v));
    const macBadges = readmeBadges().filter((b) => /macos/i.test(b.alt) || /macos/i.test(b.img));
    expect(
      macBadges.length,
      'README must have exactly one macOS badge at the end of the "Tests passing on:" row',
    ).toBe(1);
    if (!macRunner) {
      expect(
        (macBadges[0] as Badge).href,
        'macOS is tested by hand, so its README badge must link docs/INSTALL.md, not CI',
      ).toBe(INSTALL_DOC);
    }
  });
});
