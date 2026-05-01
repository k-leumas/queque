import { z } from 'zod';
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
]);

export type IpcRequest = z.infer<typeof ipcRequestSchema>;

/**
 * IPC response — returned by the daemon for each request kind.
 */
export const ipcResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('pong'),
  }),
  z.object({
    kind: z.literal('session-ready'),
    socketPath: z.string(),
  }),
  z.object({
    kind: z.literal('query-accepted'),
    requestId: z.string(),
  }),
]);

export type IpcResponse = z.infer<typeof ipcResponseSchema>;
