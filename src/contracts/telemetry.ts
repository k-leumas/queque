import { z } from 'zod';

// RED stub (10-04 Task 1): public exports only, so the failing contract test typechecks.
// Every schema accepts nothing useful until the GREEN commit replaces this file.

export const ERROR_KINDS: readonly string[] = [];
export const PROVIDER_KINDS: readonly string[] = [];
export const QUERY_OUTCOMES: readonly string[] = [];
export const OS_KINDS: readonly string[] = [];
export const ARCH_KINDS: readonly string[] = [];
export const DISTRO_IDS: readonly string[] = [];
export const TELEMETRY_EVENTS: readonly string[] = [];
export const TELEMETRY_LIB = '';

export const queryOutcomePayloadSchema = z.strictObject({});
export const errorPayloadSchema = z.strictObject({});
export const environmentPayloadSchema = z.strictObject({});
export const telemetryCommonPropertiesSchema = z.strictObject({});
export const queryOutcomeWirePropertiesSchema = z.strictObject({});
export const errorWirePropertiesSchema = z.strictObject({});
export const environmentWirePropertiesSchema = z.strictObject({});
export const clientTelemetryEventSchema = z.never();
export const telemetryWireEventSchema = z.never();
export const telemetryBatchSchema = z.strictObject({});
