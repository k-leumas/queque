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

const execFile = promisify(execFileCallback);

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

/**
 * Parses a conventional-commit message into type, scope, subject, and breaking.
 *
 * @param {string} message
 * @returns {{ type: string | null, scope: string | null, subject: string, breaking: boolean, header: string }}
 */
export function parseConventionalCommit(message) {
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

/**
 * Groups semantic-release commits into changelog sections.
 *
 * @param {Array<{ message: string, hash?: string }>} commits
 * @returns {{ features: object[], bugFixes: object[], deprecations: object[] }}
 */
export function groupCommits(commits) {
  const features = [];
  const bugFixes = [];
  const deprecations = [];
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

/**
 * Formats one conventional commit as a changelog bullet with an optional hash link.
 *
 * @param {{ scope: string | null, subject: string, hash: string, fullHash: string }} entry
 * @param {string} repositoryUrl
 * @returns {string}
 */
export function formatCommitLine(entry, repositoryUrl) {
  const scope = entry.scope ? `**${entry.scope}:** ` : '';
  const hash = entry.fullHash
    ? repositoryUrl
      ? `([${entry.hash}](${repositoryUrl}/commit/${entry.fullHash}))`
      : `(${entry.hash})`
    : '';
  return `* ${scope}${entry.subject}${hash ? ` ${hash}` : ''}`.trimEnd();
}

/**
 * Renders one changelog section with highlight bullets and a collapsed commit list.
 *
 * @param {string} title
 * @param {string[]} highlights
 * @param {object[]} commits
 * @param {string} repositoryUrl
 * @returns {string}
 */
export function formatSection(title, highlights, commits, repositoryUrl) {
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

/**
 * Builds the full markdown for one semantic-release notes blob.
 *
 * @param {object} params
 * @param {string} params.version
 * @param {string} params.releaseType
 * @param {string | undefined} params.compareUrl
 * @param {string} params.date
 * @param {{ features: string[], bugFixes: string[], deprecations: string[] }} params.highlights
 * @param {{ features: object[], bugFixes: object[], deprecations: object[] }} params.groups
 * @param {string} params.repositoryUrl
 * @returns {string}
 */
export function formatReleaseNotes(params) {
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

/**
 * Extracts the first JSON object from model output.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object in model output');
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Parses and validates LLM changelog highlights.
 *
 * @param {string} text
 * @returns {{ features: string[], bugFixes: string[], deprecations: string[] }}
 */
export function parseHighlights(text) {
  return changelogHighlightsSchema.parse(extractJsonObject(text));
}

/**
 * Builds the prompt used to summarize a release changeset.
 *
 * @param {object} params
 * @param {string} params.version
 * @param {string | undefined} params.lastVersion
 * @param {string} params.commitLines
 * @param {string} params.diffstat
 * @returns {string}
 */
export function buildHighlightPrompt(params) {
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
 *
 * @param {string} markdown
 * @returns {string}
 */
export function stripUnreleasedSection(markdown) {
  return markdown
    .replace(/^## \[Unreleased\][ \t]*\n[\s\S]*?(?=^#{1,2} \[)/m, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {string} url
 * @returns {string}
 */
export function normalizeRepositoryUrl(url) {
  return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string} prompt
 * @param {{ model: string, apiKey: string }} options
 * @returns {Promise<string>}
 */
async function defaultComplete(prompt, options) {
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

/**
 * @param {string} cwd
 * @param {string | undefined} from
 * @param {(file: string, args: string[], options: object) => Promise<{ stdout: string }>} execFileImpl
 * @returns {Promise<string>}
 */
async function collectDiffstat(cwd, from, execFileImpl) {
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

function emptyHighlights() {
  return { features: [], bugFixes: [], deprecations: [] };
}

/**
 * semantic-release generateNotes hook.
 *
 * @param {object} pluginConfig
 * @param {object} context
 * @returns {Promise<string>}
 */
export async function generateNotes(pluginConfig, context) {
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

/**
 * semantic-release prepare hook: drop Unreleased before the changelog plugin prepends.
 *
 * @param {object} pluginConfig
 * @param {object} context
 * @returns {Promise<void>}
 */
export async function prepare(pluginConfig, context) {
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
