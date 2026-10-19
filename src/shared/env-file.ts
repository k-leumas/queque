import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function findUp(startDir: string, filename: string): string | null {
  let current = startDir;

  while (true) {
    const candidate = join(current, filename);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function parseEnvFile(content: string): Map<string, string> {
  const values = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

// Module-level cache: keyed by "key\0startDir" so different start directories
// are cached independently. Null means the key was not found. Undefined means
// the entry has not been populated yet (Map.get returns undefined for missing keys).
const envCache = new Map<string, string | null>();

/**
 * Returns a usable secret string, or undefined when the value is missing, empty,
 * or whitespace-only. Empty CI stubs such as `ANTHROPIC_API_KEY=""` must not
 * block fallback to `.env.local`.
 */
export function usableSecret(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * The env file to read for `startDir`: exactly `~/.env.local` when `startDir` is the home
 * directory (IN-16), else the nearest `.env.local` at or above `startDir`.
 *
 * Above `~` there is no legitimate key file, and with HOME under `/tmp` (CI, sandboxes) the
 * walk would reach a world-writable `/tmp/.env.local` that another user could fill with
 * their own ANTHROPIC_API_KEY, OPENAI_API_KEY or QQ_MODEL and so receive the user's query.
 */
function envFileFor(startDir: string): string | null {
  if (resolve(startDir) === resolve(homedir())) {
    const homeFile = join(homedir(), '.env.local');
    return existsSync(homeFile) ? homeFile : null;
  }
  return findUp(startDir, '.env.local');
}

/**
 * The value of `key` in `~/.env.local` (the default), or for an explicit other `startDir`
 * in the nearest `.env.local` at or above it; null when there is none.
 *
 * `startDir` defaults to the home directory (WR-10), the same file the daemon reads
 * (WR-08), so the client's in-process fallback and the daemon never disagree and a
 * project's own `.env.local` in the shell's cwd is never used for keys or settings. It is
 * never the module's own path: in a Homebrew install that is the Cellar bundle. From the
 * home directory the lookup never climbs above it (IN-16, see envFileFor).
 */
export function readEnvValueFromDotEnvLocal(key: string, startDir = homedir()): string | null {
  const cacheKey = `${key}\0${startDir}`;
  if (envCache.has(cacheKey)) {
    return envCache.get(cacheKey) ?? null;
  }

  const envPath = envFileFor(startDir);
  if (!envPath) {
    envCache.set(cacheKey, null);
    return null;
  }

  const values = parseEnvFile(readFileSync(envPath, 'utf8'));
  const result = values.get(key) ?? null;
  envCache.set(cacheKey, result);
  return result;
}
