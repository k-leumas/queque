import { z } from 'zod';

/**
 * Anonymous telemetry contract (phase 10, D-10, D-11). This file IS the allow list.
 *
 * Rules every schema here follows, and that tests/telemetry-contract.test.ts enforces:
 * - every object is a strict object, so any key outside the allow list (cwd, lbuffer,
 *   command, message, path, env, hostname, $ip, ...) fails validation instead of being
 *   stripped or forwarded;
 * - every value is an enum, a literal, a bounded integer or a tight regex. There is no
 *   free-form string anywhere: a distro PRETTY_NAME, a full zsh build string or an error
 *   message could carry a path or become a fingerprint (RESEARCH Pitfall 9);
 * - no latency, duration or other timing field (D-11);
 * - client events carry no identity and no timestamp; the daemon adds both when it wraps
 *   an event for PostHog, then validates the full wire event again.
 *
 * Adding a field means editing this file and the pinned key lists in the test, on purpose.
 * Event and property names become the stored PostHog schema: add, do not rename.
 */

export const ERROR_KINDS = [
  'auth_missing',
  'key_rejected',
  'key_refused',
  'provider_missing',
  'provider_timeout',
  'provider_failed',
  'response_truncated',
  'parse_failed',
  'pin_invalid',
  'socket_failed',
  'tty_unavailable',
  'unknown',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const PROVIDER_KINDS = ['claude-sdk', 'claude-cli', 'openai', 'ollama', 'unknown'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const QUERY_OUTCOMES = ['accepted', 'escaped', 'error'] as const;
export type QueryOutcome = (typeof QUERY_OUTCOMES)[number];

export const OS_KINDS = ['darwin', 'linux', 'other'] as const;
export type OsKind = (typeof OS_KINDS)[number];

export const ARCH_KINDS = ['x64', 'arm64', 'other'] as const;
export type ArchKind = (typeof ARCH_KINDS)[number];

export const DISTRO_IDS = [
  'macos',
  'ubuntu',
  'debian',
  'fedora',
  'arch',
  'alpine',
  'other',
] as const;
export type DistroId = (typeof DISTRO_IDS)[number];

export const TELEMETRY_EVENTS = ['qq_query_outcome', 'qq_error', 'qq_environment'] as const;
export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[number];

/** `$lib` on every wire event; the qq version travels as `$lib_version`. */
export const TELEMETRY_LIB = 'queque';

/** Upper bound of `candidate_count`: candidateListSchema allows at most 5 candidates. */
const MAX_CANDIDATES = 5;

const errorKind = z.enum(ERROR_KINDS);
const providerKind = z.enum(PROVIDER_KINDS);

const queryOutcomeFields = {
  outcome: z.enum(QUERY_OUTCOMES),
  candidate_count: z.number().int().min(0).max(MAX_CANDIDATES),
  provider: providerKind,
  /** Present exactly when outcome is `error` (refinement below). */
  error_kind: errorKind.optional(),
};

const errorFields = {
  error_kind: errorKind,
  provider: providerKind,
};

const environmentFields = {
  os: z.enum(OS_KINDS),
  arch: z.enum(ARCH_KINDS),
  distro: z.enum(DISTRO_IDS),
  /** zsh major.minor only: `5.9`, never `5.9-dev-1` or a build string. */
  zsh: z.union([z.string().regex(/^\d{1,2}\.\d{1,2}$/), z.literal('unknown')]),
  node_major: z.number().int().min(18).max(99),
  zellij: z.boolean(),
};

/** Properties the daemon adds to every wire event. */
const commonFields = {
  /** The random install UUID (D-06); never derived from host, user or network identifiers. */
  distinct_id: z.uuid(),
  /** No PostHog person profile for an anonymous install. */
  $process_person_profile: z.literal(false),
  $geoip_disable: z.literal(true),
  $lib: z.literal(TELEMETRY_LIB),
  $lib_version: z
    .string()
    .max(40)
    .regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/),
};

const ERROR_KIND_MISMATCH = {
  message: 'error_kind is allowed exactly when outcome is error',
  path: ['error_kind'],
};

function errorKindMatchesOutcome(value: {
  outcome: QueryOutcome;
  error_kind?: ErrorKind;
}): boolean {
  return (value.outcome === 'error') === (value.error_kind !== undefined);
}

export const queryOutcomePayloadSchema = z
  .strictObject(queryOutcomeFields)
  .refine(errorKindMatchesOutcome, ERROR_KIND_MISMATCH);
export const errorPayloadSchema = z.strictObject(errorFields);
export const environmentPayloadSchema = z.strictObject(environmentFields);
export const telemetryCommonPropertiesSchema = z.strictObject(commonFields);

// The wire properties are built as new strict objects from the field maps (not by merging
// schemas), so strictness and the outcome refinement are explicit for every event.
export const queryOutcomeWirePropertiesSchema = z
  .strictObject({ ...commonFields, ...queryOutcomeFields })
  .refine(errorKindMatchesOutcome, ERROR_KIND_MISMATCH);
export const errorWirePropertiesSchema = z.strictObject({ ...commonFields, ...errorFields });
export const environmentWirePropertiesSchema = z.strictObject({
  ...commonFields,
  ...environmentFields,
});

/** What the client sends to the daemon over IPC: no identity, no timestamp. */
export const clientTelemetryEventSchema = z.discriminatedUnion('event', [
  z.strictObject({ event: z.literal('qq_query_outcome'), properties: queryOutcomePayloadSchema }),
  z.strictObject({ event: z.literal('qq_error'), properties: errorPayloadSchema }),
  z.strictObject({ event: z.literal('qq_environment'), properties: environmentPayloadSchema }),
]);

const timestamp = z.iso.datetime();

/** One event as it goes to PostHog `/batch/`. */
export const telemetryWireEventSchema = z.discriminatedUnion('event', [
  z.strictObject({
    event: z.literal('qq_query_outcome'),
    timestamp,
    properties: queryOutcomeWirePropertiesSchema,
  }),
  z.strictObject({
    event: z.literal('qq_error'),
    timestamp,
    properties: errorWirePropertiesSchema,
  }),
  z.strictObject({
    event: z.literal('qq_environment'),
    timestamp,
    properties: environmentWirePropertiesSchema,
  }),
]);

/** Upper bound of events in one POST; the daemon buffer caps at the same size. */
export const TELEMETRY_BATCH_MAX = 100;

/** The PostHog `/batch/` body. The key is the public project key (`phc_`), never a secret. */
export const telemetryBatchSchema = z.strictObject({
  api_key: z
    .string()
    .max(200)
    .regex(/^phc_[A-Za-z0-9_]+$/),
  batch: z.array(telemetryWireEventSchema).min(1).max(TELEMETRY_BATCH_MAX),
});

export type ClientTelemetryEvent = z.infer<typeof clientTelemetryEventSchema>;
export type TelemetryWireEvent = z.infer<typeof telemetryWireEventSchema>;
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
