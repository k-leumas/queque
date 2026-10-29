import { describe, expect, it } from 'vitest';
import {
  ARCH_KINDS,
  clientTelemetryEventSchema,
  DISTRO_IDS,
  ERROR_KINDS,
  environmentPayloadSchema,
  environmentWirePropertiesSchema,
  errorPayloadSchema,
  errorWirePropertiesSchema,
  OS_KINDS,
  PROVIDER_KINDS,
  QUERY_OUTCOMES,
  queryOutcomePayloadSchema,
  queryOutcomeWirePropertiesSchema,
  TELEMETRY_EVENTS,
  TELEMETRY_LIB,
  telemetryBatchSchema,
  telemetryCommonPropertiesSchema,
  telemetryWireEventSchema,
} from '../src/contracts/telemetry.js';

type Sample = { event: string; properties: Record<string, unknown>; [key: string]: unknown };

const INSTALL_ID = '6f1c1a52-6a4b-4c43-9a43-0b6f5c2f8d11';
const TIMESTAMP = '2026-10-28T12:00:00.000Z';

const common = {
  distinct_id: INSTALL_ID,
  $process_person_profile: false,
  $geoip_disable: true,
  $lib: 'queque',
  $lib_version: '0.8.0',
};

const clientSamples: Sample[] = [
  {
    event: 'qq_query_outcome',
    properties: { outcome: 'accepted', candidate_count: 2, provider: 'claude-cli' },
  },
  {
    event: 'qq_error',
    properties: { error_kind: 'provider_timeout', provider: 'claude-sdk' },
  },
  {
    event: 'qq_environment',
    properties: {
      os: 'linux',
      arch: 'arm64',
      distro: 'alpine',
      zsh: '5.9',
      node_major: 24,
      zellij: false,
    },
  },
];

const wireSamples: Sample[] = clientSamples.map((sample) => ({
  event: sample.event,
  timestamp: TIMESTAMP,
  properties: { ...common, ...sample.properties },
}));

function withProperty(sample: Sample, key: string, value: unknown): Sample {
  return { ...sample, properties: { ...sample.properties, [key]: value } };
}

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

/** Fields that must never be accepted: content, identity, location and timing (D-10, D-11). */
const FORBIDDEN_FIELDS = [
  'cwd',
  'lbuffer',
  'rbuffer',
  'command',
  'query',
  'message',
  'stack',
  'path',
  'env',
  'hostname',
  'user',
  '$ip',
  'latency_ms',
  'duration_ms',
  'elapsed_ms',
  'ttfc_ms',
] as const;

describe('telemetry enums', () => {
  it('lists the allowed values of every enum', () => {
    expect(ERROR_KINDS).toEqual([
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
    ]);
    expect(PROVIDER_KINDS).toEqual(['claude-sdk', 'claude-cli', 'openai', 'ollama', 'unknown']);
    expect(QUERY_OUTCOMES).toEqual(['accepted', 'escaped', 'error']);
    expect(OS_KINDS).toEqual(['darwin', 'linux', 'other']);
    expect(ARCH_KINDS).toEqual(['x64', 'arm64', 'other']);
    expect(DISTRO_IDS).toEqual(['macos', 'ubuntu', 'debian', 'fedora', 'arch', 'alpine', 'other']);
    expect(TELEMETRY_EVENTS).toEqual(['qq_query_outcome', 'qq_error', 'qq_environment']);
    expect(TELEMETRY_LIB).toBe('queque');
  });
});

describe('valid samples parse', () => {
  it('accepts one sample of each client event', () => {
    for (const sample of clientSamples) {
      expect(clientTelemetryEventSchema.safeParse(sample).success).toBe(true);
    }
  });

  it('accepts one sample of each wire event', () => {
    for (const sample of wireSamples) {
      expect(telemetryWireEventSchema.safeParse(sample).success).toBe(true);
    }
  });

  it('accepts a batch with one event', () => {
    const batch = { api_key: 'phc_test', batch: [wireSamples[0]] };
    expect(telemetryBatchSchema.safeParse(batch).success).toBe(true);
  });

  it('accepts a batch of 100 events', () => {
    const batch = { api_key: 'phc_test', batch: Array.from({ length: 100 }, () => wireSamples[1]) };
    expect(telemetryBatchSchema.safeParse(batch).success).toBe(true);
  });

  it('accepts the literal zsh version `unknown`', () => {
    const sample = withProperty(clientSamples[2] as Sample, 'zsh', 'unknown');
    expect(clientTelemetryEventSchema.safeParse(sample).success).toBe(true);
  });
});

describe('the allow list rejects any field outside it', () => {
  it.each(FORBIDDEN_FIELDS)('rejects `%s` in client event properties', (field) => {
    for (const sample of clientSamples) {
      const bad = withProperty(sample, field, 'x');
      expect(clientTelemetryEventSchema.safeParse(bad).success).toBe(false);
    }
  });

  it.each(FORBIDDEN_FIELDS)('rejects `%s` in wire event properties', (field) => {
    for (const sample of wireSamples) {
      const bad = withProperty(sample, field, 'x');
      expect(telemetryWireEventSchema.safeParse(bad).success).toBe(false);
    }
  });

  it.each(FORBIDDEN_FIELDS)('rejects `%s` in a batch event', (field) => {
    const bad = { api_key: 'phc_test', batch: [withProperty(wireSamples[0] as Sample, field, 1)] };
    expect(telemetryBatchSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown top-level key on every event and on the batch', () => {
    for (const sample of clientSamples) {
      expect(clientTelemetryEventSchema.safeParse({ ...sample, uuid: INSTALL_ID }).success).toBe(
        false,
      );
    }
    for (const sample of wireSamples) {
      expect(telemetryWireEventSchema.safeParse({ ...sample, $set: {} }).success).toBe(false);
    }
    const batch = { api_key: 'phc_test', batch: [wireSamples[0]], historical_migration: true };
    expect(telemetryBatchSchema.safeParse(batch).success).toBe(false);
  });

  it('rejects identity or a timestamp on a client event (the daemon adds them)', () => {
    const outcome = clientSamples[0] as Sample;
    expect(clientTelemetryEventSchema.safeParse({ ...outcome, timestamp: TIMESTAMP }).success).toBe(
      false,
    );
    const withId = withProperty(outcome, 'distinct_id', INSTALL_ID);
    expect(clientTelemetryEventSchema.safeParse(withId).success).toBe(false);
  });

  it('rejects an unknown event name', () => {
    const bad = { ...(clientSamples[1] as Sample), event: 'qq_debug' };
    expect(clientTelemetryEventSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects wire events with wrong privacy literals or a missing common field', () => {
    const outcome = wireSamples[0] as Sample;
    expect(
      telemetryWireEventSchema.safeParse(withProperty(outcome, '$process_person_profile', true))
        .success,
    ).toBe(false);
    expect(
      telemetryWireEventSchema.safeParse(withProperty(outcome, '$geoip_disable', false)).success,
    ).toBe(false);
    expect(
      telemetryWireEventSchema.safeParse(withProperty(outcome, '$lib', 'posthog-node')).success,
    ).toBe(false);
    const { distinct_id: _omitted, ...withoutId } = outcome.properties;
    expect(telemetryWireEventSchema.safeParse({ ...outcome, properties: withoutId }).success).toBe(
      false,
    );
  });

  it('rejects a distinct_id that is not a UUID (no host or user identifiers)', () => {
    const outcome = wireSamples[0] as Sample;
    for (const id of ['alice@laptop', 'laptop.local', '192.168.1.4', '']) {
      expect(
        telemetryWireEventSchema.safeParse(withProperty(outcome, 'distinct_id', id)).success,
      ).toBe(false);
    }
  });

  it('rejects a non-ISO timestamp and a free-form lib version', () => {
    const outcome = wireSamples[0] as Sample;
    expect(telemetryWireEventSchema.safeParse({ ...outcome, timestamp: 'yesterday' }).success).toBe(
      false,
    );
    for (const version of ['0.8', 'v0.8.0', '0.8.0 (alice build)', `0.8.0-${'x'.repeat(40)}`]) {
      expect(
        telemetryWireEventSchema.safeParse(withProperty(outcome, '$lib_version', version)).success,
      ).toBe(false);
    }
    expect(
      telemetryWireEventSchema.safeParse(withProperty(outcome, '$lib_version', '0.8.0-beta.1'))
        .success,
    ).toBe(true);
  });
});

describe('free-form values fail', () => {
  const cases: [number, string, unknown][] = [
    [2, 'distro', 'Ubuntu 22.04.3 LTS'],
    [2, 'zsh', '5.9-dev-1'],
    [2, 'zsh', '5.9.0'],
    [2, 'node_major', 17],
    [2, 'node_major', 24.5],
    [2, 'os', 'Darwin 24.6.0'],
    [2, 'arch', 'aarch64'],
    [2, 'zellij', 'yes'],
    [0, 'provider', 'gpt-4'],
    [0, 'candidate_count', 6],
    [0, 'candidate_count', -1],
    [0, 'candidate_count', 1.5],
    [0, 'outcome', 'executed'],
    [1, 'error_kind', 'ENOENT: /home/alice'],
    [1, 'provider', 'claude-sonnet-5'],
  ];

  it.each(cases)('rejects sample %i with %s = %j', (index, key, value) => {
    const client = withProperty(clientSamples[index] as Sample, key, value);
    expect(clientTelemetryEventSchema.safeParse(client).success).toBe(false);
    const wire = withProperty(wireSamples[index] as Sample, key, value);
    expect(telemetryWireEventSchema.safeParse(wire).success).toBe(false);
  });
});

describe('error_kind on a query outcome', () => {
  const outcome = clientSamples[0] as Sample;

  it('is accepted when the outcome is error', () => {
    const sample = {
      ...outcome,
      properties: {
        outcome: 'error',
        candidate_count: 0,
        provider: 'ollama',
        error_kind: 'unknown',
      },
    };
    expect(clientTelemetryEventSchema.safeParse(sample).success).toBe(true);
    const wire = {
      ...sample,
      timestamp: TIMESTAMP,
      properties: { ...common, ...sample.properties },
    };
    expect(telemetryWireEventSchema.safeParse(wire).success).toBe(true);
  });

  it('is rejected when the outcome is accepted or escaped', () => {
    for (const value of ['accepted', 'escaped']) {
      const sample = withProperty(withProperty(outcome, 'outcome', value), 'error_kind', 'unknown');
      expect(clientTelemetryEventSchema.safeParse(sample).success).toBe(false);
      const wire = withProperty(
        withProperty(wireSamples[0] as Sample, 'outcome', value),
        'error_kind',
        'unknown',
      );
      expect(telemetryWireEventSchema.safeParse(wire).success).toBe(false);
    }
  });

  it('is required when the outcome is error', () => {
    const sample = withProperty(outcome, 'outcome', 'error');
    expect(clientTelemetryEventSchema.safeParse(sample).success).toBe(false);
    const wire = withProperty(wireSamples[0] as Sample, 'outcome', 'error');
    expect(telemetryWireEventSchema.safeParse(wire).success).toBe(false);
  });
});

describe('batch envelope', () => {
  it('rejects an empty or non-PostHog api_key', () => {
    for (const key of ['', 'sk-ant-x', 'phc_', 'phc_abc def', 'phc_abc/../x']) {
      const batch = { api_key: key, batch: [wireSamples[0]] };
      expect(telemetryBatchSchema.safeParse(batch).success).toBe(false);
    }
  });

  it('rejects a batch of 0 or 101 events', () => {
    expect(telemetryBatchSchema.safeParse({ api_key: 'phc_test', batch: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 101 }, () => wireSamples[0]);
    expect(telemetryBatchSchema.safeParse({ api_key: 'phc_test', batch: tooMany }).success).toBe(
      false,
    );
  });

  it('rejects a client event (no identity, no timestamp) inside a batch', () => {
    const batch = { api_key: 'phc_test', batch: [clientSamples[0]] };
    expect(telemetryBatchSchema.safeParse(batch).success).toBe(false);
  });
});

const COMMON_KEYS = [
  '$geoip_disable',
  '$lib',
  '$lib_version',
  '$process_person_profile',
  'distinct_id',
];
const QUERY_OUTCOME_KEYS = ['candidate_count', 'error_kind', 'outcome', 'provider'];
const ERROR_KEYS = ['error_kind', 'provider'];
const ENVIRONMENT_KEYS = ['arch', 'distro', 'node_major', 'os', 'zellij', 'zsh'];

describe('pinned allow-list keys', () => {
  it('pins the payload keys of every event', () => {
    expect(sorted(Object.keys(queryOutcomePayloadSchema.shape))).toEqual(QUERY_OUTCOME_KEYS);
    expect(sorted(Object.keys(errorPayloadSchema.shape))).toEqual(ERROR_KEYS);
    expect(sorted(Object.keys(environmentPayloadSchema.shape))).toEqual(ENVIRONMENT_KEYS);
  });

  it('pins the common wire properties', () => {
    expect(sorted(Object.keys(telemetryCommonPropertiesSchema.shape))).toEqual(COMMON_KEYS);
  });

  it('pins the wire properties of every event as payload plus common keys', () => {
    expect(sorted(Object.keys(queryOutcomeWirePropertiesSchema.shape))).toEqual(
      sorted([...QUERY_OUTCOME_KEYS, ...COMMON_KEYS]),
    );
    expect(sorted(Object.keys(errorWirePropertiesSchema.shape))).toEqual(
      sorted([...ERROR_KEYS, ...COMMON_KEYS]),
    );
    expect(sorted(Object.keys(environmentWirePropertiesSchema.shape))).toEqual(
      sorted([...ENVIRONMENT_KEYS, ...COMMON_KEYS]),
    );
  });

  it('pins the batch envelope keys', () => {
    expect(sorted(Object.keys(telemetryBatchSchema.shape))).toEqual(['api_key', 'batch']);
  });
});

/** Every key name reachable from a zod schema (objects, unions, arrays, wrappers). */
function collectKeys(schema: unknown, seen = new Set<unknown>()): string[] {
  if (schema === null || typeof schema !== 'object' || seen.has(schema)) {
    return [];
  }
  seen.add(schema);
  const def = (schema as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
  if (!def) {
    return [];
  }
  const keys: string[] = [];
  const shape = def.shape as Record<string, unknown> | undefined;
  if (shape) {
    for (const [key, value] of Object.entries(shape)) {
      keys.push(key, ...collectKeys(value, seen));
    }
  }
  for (const child of ['innerType', 'element', 'in', 'out', 'schema']) {
    keys.push(...collectKeys(def[child], seen));
  }
  for (const option of (def.options as unknown[] | undefined) ?? []) {
    keys.push(...collectKeys(option, seen));
  }
  return keys;
}

describe('no timing fields (D-11)', () => {
  const TIMING = /latency|duration|elapsed|ttfc|_ms$/i;

  it('reaches the nested keys of every schema', () => {
    const batchKeys = collectKeys(telemetryBatchSchema);
    expect(batchKeys).toContain('candidate_count');
    expect(batchKeys).toContain('zellij');
    expect(batchKeys).toContain('distinct_id');
    expect(collectKeys(clientTelemetryEventSchema)).toContain('error_kind');
  });

  it('has no latency, duration, elapsed or timing key in any schema', () => {
    const schemas = [
      clientTelemetryEventSchema,
      telemetryWireEventSchema,
      telemetryBatchSchema,
      queryOutcomePayloadSchema,
      errorPayloadSchema,
      environmentPayloadSchema,
      telemetryCommonPropertiesSchema,
    ];
    for (const schema of schemas) {
      const timing = collectKeys(schema).filter((key) => TIMING.test(key));
      expect(timing).toEqual([]);
    }
  });
});
