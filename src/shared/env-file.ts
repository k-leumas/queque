import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

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
 * The value of `key` in the nearest `.env.local` at or above `startDir`, or null.
 *
 * `startDir` defaults to the home directory (WR-10), the same file the daemon reads
 * (WR-08), so the client's in-process fallback and the daemon never disagree and a
 * project's own `.env.local` in the shell's cwd is never used for keys or settings. It is
 * never the module's own path: in a Homebrew install that is the Cellar bundle.
 */
export function readEnvValueFromDotEnvLocal(key: string, startDir = homedir()): string | null {
  const cacheKey = `${key}\0${startDir}`;
  if (envCache.has(cacheKey)) {
    return envCache.get(cacheKey) ?? null;
  }

  const envPath = findUp(startDir, '.env.local');
  if (!envPath) {
    envCache.set(cacheKey, null);
    return null;
  }

  const values = parseEnvFile(readFileSync(envPath, 'utf8'));
  const result = values.get(key) ?? null;
  envCache.set(cacheKey, result);
  return result;
}
