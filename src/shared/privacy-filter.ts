import type { ContextEnvelope } from '../contracts/request.js';
import { loadQqConfig } from './qq-config.js';

/**
 * Returns true when a file path segment should not be sent to providers or logs.
 */
export function isSensitivePath(path: string): boolean {
  const { sensitivePathRegexes } = loadQqConfig();
  return sensitivePathRegexes.some((pattern) => pattern.test(path));
}

/**
 * Returns true when file-content reads are explicitly allowed (default off per D-06).
 * Override via QQ_ALLOW_FILE_READ=1 or privacy.allowFileRead in config.json.
 */
export function isFileReadAllowed(): boolean {
  return loadQqConfig().allowFileRead;
}

/**
 * Strips sensitive paths from git context chunks before API calls and logging.
 * Does not read .gitignore — patterns come from built-in defaults plus config.json.
 */
export function filterContextEnvelope(envelope: ContextEnvelope): ContextEnvelope {
  return {
    ...envelope,
    extras: envelope.extras.map((chunk) => {
      if (chunk.kind !== 'git') {
        return chunk;
      }

      return {
        ...chunk,
        payload: {
          ...chunk.payload,
          changedFiles: chunk.payload.changedFiles.filter((filePath) => !isSensitivePath(filePath)),
        },
      };
    }),
  };
}

/**
 * Redacts shell buffer text and nested request objects for debug logs.
 * Set QQ_DEBUG_VERBOSE=1 to log full payloads during local debugging.
 */
export function redactForLog(details: unknown): unknown {
  if (process.env.QQ_DEBUG_VERBOSE === '1' || details === undefined) {
    return details;
  }

  if (details === null || typeof details !== 'object') {
    return details;
  }

  if (Array.isArray(details)) {
    return details.map((item) => redactForLog(item));
  }

  const { redactLogKeys } = loadQqConfig();
  const input = details as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (redactLogKeys.has(key)) {
      if (typeof value === 'string') {
        output[key] = `[redacted:${value.length}chars]`;
      } else {
        output[key] = redactForLog(value);
      }
      continue;
    }

    output[key] = redactForLog(value);
  }

  return output;
}

/**
 * Returns true when a command matches known destructive patterns (warn-only in UI).
 */
export function isDestructiveCommand(command: string): boolean {
  const { destructiveCommandRegexes } = loadQqConfig();
  return destructiveCommandRegexes.some((pattern) => pattern.test(command));
}
