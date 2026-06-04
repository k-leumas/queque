import { existsSync, readFileSync } from 'node:fs';
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

export function readEnvValueFromDotEnvLocal(key: string, startDir = process.cwd()): string | null {
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
