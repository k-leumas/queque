import {
  type CandidateList,
  type CommandCandidate,
  candidateListSchema,
  commandCandidateSchema,
} from '../contracts/candidates.js';

/** At most this many candidates are streamed per turn (candidateListSchema max). */
export const MAX_STREAMED_CANDIDATES = 5;

/**
 * Pulls whole candidate objects out of a JSON array as its text streams in (D-05).
 *
 * Returns a feed function for text_delta pieces. Text before the first `[` (a code fence
 * or wrapper prose) changes no state, so quotes and braces in it are never tracked. Inside
 * the array the scanner tracks depth, strings and escapes; when a `}` closes an object at
 * depth 2 it JSON-parses that object and emits it only if it passes commandCandidateSchema
 * (malformed or invalid objects are skipped; the final strict parse decides the list).
 * Scanning stops when the first array closes or after MAX_STREAMED_CANDIDATES rows. No
 * prose fallback ever runs on partial text (Pitfall 1). Only the current object's text is
 * kept, so memory stays bounded by one object.
 */
export function createCandidateScanner(
  onCandidate: (candidate: CommandCandidate) => void,
): (text: string) => void {
  let started = false;
  let finished = false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let inObject = false;
  let objectText = '';
  let emitted = 0;

  const emit = (text: string): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const candidate = commandCandidateSchema.safeParse(parsed);
    if (!candidate.success) {
      return;
    }
    emitted++;
    onCandidate(candidate.data);
    if (emitted >= MAX_STREAMED_CANDIDATES) {
      finished = true;
    }
  };

  return (text: string): void => {
    for (const ch of text) {
      if (finished) {
        return;
      }
      if (!started) {
        if (ch === '[') {
          started = true;
          depth = 1;
        }
        continue;
      }
      if (inObject) {
        objectText += ch;
      }
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '[' || ch === '{') {
        depth++;
        if (ch === '{' && depth === 2) {
          inObject = true;
          objectText = ch;
        }
      } else if (ch === ']' || ch === '}') {
        depth--;
        if (ch === '}' && depth === 1 && inObject) {
          const closed = objectText;
          inObject = false;
          objectText = '';
          emit(closed);
        } else if (depth <= 0) {
          finished = true;
        }
      }
    }
  };
}

/** Same fence rule as claude.ts `stripCodeFence` (kept local so this module stays SDK-free). */
function stripJsonCodeFence(raw: string): string {
  const match = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return match ? match[1].trim() : raw.trim();
}

/**
 * Strict final-list parse of a `result` text: the whole text (optionally in a json code
 * fence) must be a valid candidate array of 1-5 items. Returns undefined otherwise, never
 * a prose fallback.
 */
export function parseStrictCandidateList(text: string): CandidateList | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonCodeFence(text));
  } catch {
    return undefined;
  }
  const list = candidateListSchema.safeParse(parsed);
  return list.success ? list.data : undefined;
}
