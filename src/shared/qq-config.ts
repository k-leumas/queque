import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

/** Built-in sensitive path patterns — always applied; user config adds more. */
export const DEFAULT_SENSITIVE_PATH_PATTERNS = [
  '\\.env',
  'credentials',
  '\\.pem$',
  'id_rsa',
  '\\.ssh/',
  '\\.aws/',
  'secret',
] as const;

/** Keys redacted from debug logs unless QQ_DEBUG_VERBOSE=1. */
export const DEFAULT_REDACT_LOG_KEYS = ['lbuffer', 'rbuffer', 'queryText', 'request'] as const;

/** Destructive command patterns for warn-only UI badges. */
export const DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS = [
  '\\brm\\s+-r(f)?\\b',
  '\\bsudo\\b',
  '\\bchmod\\s+-R\\b',
  '>\\s*/dev/',
  '\\bcurl\\b[^\\n|]*\\|\\s*sh\\b',
] as const;

const privacyConfigSchema = z
  .object({
    sensitivePathPatterns: z.array(z.string()).optional(),
    redactLogKeys: z.array(z.string()).optional(),
    allowFileRead: z.boolean().optional(),
    useGitignore: z
      .boolean()
      .optional()
      .describe(
        'Not yet implemented — this config option will enable gitignore-based filtering in the future. Placeholder only.',
      ),
  })
  .optional();

const safetyConfigSchema = z
  .object({
    destructiveCommandPatterns: z.array(z.string()).optional(),
  })
  .optional();

export const qqConfigFileSchema = z.object({
  privacy: privacyConfigSchema,
  safety: safetyConfigSchema,
});

export type QqConfigFile = z.infer<typeof qqConfigFileSchema>;

export interface ResolvedQqConfig {
  sensitivePathRegexes: RegExp[];
  redactLogKeys: Set<string>;
  allowFileRead: boolean;
  destructiveCommandRegexes: RegExp[];
}

let cachedConfig: ResolvedQqConfig | null = null;

/**
 * Returns the default config file path: ~/.config/qq/config.json.
 * Override with QQ_CONFIG_FILE for tests or custom installs.
 */
export function defaultConfigPath(): string {
  return process.env.QQ_CONFIG_FILE ?? join(homedir(), '.config', 'qq', 'config.json');
}

/** Maximum length for user-supplied regex patterns in config.json. */
export const MAX_PATTERN_LENGTH = 256;

/**
 * Compiles string patterns to RegExp instances; skips invalid or oversized patterns.
 */
export function compilePatterns(patterns: readonly string[]): RegExp[] {
  const compiled: RegExp[] = [];

  for (const source of patterns) {
    if (source.length > MAX_PATTERN_LENGTH) {
      continue;
    }

    try {
      compiled.push(new RegExp(source, 'i'));
    } catch {
      // Invalid user patterns are ignored — built-in defaults still apply.
    }
  }

  return compiled;
}

function envFlagEnabled(name: string): boolean {
  const value = process.env[name];
  return value === '1' || value === 'true';
}

function readConfigFile(): QqConfigFile {
  const configPath = defaultConfigPath();

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {};
    }
    // fs unavailable (e.g. mocked in tests) — fall back quietly.
    return {};
  }

  try {
    return qqConfigFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`queque: ignoring invalid config at ${configPath}: ${message}`);
    return {};
  }
}

/**
 * Merges built-in defaults, ~/.config/qq/config.json, and env overrides.
 * Built-in sensitive patterns are never removed — user config only adds patterns.
 */
export function loadQqConfig(): ResolvedQqConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const file = readConfigFile();

  const sensitivePatterns = [
    ...DEFAULT_SENSITIVE_PATH_PATTERNS,
    ...(file.privacy?.sensitivePathPatterns ?? []),
  ];

  const redactKeys = [...DEFAULT_REDACT_LOG_KEYS, ...(file.privacy?.redactLogKeys ?? [])];

  const destructivePatterns = [
    ...DEFAULT_DESTRUCTIVE_COMMAND_PATTERNS,
    ...(file.safety?.destructiveCommandPatterns ?? []),
  ];

  const allowFileRead =
    envFlagEnabled('QQ_ALLOW_FILE_READ') || (file.privacy?.allowFileRead ?? false);

  cachedConfig = {
    sensitivePathRegexes: compilePatterns(sensitivePatterns),
    redactLogKeys: new Set(redactKeys),
    allowFileRead,
    destructiveCommandRegexes: compilePatterns(destructivePatterns),
  };

  return cachedConfig;
}

/**
 * @internal For test isolation only — do not call in production code.
 */
export function resetQqConfigCache(): void {
  cachedConfig = null;
}
