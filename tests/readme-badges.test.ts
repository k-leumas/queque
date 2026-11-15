import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const README = resolve(ROOT, 'README.md');
const WORKFLOWS = resolve(ROOT, '.github', 'workflows');
const REPO = 'k-leumas/queque';
const CI_RUNS = `https://github.com/${REPO}/actions/workflows/ci.yml`;

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

const TESTED_ON = 'tested on ';

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

function readmeBadges(): Badge[] {
  return parseBadges(readFileSync(README, 'utf8'));
}

function distroBadges(): Badge[] {
  return readmeBadges().filter((b) => b.alt.startsWith(TESTED_ON));
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
    const refs = distroBadges().map((b) => b.alt.slice(TESTED_ON.length));
    expect(
      refs,
      'README distro badges must equal ci.yml images; update the tested-on badges in README.md',
    ).toEqual(images);
  });

  it('distro badges have the tested-on shape, distro logo and CI link', () => {
    const badges = distroBadges();
    expect(badges.length, 'README must have tested-on distro badges').toBeGreaterThan(0);
    for (const badge of badges) {
      const ref = badge.alt.slice(TESTED_ON.length);
      const [name = '', tag = ''] = ref.split(':');
      const url = new URL(badge.img);
      expect(url.protocol, `${ref} badge must use https`).toBe('https:');
      expect(url.host, `${ref} badge must be served by img.shields.io`).toBe('img.shields.io');
      expect(url.pathname.startsWith('/badge/'), `${ref} badge must be a static /badge/ URL`).toBe(
        true,
      );
      const segment = url.pathname.slice('/badge/'.length);
      const [label = '', message = ''] = segment.split('-').map((part) => decodeURIComponent(part));
      expect(label, `${ref} badge label must be "tested on"`).toBe('tested on');
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

  it('claims no macOS support unless a workflow runs on macOS', () => {
    const macRunner = runsOnValues().some((v) => /macos/i.test(v));
    const macBadges = readmeBadges().filter((b) => /macos/i.test(b.alt) || /macos/i.test(b.img));
    if (!macRunner) {
      expect(
        macBadges.map((b) => b.alt),
        'README must not show a macOS badge while no workflow runs-on a macOS runner',
      ).toEqual([]);
    }
  });
});
