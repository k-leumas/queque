import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { getProviderAdapter } from '../registry/provider-backends.js';
import { appendDebugLog } from '../shared/debug-log.js';
import type { LLMAdapter } from './provider.js';
import { resolveClaudeDefaultAdapter } from './resolver.js';

// Phase 8 provider pin (D-02, D-14, D-15). `~/.config/qq/provider.json` is the only runtime
// selector besides the Claude silent default (D-01, D-03): nothing here probes a backend.

/** On-disk pin format version; bump it (with a reader migration) to reshape the file. */
export const PROVIDER_PIN_VERSION = 1;

/** Default Ollama server when an Ollama pin has no `baseUrl`. */
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

// WR-04: no control bytes (C0, DEL, C1), the same rule as listOllamaModels' names; the
// model is echoed in error copy (`ollama pull <model>`) and in the picker's `Current:` line.
const modelName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[^\p{Cc}]+$/u, { message: 'model must not contain control characters' });

const httpUrl = z.string().refine(
  (value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'baseUrl must be an http or https URL' },
);

const version = z.literal(PROVIDER_PIN_VERSION);

/**
 * provider.json schema: a versioned union of strict objects with no secret fields.
 *
 * Strictness is the secrets guard: an extra key such as `apiKey` makes the pin invalid
 * (fail closed) instead of silently storing a credential. OpenAI has no `baseUrl`, so a
 * pin can never redirect an OpenAI key to another host.
 */
export const providerPinSchema = z.discriminatedUnion('provider', [
  z.strictObject({ version, provider: z.literal('claude') }),
  z.strictObject({ version, provider: z.literal('openai'), model: modelName.optional() }),
  z.strictObject({
    version,
    provider: z.literal('ollama'),
    model: modelName,
    baseUrl: httpUrl.optional(),
  }),
]);

export type ProviderPin = z.infer<typeof providerPinSchema>;

export type ProviderPinState =
  | { kind: 'absent' }
  | { kind: 'pinned'; pin: ProviderPin }
  | { kind: 'invalid'; path: string; message: string };

/** Registry backend id for each pinnable provider. */
export const PIN_BACKEND_IDS: Record<ProviderPin['provider'], string> = {
  claude: 'claude-cli',
  openai: 'openai',
  ollama: 'ollama',
};

/**
 * Returns the pin path: ~/.config/qq/provider.json, a sibling of config.json.
 * Override with QQ_PROVIDER_FILE for tests or custom installs.
 *
 * WR-03: an empty or whitespace-only override counts as unset (never `??`, which would
 * use the empty string as a path, read ENOENT and fall through to the Claude default).
 */
export function providerPinPath(): string {
  const override = process.env.QQ_PROVIDER_FILE?.trim();
  return override ? override : join(homedir(), '.config', 'qq', 'provider.json');
}

/**
 * WR-03: a relative QQ_PROVIDER_FILE resolves against each process's own cwd, so the
 * daemon or the client in another directory would read ENOENT and silently use Claude.
 * It is rejected as an invalid pin (fail closed) instead.
 */
const RELATIVE_PIN_PATH_MESSAGE = 'QQ_PROVIDER_FILE must be an absolute path';

/** Longest reason describeIssues returns; the message reaches the terminal and the log. */
export const MAX_ISSUE_REASON = 120;

/**
 * A short reason built from zod issue paths and key names, never from file values.
 *
 * IN-02: unknown key names come from the file, so control characters (C0, DEL, C1) are
 * replaced with `?` and the joined reason is capped at MAX_ISSUE_REASON characters before
 * it reaches the fetch-error message, the daemon debug log and the terminal.
 */
function describeIssues(error: z.ZodError): string {
  const parts = error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return `unknown key ${issue.keys.join(', ')}`;
    }
    return issue.path.length > 0 ? issue.path.join('.') : issue.code;
  });
  const reason = [...new Set(parts)].join(', ').replace(/\p{Cc}/gu, '?');
  return reason.length > MAX_ISSUE_REASON ? `${reason.slice(0, MAX_ISSUE_REASON - 1)}…` : reason;
}

/**
 * Reads and validates the pin. Runs a sync read on every call with no cache, so an edited
 * pin applies on the next fetch without a daemon restart (D-15).
 *
 * ENOENT at an absolute path is the only `absent` case. A relative QQ_PROVIDER_FILE, any
 * other read error, an empty file, invalid JSON, or a schema failure is `invalid`; the
 * message never carries file contents.
 */
export function loadProviderPin(): ProviderPinState {
  const path = providerPinPath();
  if (!isAbsolute(path)) {
    return { kind: 'invalid', path, message: RELATIVE_PIN_PATH_MESSAGE };
  }

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { kind: 'absent' };
    }
    return { kind: 'invalid', path, message: code ?? 'unreadable' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'invalid', path, message: 'not valid JSON' };
  }

  const result = providerPinSchema.safeParse(parsed);
  if (!result.success) {
    return { kind: 'invalid', path, message: describeIssues(result.error) };
  }
  return { kind: 'pinned', pin: result.data };
}

/**
 * Writes the pin atomically and returns its path (D-14, D-15).
 *
 * The pin is validated first, so the writer can never store anything the loader would
 * reject (and the strict schema keeps secrets out). The JSON goes to a sibling temp file
 * created exclusively (`wx`, mode 0600: a pre-planted file or symlink at that name fails
 * instead of being followed), then is renamed over the target, so a reader sees the old
 * pin or the new one and never a partial file. A new directory is created 0700.
 */
export function writeProviderPin(pin: ProviderPin): string {
  const parsed = providerPinSchema.parse(pin);
  const target = providerPinPath();
  if (!isAbsolute(target)) {
    // The loader would reject this path, so never write a pin no process can read.
    throw new Error(RELATIVE_PIN_PATH_MESSAGE);
  }
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const temp = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    // IN-03: chmod before the rename, so a failure leaves the old pin in place and the
    // caller's "No changes made" is true (after the rename the new pin would already be live).
    chmodSync(temp, 0o600);
    renameSync(temp, target);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {
      // already renamed, or never created
    }
    throw error;
  }
  return target;
}

/**
 * The runtime provider selector (D-02): a pinned provider resolves only its own backend;
 * no pin resolves the Claude default. An invalid or unreadable pin throws and never
 * resolves Claude, so a local-only user's prompt is not sent to a hosted provider.
 */
export function resolveProviderAdapter(): LLMAdapter {
  const state = loadProviderPin();

  if (state.kind === 'absent') {
    void appendDebugLog('provider', 'provider selected', { provider: 'claude', source: 'default' });
    return resolveClaudeDefaultAdapter();
  }

  if (state.kind === 'invalid') {
    void appendDebugLog('provider', 'provider selected', { source: 'invalid' });
    throw new Error(
      `QueQue: ${state.path} is not a valid provider pin (${state.message}). Fix the file or run \`qq init provider\`.`,
    );
  }

  const { provider } = state.pin;
  void appendDebugLog('provider', 'provider selected', { provider, source: 'pin' });
  if (provider === 'claude') {
    return resolveClaudeDefaultAdapter();
  }
  const adapter = getProviderAdapter(PIN_BACKEND_IDS[provider]);
  if (!adapter) {
    throw new Error(
      `QueQue: provider '${provider}' is not registered — was bootstrapBuiltins() called?`,
    );
  }
  return adapter;
}
