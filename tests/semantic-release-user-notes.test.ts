import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHighlightPrompt,
  formatCommitLine,
  formatReleaseNotes,
  formatSection,
  generateNotes,
  groupCommits,
  isoDate,
  normalizeRepositoryUrl,
  parseConventionalCommit,
  parseHighlights,
  prepare,
  stripUnreleasedSection,
} from '../scripts/semantic-release-user-notes.js';

const repo = 'https://github.com/k-leumas/queque';

describe('parseConventionalCommit', () => {
  it('reads type, scope, and subject', () => {
    expect(parseConventionalCommit('feat(ui): add filter')).toEqual({
      type: 'feat',
      scope: 'ui',
      subject: 'add filter',
      breaking: false,
      header: 'feat(ui): add filter',
    });
  });

  it('treats a bang and a BREAKING CHANGE footer as breaking', () => {
    expect(parseConventionalCommit('feat!: new shell contract').breaking).toBe(true);
    expect(parseConventionalCommit('fix: path\n\nBREAKING CHANGE: offsets are gone').breaking).toBe(
      true,
    );
  });
});

describe('groupCommits', () => {
  it('puts feat and perf in Features, fix in Bug Fixes, and breaking in Deprecations', () => {
    const grouped = groupCommits([
      { message: 'feat(09): flag missing tools', hash: 'aaaaaaaa' },
      { message: 'perf: bundle the client', hash: 'bbbbbbbb' },
      { message: 'fix(zellij): keep the header visible', hash: 'cccccccc' },
      {
        message: 'feat!: drop numeric offsets\n\nBREAKING CHANGE: use split buffers',
        hash: 'dddddddd',
      },
      { message: 'docs: ignore me', hash: 'eeeeeeee' },
      { message: 'Merge branch "foo"', hash: 'ffffffff' },
    ]);
    expect(grouped.features.map((entry) => entry.subject)).toEqual([
      'flag missing tools',
      'bundle the client',
      'drop numeric offsets',
    ]);
    expect(grouped.bugFixes.map((entry) => entry.subject)).toEqual(['keep the header visible']);
    expect(grouped.deprecations.map((entry) => entry.subject)).toEqual(['drop numeric offsets']);
    expect(grouped.features[0]?.hash).toBe('aaaaaaa');
  });
});

describe('formatSection', () => {
  it('omits an empty section', () => {
    expect(formatSection('Features', [], [], repo)).toBe('');
  });

  it('hides the commit list under details after the highlights', () => {
    const markdown = formatSection(
      'Features',
      ['Suggestions prefer tools you already have.'],
      [
        {
          scope: '09',
          subject: 'flag missing tools',
          hash: 'aaaaaaaa'.slice(0, 7),
          fullHash: 'aaaaaaaa',
        },
      ],
      repo,
    );
    expect(markdown).toContain('### Features');
    expect(markdown).toContain('- Suggestions prefer tools you already have.');
    expect(markdown).toContain('<summary>Detailed changes</summary>');
    expect(markdown).toContain(
      '* **09:** flag missing tools ([aaaaaaa](https://github.com/k-leumas/queque/commit/aaaaaaaa))',
    );
    expect(markdown).toContain('</details>');
  });
});

describe('formatReleaseNotes', () => {
  it('uses a patch heading and omits an empty Deprecations section', () => {
    const notes = formatReleaseNotes({
      version: '0.5.2',
      releaseType: 'patch',
      compareUrl: `${repo}/compare/v0.5.1...v0.5.2`,
      date: '2026-10-12',
      highlights: {
        features: [],
        bugFixes: ['The filter opens empty.'],
        deprecations: [],
      },
      groups: {
        features: [],
        bugFixes: [
          {
            scope: '09.1-09',
            subject: 'open the filter empty',
            hash: '6888d4d',
            fullHash: '6888d4dffffffffffffffff',
          },
        ],
        deprecations: [],
      },
      repositoryUrl: repo,
    });
    expect(notes.startsWith('## [0.5.2]')).toBe(true);
    expect(notes).not.toContain('### Features');
    expect(notes).not.toContain('### Deprecations');
    expect(notes).toContain('### Bug Fixes');
    expect(notes).toContain('- The filter opens empty.');
  });

  it('uses a single-hash heading for a minor release', () => {
    const notes = formatReleaseNotes({
      version: '0.6.0',
      releaseType: 'minor',
      compareUrl: undefined,
      date: '2026-10-12',
      highlights: { features: ['Rows appear as they arrive.'], bugFixes: [], deprecations: [] },
      groups: { features: [], bugFixes: [], deprecations: [] },
      repositoryUrl: repo,
    });
    expect(notes.startsWith('# 0.6.0 (2026-10-12)')).toBe(true);
  });
});

describe('parseHighlights', () => {
  it('reads JSON even when the model wraps it in prose', () => {
    expect(
      parseHighlights(
        'Here you go:\n{"features":["Faster ??."],"bugFixes":[],"deprecations":[]}\n',
      ),
    ).toEqual({
      features: ['Faster ??.'],
      bugFixes: [],
      deprecations: [],
    });
  });

  it('rejects a payload that is not the highlight object', () => {
    expect(() => parseHighlights('{"nope":true}')).toThrow();
  });
});

describe('stripUnreleasedSection', () => {
  it('removes Unreleased and leaves the next version heading', () => {
    const stripped = stripUnreleasedSection(
      '# Changelog\n\n## [Unreleased]\n\n### Features\n\n- New.\n\n# [0.5.0](url) (2026-10-12)\n\n- Old.\n',
    );
    expect(stripped).toContain('# Changelog');
    expect(stripped).not.toContain('## [Unreleased]');
    expect(stripped).not.toContain('- New.');
    expect(stripped).toContain('# [0.5.0]');
  });
});

describe('helpers', () => {
  it('normalizes git+ repository URLs', () => {
    expect(normalizeRepositoryUrl('git+https://github.com/k-leumas/queque.git')).toBe(repo);
  });

  it('formats a UTC ISO date', () => {
    expect(isoDate(new Date('2026-10-12T20:54:02.803Z'))).toBe('2026-10-12');
  });

  it('formats a commit line without a hash', () => {
    expect(
      formatCommitLine({ scope: null, subject: 'add init', hash: '', fullHash: '' }, repo),
    ).toBe('* add init');
  });

  it('names the previous version in the highlight prompt', () => {
    const prompt = buildHighlightPrompt({
      version: '0.6.0',
      lastVersion: '0.5.0',
      commitLines: '- feat: stream rows',
      diffstat: 'src/ui/CandidateSelect.tsx | 10 +',
    });
    expect(prompt).toContain('Release: 0.5.0 -> 0.6.0');
    expect(prompt).toContain('- feat: stream rows');
  });
});

describe('generateNotes', () => {
  const baseContext = {
    cwd: '/tmp',
    commits: [
      { message: 'feat(09.1): stream rows as they arrive', hash: '1111111aaaa' },
      { message: 'fix(09.1-09): open the filter empty', hash: '2222222bbbb' },
    ],
    lastRelease: { version: '0.5.0', gitTag: 'v0.5.0', gitHead: 'abc' },
    nextRelease: { version: '0.6.0', type: 'minor', gitTag: 'v0.6.0' },
    options: { repositoryUrl: `${repo}.git` },
    logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('omits highlights when ANTHROPIC_API_KEY is missing and still lists commits', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const notes = await generateNotes({}, baseContext);
    expect(notes).toContain(
      '# [0.6.0](https://github.com/k-leumas/queque/compare/v0.5.0...v0.6.0)',
    );
    expect(notes).toContain('<summary>Detailed changes</summary>');
    expect(notes).toContain('stream rows as they arrive');
    expect(notes).not.toContain('- ');
    expect(baseContext.logger.warn).toHaveBeenCalled();
  });

  it('inserts LLM highlights above the commit details', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const complete = vi.fn(async () =>
      JSON.stringify({
        features: ['Suggestions appear as they arrive.'],
        bugFixes: ['The filter opens empty.'],
        deprecations: [],
      }),
    );
    const execFile = vi.fn(async () => ({ stdout: 'src/ui/CandidateSelect.tsx | 10 +\n' }));
    const notes = await generateNotes({ complete, execFile }, baseContext);
    expect(complete).toHaveBeenCalledOnce();
    expect(notes).toContain('- Suggestions appear as they arrive.');
    expect(notes).toContain('- The filter opens empty.');
    expect(notes).toContain('### Features');
    expect(notes).toContain('### Bug Fixes');
  });

  it('falls back to details-only notes when the model output is invalid', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    const notes = await generateNotes(
      { complete: async () => 'not json', execFile: async () => ({ stdout: '' }) },
      baseContext,
    );
    expect(notes).toContain('<summary>Detailed changes</summary>');
    expect(notes).not.toMatch(/^- /m);
    expect(baseContext.logger.error).toHaveBeenCalled();
  });
});

describe('prepare', () => {
  it('strips Unreleased from the changelog file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qq-changelog-'));
    const file = join(dir, 'CHANGELOG.md');
    writeFileSync(
      file,
      '# Changelog\n\n## [Unreleased]\n\n- New.\n\n# [0.5.0](url) (2026-10-12)\n',
    );
    await prepare({}, { cwd: dir, logger: { log: vi.fn() } });
    const written = readFileSync(file, 'utf8');
    expect(written).not.toContain('## [Unreleased]');
    expect(written).toContain('# [0.5.0]');
    rmSync(dir, { recursive: true, force: true });
  });
});
