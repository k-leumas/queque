import {
  type IntentDecision,
  type NormalizedRequest,
  requestIntentSchema,
} from '../contracts/request.js';

/**
 * D-03: git prefix — query (after trim) begins with 'git ' (literal).
 *
 * Scope notes (Phase 2):
 * - Leading whitespace: the ZLE widget strips leading whitespace from the buffer
 *   before the '??' trigger is sent, so `query.trim()` handles any remaining edge.
 * - 'command git status' patterns: out of Phase 2 scope. These are forwarded as
 *   shell-command via SHELL_COMMAND_RE below, without the git-prefix signal.
 *   The git-prefix signal is used by the git context provider (D-09) to include
 *   git context for `git *` subcommand queries.
 */
const GIT_PREFIX_RE = /^git\s/;

/**
 * D-02: package manager script prefixes that always qualify as codebase intent.
 * Matches only at the start of the query to distinguish literal invocations
 * ("pnpm build") from natural language ("how to run pnpm build").
 */
const PKG_MANAGER_RE =
  /^(npm|pnpm|yarn)\s+(test|build|lint|run|start|dev|check|format|typecheck)\b/i;

/**
 * Filesystem operation keywords routed before generic file-path detection.
 * This keeps prompts like "rename hero.png to hero-banner.png" in filesystem
 * even though the query also contains file-looking tokens.
 */
const FILESYSTEM_KEYWORDS_RE =
  /\b(?:rename|move(?:\s+file)?|find\s+files?|copy|delete|list\s+files?|image|folder|directory)\b/i;

/**
 * Shell command signals: well-known command prefixes and pipe operator.
 * Checked BEFORE file-path signal so "ls ./foo.txt" routes as shell-command, not codebase.
 */
const SHELL_COMMAND_RE =
  /^(ls|echo|grep|awk|sed|curl|wget|ssh|cat|head|tail|cd|pwd|mkdir|touch|chmod|cp|mv|rm|which|man|ps|kill|sudo|command)\s|\|/;

/**
 * D-01: file path signal detection.
 * Matches: path separators (/), relative paths (./), tilde paths (~/),
 * dotfiles (.env, .zshrc), and bare extensions (utils.py, index.html).
 */
const FILE_PATH_RE =
  /(?:\/|\.\/|~\/|\.[a-zA-Z][\w-]*(?:\.\w+)?(?=\s|$)|\b[\w-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|java|sh|md|json|yaml|yml|toml|env|html|css|scss|txt|xml|svg|png|jpg|jpeg|gif|pdf|zip|tar|gz|lock|config)(?:\b|$))/;

export function classifyIntent(request: NormalizedRequest): IntentDecision {
  const query = request.lbuffer.trim();

  // Empty query (including whitespace-only) → unknown (the ONLY path to this value)
  if (query.length === 0) {
    return {
      intent: requestIntentSchema.enum.unknown,
      confidence: 1,
      signals: ['empty-query'],
    };
  }

  if (GIT_PREFIX_RE.test(query)) {
    return {
      intent: requestIntentSchema.enum['shell-command'],
      confidence: 1,
      signals: ['git-prefix'],
    };
  }

  if (PKG_MANAGER_RE.test(query)) {
    return {
      intent: requestIntentSchema.enum.codebase,
      confidence: 1,
      signals: ['pkg-manager-script'],
    };
  }

  if (FILESYSTEM_KEYWORDS_RE.test(query)) {
    return {
      intent: requestIntentSchema.enum.filesystem,
      confidence: 0.85,
      signals: ['filesystem-keyword'],
    };
  }

  if (SHELL_COMMAND_RE.test(query)) {
    return {
      intent: requestIntentSchema.enum['shell-command'],
      confidence: 0.8,
      signals: ['shell-command-signal'],
    };
  }

  if (FILE_PATH_RE.test(query)) {
    return {
      intent: requestIntentSchema.enum.codebase,
      confidence: 0.9,
      signals: ['file-path-signal'],
    };
  }

  return {
    intent: requestIntentSchema.enum.general,
    confidence: 0.5,
    signals: ['no-strong-signal'],
  };
}
