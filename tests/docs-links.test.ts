import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const DOCS = resolve(ROOT, 'docs');
const README = resolve(ROOT, 'README.md');
const REPO_BLOB = 'https://github.com/k-leumas/queque/blob/main/';

// Every peripheral doc the README must link (through REPO_BLOB) in its More list.
const REQUIRED_DOCS: readonly string[] = [
  'INSTALL.md',
  'PROVIDERS.md',
  'USAGE.md',
  'PRIVACY.md',
  'CONFIGURATION.md',
];

type Line = { line: number; text: string };
type Link = { file: string; line: number; target: string };

function scannedFiles(): string[] {
  const docs = readdirSync(DOCS)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => resolve(DOCS, name));
  return [README, resolve(ROOT, 'CONTRIBUTING.md'), ...docs];
}

function rel(file: string): string {
  return relative(ROOT, file);
}

// Lines outside fenced code blocks (``` or ~~~), with 1-based line numbers.
function proseLines(markdown: string): Line[] {
  const out: Line[] = [];
  let fence: { char: string; len: number } | null = null;
  markdown.split('\n').forEach((text, i) => {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
    if (m) {
      const marker = m[1] ?? '';
      const char = marker[0] ?? '';
      if (fence === null) {
        fence = { char, len: marker.length };
        return;
      }
      if (char === fence.char && marker.length >= fence.len && (m[2] ?? '').trim() === '') {
        fence = null;
        return;
      }
    }
    if (fence === null) out.push({ line: i + 1, text });
  });
  return out;
}

function stripCodeSpans(text: string): string {
  return text.replace(/(`+)[\s\S]*?\1(?!`)/g, '');
}

const LINK_RE = /!?\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

// Every link and image target on a line, including images nested in link text (badges).
function lineTargets(text: string): string[] {
  const targets: string[] = [];
  for (const m of text.matchAll(LINK_RE)) {
    targets.push(...lineTargets(m[1] ?? ''));
    targets.push(m[2] ?? '');
  }
  return targets;
}

function extractLinks(file: string): Link[] {
  const links: Link[] = [];
  for (const { line, text } of proseLines(readFileSync(file, 'utf8'))) {
    for (const target of lineTargets(stripCodeSpans(text))) {
      links.push({ file, line, target });
    }
  }
  return links;
}

// GitHub heading anchor slug, before the -1, -2 suffix for repeated headings.
function slugify(heading: string): string {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

function headingSlugs(file: string): Set<string> {
  const slugs = new Set<string>();
  const seen = new Map<string, number>();
  for (const { text } of proseLines(readFileSync(file, 'utf8'))) {
    const m = /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(text);
    if (!m) continue;
    const base = slugify(m[1] ?? '');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    slugs.add(count === 0 ? base : `${base}-${count}`);
  }
  return slugs;
}

function splitAnchor(target: string): { path: string; anchor: string } {
  const hash = target.indexOf('#');
  if (hash === -1) return { path: target, anchor: '' };
  return { path: target.slice(0, hash), anchor: target.slice(hash + 1) };
}

// Checks one link; returns a failure message, or null when it resolves or is external.
function checkLink({ file, line, target }: Link): string | null {
  const where = `${rel(file)}:${line} links "${target}"`;
  let local: string;
  let anchor: string;
  if (target.startsWith(REPO_BLOB)) {
    const parts = splitAnchor(target.slice(REPO_BLOB.length));
    local = resolve(ROOT, decodeURIComponent(parts.path));
    anchor = parts.anchor;
  } else if (/^(https?:|mailto:)/i.test(target)) {
    return null;
  } else if (target.startsWith('#')) {
    local = file;
    anchor = target.slice(1);
  } else {
    const parts = splitAnchor(target);
    local = resolve(dirname(file), decodeURIComponent(parts.path));
    anchor = parts.anchor;
  }
  if (!existsSync(local)) {
    const base = rel(dirname(file)) || '.';
    return `${where}, but ${rel(local)} does not exist; fix the path (relative to ${base}/)`;
  }
  if (anchor !== '' && local.endsWith('.md') && !headingSlugs(local).has(anchor)) {
    return `${where}, but ${rel(local)} has no heading with anchor #${anchor}; link an existing heading`;
  }
  return null;
}

describe('docs links', () => {
  it('slugs headings the way GitHub does', () => {
    expect(slugify('Claude (default)')).toBe('claude-default');
    expect(slugify('OpenAI or Ollama (beta)')).toBe('openai-or-ollama-beta');
    expect(slugify('Phase 7 — Local learning')).toBe('phase-7--local-learning');
    expect(slugify('See [Usage](USAGE.md) `qq`')).toBe('see-usage-qq');
  });

  it('every relative link and anchor in README, CONTRIBUTING and docs/ resolves', () => {
    const failures = scannedFiles()
      .flatMap(extractLinks)
      .map(checkLink)
      .filter((msg): msg is string => msg !== null);
    expect(failures, 'broken markdown links').toEqual([]);
  });

  it('README links repo files only through absolute GitHub URLs', () => {
    const failures = extractLinks(README)
      .filter(
        ({ target }) =>
          !/^https?:/i.test(target) && !target.startsWith('#') && !target.startsWith('assets/'),
      )
      .map(
        ({ line, target }) =>
          `README.md:${line} links "${target}" relatively; README.md ships alone in the npm ` +
          `package, so link docs with ${REPO_BLOB}<path>`,
      );
    expect(failures, 'relative README links').toEqual([]);
  });

  it('README links every peripheral doc', () => {
    const targets = new Set(extractLinks(README).map(({ target }) => splitAnchor(target).path));
    const missing = REQUIRED_DOCS.filter((name) => !targets.has(`${REPO_BLOB}docs/${name}`)).map(
      (name) => `README.md has no link to ${REPO_BLOB}docs/${name}; add it to the More list`,
    );
    expect(missing, 'missing README doc links').toEqual([]);
  });
});
