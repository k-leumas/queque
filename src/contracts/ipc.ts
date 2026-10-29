import { z } from 'zod';
import { candidateListSchema, commandCandidateSchema } from './candidates.js';
import { contextEnvelopeSchema } from './request.js';
import { shellRequestSchema } from './shell.js';
import { clientTelemetryEventSchema, ERROR_KINDS } from './telemetry.js';

/**
 * IPC request — sent from the foreground client to the daemon over a Unix socket.
 */
export const ipcRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ping'),
  }),
  z.object({
    kind: z.literal('ensure-session'),
    shellPid: z.number().int().positive(),
    ttyPath: z.string(),
  }),
  z.object({
    kind: z.literal('run-query'),
    request: shellRequestSchema,
  }),
  z.object({
    kind: z.literal('fetch-candidates'),
    envelope: contextEnvelopeSchema,
    // The client wants one `candidate` message per parsed row before the final
    // `candidates` message (Phase 09.1). Old daemons strip the key and reply once.
    stream: z.literal(true).optional(),
  }),
  // Stop the daemon (WR-07): `qq init provider` restarts it without relying on `lsof`.
  // Old daemons ignore the unknown kind, so the caller falls back to signalling listeners.
  z.object({
    kind: z.literal('shutdown'),
  }),
  // One anonymous telemetry event for the daemon buffer (phase 10, D-07). Fire-and-forget:
  // the daemon never replies. Old daemons ignore the unknown kind and keep running. The
  // event schema is strict, so an event with any field outside the allow list is ignored.
  z.object({
    kind: z.literal('telemetry-event'),
    event: clientTelemetryEventSchema,
  }),
  // `qq telemetry show` (D-12): replied with `telemetry-buffer`.
  z.object({
    kind: z.literal('telemetry-show'),
  }),
  // `qq telemetry off`: drops the buffer and the last sent body; replied with `telemetry-buffer`.
  z.object({
    kind: z.literal('telemetry-reset'),
  }),
]);

export type IpcRequest = z.infer<typeof ipcRequestSchema>;

/**
 * IPC response — returned by the daemon for each request kind.
 */
export const ipcResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pong'),
    fetchCandidates: z.literal(true).optional(),
    // Daemon accepts envelopes carrying the `installed-tools` chunk (Phase 9).
    installedTools: z.literal(true).optional(),
    // Daemon streams `candidate` messages to a `stream: true` request (Phase 09.1).
    streamCandidates: z.literal(true).optional(),
    // Daemon resolves the adapter from provider.json on every fetch (Phase 8, 08-03).
    // A routing change, not an envelope shape change: a daemon without it sends every
    // prompt to Claude even when the user pinned a local provider.
    providerPin: z.literal(true).optional(),
    // Daemon buffers `telemetry-event` and answers `telemetry-show`/`telemetry-reset` (phase
    // 10). Informational only: ensureDaemon never replaces a daemon for lacking it, because
    // telemetry is optional and replacement goes through replaceStaleListener.
    telemetry: z.literal(true).optional(),
  }),
  z.object({
    kind: z.literal('session-ready'),
    socketPath: z.string(),
  }),
  z.object({
    kind: z.literal('query-accepted'),
    requestId: z.string(),
  }),
  z.object({
    kind: z.literal('fetch-accepted'),
  }),
  // One streamed row, sent only when the request carried `stream: true`.
  z.object({
    kind: z.literal('candidate'),
    candidate: commandCandidateSchema,
  }),
  // The done signal and the authoritative final list, for every request.
  z.object({
    kind: z.literal('candidates'),
    candidates: candidateListSchema,
  }),
  z.object({
    kind: z.literal('fetch-error'),
    message: z.string(),
    // What failed, as an enum classified where the error object exists (phase 10, D-10), so
    // the client reports errors without reading message text. Optional for old daemons; an
    // unknown value from a newer daemon is filtered to undefined, not a rejected reply.
    errorKind: z.enum(ERROR_KINDS).optional().catch(undefined),
  }),
  // Sent before the daemon closes its server for a `shutdown` request (WR-07).
  z.object({
    kind: z.literal('shutdown-accepted'),
  }),
  // Reply to `telemetry-show` and `telemetry-reset` (D-12): `pending` is byte for byte the
  // body the next flush would send, `lastSent` the last body sent (memory only).
  z.object({
    kind: z.literal('telemetry-buffer'),
    pending: z.string().nullable(),
    lastSent: z.string().nullable(),
  }),
]);

export type IpcResponse = z.infer<typeof ipcResponseSchema>;
