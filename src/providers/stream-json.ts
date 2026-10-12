import { z } from 'zod';

/** Largest partial line the parser keeps between chunks. Enforced in plan 06. */
export const STREAM_JSON_CARRY_CAP_BYTES = 1024 * 1024;

/**
 * The `result` event of `claude -p --output-format stream-json`.
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

export function createLineParser(_onEvent: (event: unknown) => void): (chunk: string) => void {
  throw new Error('createLineParser: not implemented');
}

export function textDeltaOf(_event: unknown): string | undefined {
  throw new Error('textDeltaOf: not implemented');
}

export function isInitEvent(_event: unknown): boolean {
  throw new Error('isInitEvent: not implemented');
}

export function buildStreamJsonUserLine(_prompt: string): string {
  throw new Error('buildStreamJsonUserLine: not implemented');
}
