/**
 * semantic-release plugin that writes user-facing changelog notes.
 *
 * Highlights (Features / Bug Fixes / Deprecations) come from an LLM summary of
 * the changeset since the last release. The conventional-commit list for each
 * section is kept under a details control so the published notes stay scannable.
 */

import { execFile as execFileCallback } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

/** Parsed conventional-commit header used to group changelog sections. */
export type ParsedCommit = {
  type: string | null;
  scope: string | null;
  subject: string;
  breaking: boolean;
  header: string;
};

/** One grouped changelog commit, including the abbreviated hash. */
export type ChangelogCommit = ParsedCommit & {
  fullHash: string;
  hash: string;
};

/** LLM-written user-facing bullets for one release. */
export type ChangelogHighlights = {
  features: string[];
  bugFixes: string[];
  deprecations: string[];
};

/** Grouped conventional commits for Features, Bug Fixes, and Deprecations. */
export type ChangelogGroups = {
  features: ChangelogCommit[];
  bugFixes: ChangelogCommit[];
  deprecations: ChangelogCommit[];
};

/** Minimal git commit shape from semantic-release context. */
export type GitCommit = {
  message: string;
  hash?: string;
};

/** Commit fields needed to render a changelog bullet. */
export type ChangelogCommitLine = Pick<ChangelogCommit, 'scope' | 'subject' | 'hash' | 'fullHash'>;

/** Arguments for formatReleaseNotes. */
export type ReleaseNotesParams = {
  version: string;
  releaseType: string;
  compareUrl: string | undefined;
  date: string;
  highlights: ChangelogHighlights;
  groups: {
    features: ChangelogCommitLine[];
    bugFixes: ChangelogCommitLine[];
    deprecations: ChangelogCommitLine[];
  };
  repositoryUrl: string;
};

/** Injected LLM completion used by generateNotes. */
export type CompleteFn = (
  prompt: string,
  options: { model: string; apiKey: string; logger?: PluginLogger },
) => Promise<string>;

/** Injected git exec used to collect a diffstat. */
export type ExecFileFn = (
  file: string,
  args: string[],
  options: { cwd?: string; maxBuffer?: number },
) => Promise<{ stdout: string }>;

/** Plugin config accepted by generateNotes and prepare. */
export type PluginConfig = {
  complete?: CompleteFn;
  execFile?: ExecFileFn;
  model?: string;
  changelogFile?: string;
};

/** Logger subset used by generateNotes and prepare. */
export type PluginLogger = {
  warn?: (message: string) => void;
  error?: (message: string) => void;
  log?: (message: string) => void;
};

/** semantic-release generateNotes context subset this plugin reads. */
export type GenerateNotesContext = {
  cwd: string;
  commits?: GitCommit[];
  lastRelease?: { version?: string; gitTag?: string; gitHead?: string };
  nextRelease: { version: string; type: string; gitTag?: string };
  options?: { repositoryUrl?: string };
  logger?: PluginLogger;
};

/** semantic-release prepare context subset this plugin reads. */
export type PrepareContext = {
  cwd: string;
  logger?: PluginLogger;
};

const execFile = promisify(execFileCallback) as unknown as ExecFileFn;

/** Default Claude model used when CHANGELOG_MODEL is unset. */
export const DEFAULT_CHANGELOG_MODEL = 'claude-sonnet-5';

/** Commit types that appear in the user-facing Features section. */
export const FEATURE_TYPES = new Set(['feat', 'perf']);

/** Commit types that appear in the user-facing Bug Fixes section. */
export const FIX_TYPES = new Set(['fix', 'revert']);

/** Zod schema for the LLM highlight payload. */
export const changelogHighlightsSchema = z.object({
  features: z.array(z.string()),
  bugFixes: z.array(z.string()),
  deprecations: z.array(z.string()),
});

/** Parses a conventional-commit message into type, scope, subject, and breaking. */
export function parseConventionalCommit(message: string): ParsedCommit {
  const normalized = message.replace(/\r\n/g, '\n').trim();
  const [header = '', ...rest] = normalized.split('\n');
  const match = /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?:\s*(?<subject>.*)$/.exec(header);
  const body = rest.join('\n');
  const breaking = Boolean(match?.groups?.bang) || /^BREAKING[ -]CHANGE:/m.test(body);
  return {
    type: match?.groups?.type ?? null,
    scope: match?.groups?.scope ?? null,
    subject: (match?.groups?.subject ?? header).trim(),
    breaking,
    header,
  };
}

/** Groups semantic-release commits into changelog sections. */
export function groupCommits(commits: GitCommit[]): ChangelogGroups {
  const features: ChangelogCommit[] = [];
  const bugFixes: ChangelogCommit[] = [];
  const deprecations: ChangelogCommit[] = [];
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message ?? '');
    if (parsed.header.startsWith('Merge ')) {
      continue;
    }
    const fullHash = commit.hash ?? '';
    const entry = {
      ...parsed,
      fullHash,
      hash: fullHash.slice(0, 7),
    };
    if (parsed.breaking) {
      deprecations.push(entry);
    }
    if (parsed.type && FEATURE_TYPES.has(parsed.type)) {
      features.push(entry);
    } else if (parsed.type && FIX_TYPES.has(parsed.type)) {
      bugFixes.push(entry);
    }
  }
  return { features, bugFixes, deprecations };
}

/** Formats one conventional commit as a changelog bullet with an optional hash link. */
export function formatCommitLine(entry: ChangelogCommitLine, repositoryUrl: string): string {
  const scope = entry.scope ? `**${entry.scope}:** ` : '';
  const hash = entry.fullHash
    ? repositoryUrl
      ? `([${entry.hash}](${repositoryUrl}/commit/${entry.fullHash}))`
      : `(${entry.hash})`
    : '';
  return `* ${scope}${entry.subject}${hash ? ` ${hash}` : ''}`.trimEnd();
}

/** Renders one changelog section with highlight bullets and a collapsed commit list. */
export function formatSection(
  title: string,
  highlights: string[],
  commits: ChangelogCommitLine[],
  repositoryUrl: string,
): string {
  if (highlights.length === 0 && commits.length === 0) {
    return '';
  }
  const lines = [`### ${title}`, ''];
  for (const highlight of highlights) {
    const text = highlight.replace(/^\s*[-*]\s*/, '').trim();
    if (text) {
      lines.push(`- ${text}`);
    }
  }
  if (highlights.length > 0 && commits.length > 0) {
    lines.push('');
  }
  if (commits.length > 0) {
    lines.push('<details>', '<summary>Detailed changes</summary>', '');
    for (const entry of commits) {
      lines.push(formatCommitLine(entry, repositoryUrl));
    }
    lines.push('', '</details>', '');
  } else {
    lines.push('');
  }
  return lines.join('\n');
}

/** Builds the full markdown for one semantic-release notes blob. */
export function formatReleaseNotes(params: ReleaseNotesParams): string {
  const headingLevel = params.releaseType === 'patch' ? '##' : '#';
  const title = params.compareUrl
    ? `${headingLevel} [${params.version}](${params.compareUrl}) (${params.date})`
    : `${headingLevel} ${params.version} (${params.date})`;
  const sections = [
    formatSection(
      'Features',
      params.highlights.features,
      params.groups.features,
      params.repositoryUrl,
    ),
    formatSection(
      'Bug Fixes',
      params.highlights.bugFixes,
      params.groups.bugFixes,
      params.repositoryUrl,
    ),
    formatSection(
      'Deprecations',
      params.highlights.deprecations,
      params.groups.deprecations,
      params.repositoryUrl,
    ),
  ].filter(Boolean);
  const body = `${title}\n\n${sections.join('\n')}`.trimEnd();
  return `${body}\n`;
}

/** Extracts the first JSON object from model output. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object in model output');
  }
  return JSON.parse(text.slice(start, end + 1));
}

/** Parses and validates LLM changelog highlights. */
export function parseHighlights(text: string): ChangelogHighlights {
  return changelogHighlightsSchema.parse(extractJsonObject(text));
}

/** Builds the prompt used to summarize a release changeset. */
export function buildHighlightPrompt(params: {
  version: string;
  lastVersion: string | undefined;
  commitLines: string;
  diffstat: string;
}): string {
  return `You write user-facing changelog highlights for QueQue, a zsh-integrated command-line assistant. Users type ?? on the shell command line and pick a suggested command; QueQue never runs it for them.

Write JSON only, with no markdown fences, matching:
{"features":["..."],"bugFixes":["..."],"deprecations":["..."]}

Each array item is one or two complete sentences a casual user can scan. Describe the outcome: how the product got better and what that means in the terminal. Do not mention ticket IDs, plan numbers, commit hashes, file names, IPC, zod, AbortController, or other internals. Merge related commits. Omit a section by using an empty array. Put a deprecation only for removed or breaking user-facing behavior.

Release: ${params.lastVersion ?? 'none'} -> ${params.version}

Commits:
${params.commitLines}

Diffstat:
${params.diffstat || '(unavailable)'}
`;
}

/**
 * Removes a leading Keep-a-Changelog Unreleased block so the next tagged notes
 * are not duplicated when semantic-release prepends a version section.
 */
export function stripUnreleasedSection(markdown: string): string {
  return markdown
    .replace(/^## \[Unreleased\][ \t]*\n[\s\S]*?(?=^#{1,2} \[)/m, '')
    .replace(/\n{3,}/g, '\n\n');
}

/** Strips git+ and .git from a repository URL. */
export function normalizeRepositoryUrl(url: string): string {
  return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

/** Formats a Date as YYYY-MM-DD. */
export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

async function defaultComplete(
  prompt: string,
  options: { model: string; apiKey: string },
): Promise<string> {
  const { default: AnthropicSdk } = await import('@anthropic-ai/sdk');
  const client = new AnthropicSdk({ apiKey: options.apiKey });
  const message = await client.messages.create({
    model: options.model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content.find((part) => part.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('Changelog model returned no text');
  }
  return block.text;
}

async function collectDiffstat(
  cwd: string,
  from: string | undefined,
  execFileImpl: ExecFileFn,
): Promise<string> {
  if (!from) {
    return '';
  }
  try {
    const { stdout } = await execFileImpl('git', ['diff', '--stat', `${from}..HEAD`], {
      cwd,
      maxBuffer: 2_000_000,
    });
    return String(stdout).trim();
  } catch {
    return '';
  }
}

function emptyHighlights(): ChangelogHighlights {
  return { features: [], bugFixes: [], deprecations: [] };
}

/** semantic-release generateNotes hook. */
export async function generateNotes(
  pluginConfig: PluginConfig,
  context: GenerateNotesContext,
): Promise<string> {
  const complete = pluginConfig.complete ?? defaultComplete;
  const execFileImpl = pluginConfig.execFile ?? execFile;
  const model = pluginConfig.model ?? process.env.CHANGELOG_MODEL ?? DEFAULT_CHANGELOG_MODEL;
  const { commits = [], lastRelease, nextRelease, logger, cwd } = context;
  const groups = groupCommits(commits);
  const repositoryUrl = normalizeRepositoryUrl(context.options?.repositoryUrl ?? '');
  const compareUrl =
    lastRelease?.gitTag && nextRelease?.gitTag && repositoryUrl
      ? `${repositoryUrl}/compare/${lastRelease.gitTag}...${nextRelease.gitTag}`
      : undefined;

  let highlights = emptyHighlights();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const noteworthy = [...groups.features, ...groups.bugFixes, ...groups.deprecations];
  if (apiKey && noteworthy.length > 0) {
    try {
      const diffstat = await collectDiffstat(
        cwd,
        lastRelease?.gitTag ?? lastRelease?.gitHead,
        execFileImpl,
      );
      const commitLines = noteworthy
        .map((entry) => `- ${entry.type}${entry.scope ? `(${entry.scope})` : ''}: ${entry.subject}`)
        .join('\n');
      const prompt = buildHighlightPrompt({
        version: nextRelease.version,
        lastVersion: lastRelease?.version,
        commitLines,
        diffstat,
      });
      highlights = parseHighlights(await complete(prompt, { model, apiKey, logger }));
    } catch (error) {
      logger?.error?.(
        `changelog highlights failed: ${error instanceof Error ? error.message : error}`,
      );
      highlights = emptyHighlights();
    }
  } else if (!apiKey) {
    logger?.warn?.('ANTHROPIC_API_KEY missing; changelog highlights omitted');
  }

  return formatReleaseNotes({
    version: nextRelease.version,
    releaseType: nextRelease.type,
    compareUrl,
    date: isoDate(),
    highlights,
    groups,
    repositoryUrl,
  });
}

/** semantic-release prepare hook: drop Unreleased before the changelog plugin prepends. */
export async function prepare(pluginConfig: PluginConfig, context: PrepareContext): Promise<void> {
  const changelogFile = pluginConfig.changelogFile ?? 'CHANGELOG.md';
  const path = join(context.cwd, changelogFile);
  try {
    const current = await readFile(path, 'utf8');
    const stripped = stripUnreleasedSection(current);
    if (stripped !== current) {
      await writeFile(path, stripped);
      context.logger?.log?.('Removed Unreleased section from CHANGELOG.md');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}
