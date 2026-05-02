import { z } from 'zod';
import { shellRequestSchema } from './shell.js';

/**
 * Broad intent categories classified before any context gathering.
 * Kept intentionally coarse for MVP — see RESEARCH.md for rationale.
 *
 * Taxonomy contract (enforced by classifyIntent in src/intent/router.ts):
 *   'shell-command' — query looks like a shell command or git invocation
 *   'codebase'      — query has an explicit file-path signal or is a pkg-manager script (D-01, D-02)
 *   'filesystem'    — query describes a file system operation (rename, move, find)
 *   'general'       — non-empty query with no strong signal (lowest-confidence fallback)
 *   'unknown'       — ONLY for the empty-string query; no other input should produce this value
 */
export const requestIntentSchema = z.enum([
  'shell-command',
  'codebase',
  'filesystem',
  'general',
  'unknown',
]);

export type RequestIntent = z.infer<typeof requestIntentSchema>;

/**
 * Normalized internal request — shell transport plus inferred intent.
 * Consumers downstream of the shell bridge work with this type, not ShellRequest.
 */
export const normalizedRequestSchema = shellRequestSchema.extend({
  intent: requestIntentSchema,
});

export type NormalizedRequest = z.infer<typeof normalizedRequestSchema>;

/**
 * Always-present base context derived from the normalized request and
 * process globals. Never requires I/O.
 */
export const baseContextSchema = z.object({
  queryText: z.string(),
  cwd: z.string(),
  ttyPath: z.string(),
  shellPid: z.number().int().positive(),
  /** Hardcoded 'zsh' for Phase 2 — cross-shell support is v2 scope. */
  shellName: z.literal('zsh'),
  platform: z.string(),
  timestamp: z.string(),
});

export type BaseContext = z.infer<typeof baseContextSchema>;

/**
 * Result of the intent classifier. Includes signals for debugging
 * why a request was routed to a particular intent.
 */
export const intentDecisionSchema = z.object({
  intent: requestIntentSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});

export type IntentDecision = z.infer<typeof intentDecisionSchema>;

/**
 * A typed chunk of extra context gathered by an intent-gated provider.
 * Discriminated on `kind` so consumers can narrow safely.
 *
 * D-05/D-06 structural enforcement: neither variant has any field for file
 * content (bytes, text, lines). File names only. A future provider that needs
 * to include file content MUST add a new `kind` variant and will require an
 * explicit privacy review — it cannot sneak content in through the existing variants.
 */
export const contextChunkSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('git'),
    payload: z.object({
      cwd: z.string(),
      root: z.string(),
      branch: z.string().nullable(),
      dirty: z.boolean(),
      /** File paths only (from git status --porcelain). No diff content, no file bytes. */
      changedFiles: z.array(z.string()),
    }),
  }),
  z.object({
    kind: z.literal('filesystem'),
    payload: z.object({
      cwd: z.string(),
      /** Apparent filename extracted from query text. No file bytes read. */
      apparentFilename: z.string().nullable(),
    }),
  }),
]);

export type ContextChunk = z.infer<typeof contextChunkSchema>;

/**
 * Fully assembled context passed to the provider adapter.
 * base is always populated; extras contains only intent-relevant chunks.
 */
export const contextEnvelopeSchema = z.object({
  base: baseContextSchema,
  extras: z.array(contextChunkSchema),
});

export type ContextEnvelope = z.infer<typeof contextEnvelopeSchema>;
