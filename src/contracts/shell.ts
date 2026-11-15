import { z } from 'zod';

/**
 * Every shell QueQue knows (Phase 11 D-02). A shell adapter lives at
 * `shell/<name>/queque.<ext>`; fish is listed ahead of its adapter (Phase 12)
 * so the contract does not change when it lands.
 */
export const SHELL_NAMES = ['zsh', 'bash', 'fish'] as const;

export type ShellName = (typeof SHELL_NAMES)[number];

export function isShellName(value: unknown): value is ShellName {
  return typeof value === 'string' && (SHELL_NAMES as readonly string[]).includes(value);
}

/**
 * Shell request — sent from a shell adapter (`shell/<name>/queque.<ext>`) to
 * the qq client. Carries the line state as split-buffer fields (the text
 * before and after the cursor) to avoid cross-runtime cursor index math
 * between Node and the shell.
 *
 * `shell` defaults to `'zsh'`: a zsh widget from before Phase 11, still loaded
 * in a long-running shell, omits it. `shellVersion` is the raw
 * `$BASH_VERSION` / `$ZSH_VERSION`; telemetry cuts it to major.minor.
 */
export const shellRequestSchema = z.object({
  version: z.literal(1),
  ttyPath: z.string(),
  cwd: z.string().regex(/^\/[^\0]*$/, 'cwd must be an absolute POSIX path'),
  shellPid: z.number().int().positive(),
  lbuffer: z.string(),
  rbuffer: z.string(),
  shell: z.enum(SHELL_NAMES).default('zsh'),
  shellVersion: z.string().max(40).optional(),
});

export type ShellRequest = z.infer<typeof shellRequestSchema>;

/**
 * Shell result — written by the qq client so the shell adapter can apply it
 * to its line variables (zsh LBUFFER/RBUFFER, bash READLINE_LINE/READLINE_POINT).
 *
 * Three variants:
 *   cancel        — restore the original line untouched (Esc or dismiss)
 *   replace-buffer — overwrite the text before and after the cursor with the chosen command
 *   error         — provider or client error; message shown to user, line restored
 *
 * The deprecated {buffer, cursor} shape is intentionally excluded.
 * Numeric cursor offsets create Unicode index mismatches between Node (UTF-16)
 * and the shells (character-oriented).
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
