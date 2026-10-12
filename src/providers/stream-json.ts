import { z } from 'zod';

/**
 * Pure helpers for `claude -p --input-format stream-json --output-format stream-json
 * --verbose --include-partial-messages` (Phase 09.1). No spawn, no fs.
 *
 * Event shapes were recorded from Claude Code 2.1.285 (09.1-RESEARCH Probes 2 and 3).
 */

/** Largest partial line the parser keeps between chunks. Enforced in plan 06. */
export const STREAM_JSON_CARRY_CAP_BYTES = 1024 * 1024;

/**
 * The `result` event. Non-strict: Claude Code adds many more keys.
 *
 * `subtype` is not a success signal: the auth failure is `subtype: "success"` with
 * `is_error: true` (Probe 3). Gate on `is_error` only.
 */
export const streamJsonResultSchema = z.object({
  type: z.literal('result'),
  is_error: z.boolean(),
  result: z.string().optional(),
  subtype: z.string().optional(),
  duration_api_ms: z.number().optional(),
});

export type StreamJsonResult = z.infer<typeof streamJsonResultSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Returns a feed function for decoded stdout text (set the stream's encoding to utf8 so
 * Node's StringDecoder keeps split multi-byte characters intact).
 *
 * Splits on newline, keeps the unfinished tail, skips empty lines, and passes every line
 * that parses as JSON to `onEvent`. Lines that are not JSON are dropped silently, so they
 * never reach any candidate parser.
 */
export interface LineParserOptions {
  /** Largest unfinished line kept between chunks, in UTF-8 bytes. */
  maxCarryBytes?: number;
  /** Called once when the carry passes `maxCarryBytes`; later input is ignored. */
  onOverflow?: () => void;
}

export function createLineParser(
  onEvent: (event: unknown) => void,
  _options: LineParserOptions = {},
): (chunk: string) => void {
  let carry = '';
  return (chunk: string): void => {
    carry += chunk;
    let nl = carry.indexOf('\n');
    while (nl !== -1) {
      const line = carry.slice(0, nl).trim();
      carry = carry.slice(nl + 1);
      nl = carry.indexOf('\n');
      if (!line) {
        continue;
      }
      let event: unknown;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      onEvent(event);
    }
  };
}

/** The text of a `stream_event` `content_block_delta` `text_delta`, else undefined. */
export function textDeltaOf(event: unknown): string | undefined {
  if (!isRecord(event) || event.type !== 'stream_event') {
    return undefined;
  }
  const inner = event.event;
  if (!isRecord(inner) || inner.type !== 'content_block_delta') {
    return undefined;
  }
  const delta = inner.delta;
  if (!isRecord(delta) || delta.type !== 'text_delta' || typeof delta.text !== 'string') {
    return undefined;
  }
  return delta.text;
}

/** True for the `system` / `init` event Claude Code emits once boot is done. */
export function isInitEvent(event: unknown): boolean {
  return isRecord(event) && event.type === 'system' && event.subtype === 'init';
}

/** One stream-json user message line for stdin, newline included. */
export function buildStreamJsonUserLine(prompt: string): string {
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } })}\n`;
}
