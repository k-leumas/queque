import { z } from 'zod';
import {
  CATALOG,
  CATALOG_SET,
  INSTALLED_TOOLS_MAX,
  TOOL_NAME_MAX_LENGTH,
  TOOL_NAME_RE,
} from '../shared/tool-catalog.js';
import { shellRequestSchema } from './shell.js';

/** Plain tool names only: no spaces, paths, quotes or shell syntax, at most 64 chars each. */
const toolNamesSchema = z.array(z.string().max(TOOL_NAME_MAX_LENGTH).regex(TOOL_NAME_RE));

/** Keeps the first occurrence of each catalog name, in input order; drops everything else. */
function keepCatalogNames(tools: string[]): string[] {
  const seen = new Set<string>();
  return tools.filter((tool) => {
    if (!CATALOG_SET.has(tool) || seen.has(tool)) {
      return false;
    }
    seen.add(tool);
    return true;
  });
}

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
  confidence: z.number().min(0).max(1),
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
 * D-05/D-06 structural enforcement: no variant has any field for file
 * content (bytes, text, lines). File names only. A future provider that needs
 * to include file content MUST add a new `kind` variant and will require an
 * explicit privacy review — it cannot sneak content in through the existing variants.
 *
 * Phase 9 D-04: the `installed-tools` variant carries public catalog tool names
 * only (src/shared/tool-catalog.ts), never the full installed list, function or
 * alias names. This is the lenient schema the daemon parses: it rejects malformed
 * SHAPES (a string that is not a plain tool name, a name over 64 chars, more than
 * INSTALLED_TOOLS_MAX entries) but FILTERS unknown VALUES, so a newer client's
 * catalog addition is dropped by an older daemon instead of making it ignore the
 * whole request (server.ts drops a failed parse silently, which costs the 800 ms
 * ack timeout plus a cold fallback). The client checks
 * `strictInstalledToolsChunkSchema` before sending — that is the guard that turns
 * a bug pushing the full installed list into a send-time failure.
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
  z.object({
    kind: z.literal('installed-tools'),
    payload: z.object({
      tools: toolNamesSchema.max(INSTALLED_TOOLS_MAX).transform(keepCatalogNames),
    }),
  }),
]);

export type ContextChunk = z.infer<typeof contextChunkSchema>;

/**
 * Client-side check for the `installed-tools` chunk (09-05 runs it before sending).
 * Unlike the lenient union variant, any non-catalog name is an error, not a filter.
 */
export const strictInstalledToolsChunkSchema = z.object({
  kind: z.literal('installed-tools'),
  payload: z.object({
    tools: toolNamesSchema
      .max(CATALOG.length)
      .refine((tools) => tools.every((tool) => CATALOG_SET.has(tool)), {
        message: 'installed-tools may only carry curated catalog names (D-04)',
      }),
  }),
});

export type StrictInstalledToolsChunk = z.infer<typeof strictInstalledToolsChunkSchema>;

/**
 * Fully assembled context passed to the provider adapter.
 * base is always populated; extras contains only intent-relevant chunks.
 */
export const contextEnvelopeSchema = z.object({
  base: baseContextSchema,
  extras: z.array(contextChunkSchema),
});

export type ContextEnvelope = z.infer<typeof contextEnvelopeSchema>;
