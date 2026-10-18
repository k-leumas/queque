import { z } from 'zod';
import { candidateListSchema, commandCandidateSchema } from './candidates.js';
import { contextEnvelopeSchema } from './request.js';
import { shellRequestSchema } from './shell.js';

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
  }),
  // Sent before the daemon closes its server for a `shutdown` request (WR-07).
  z.object({
    kind: z.literal('shutdown-accepted'),
  }),
]);

export type IpcResponse = z.infer<typeof ipcResponseSchema>;
