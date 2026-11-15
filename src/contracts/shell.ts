import { z } from 'zod';

/**
 * Shell request — sent from the zsh widget to the qq client.
 * Carries the raw ZLE buffer state using split-buffer fields to avoid
 * cross-runtime cursor index math between Node and zsh.
 */
export const shellRequestSchema = z.object({
  version: z.literal(1),
  ttyPath: z.string(),
  cwd: z.string().regex(/^\/[^\0]*$/, 'cwd must be an absolute POSIX path'),
  shellPid: z.number().int().positive(),
  lbuffer: z.string(),
  rbuffer: z.string(),
});

export type ShellRequest = z.infer<typeof shellRequestSchema>;

/**
 * Shell result — written by the qq client so the zsh widget can apply it.
 *
 * Three variants:
 *   cancel        — leave LBUFFER/RBUFFER untouched (Esc or dismiss)
 *   replace-buffer — overwrite LBUFFER and RBUFFER with the chosen command
 *   error         — provider or client error; message shown to user, buffers restored
 *
 * The deprecated {buffer, cursor} shape is intentionally excluded.
 * Numeric cursor offsets create Unicode index mismatches between Node (UTF-16)
 * and zsh (character-oriented).
 */
export const shellResultSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('cancel'),
    })
    .strict(),
  z.object({
    kind: z.literal('replace-buffer'),
    lbuffer: z.string(),
    rbuffer: z.string(),
    query: z.string().optional(),
  }),
  z.object({
    kind: z.literal('error'),
    message: z.string(),
  }),
]);

export type ShellResult = z.infer<typeof shellResultSchema>;
