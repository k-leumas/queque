import { usableSecret } from './env-file.js';

/**
 * Where anonymous telemetry goes (phase 10, D-05, D-08, D-22).
 *
 * Builds bake the PostHog Cloud EU host and the public project key (`__QUEQUE_TELEMETRY_HOST__`,
 * `__QUEQUE_TELEMETRY_KEY__` in tsup.config.ts). The key is empty until the PostHog project
 * exists, and an empty key resolves to no endpoint, so nothing can be sent. QQ_TELEMETRY_KEY
 * and QQ_TELEMETRY_HOST override the baked values (tests, forks); an empty or whitespace-only
 * override counts as unset (usableSecret, never `??` on the raw value).
 */
export interface TelemetryEndpoint {
  /** http(s) origin plus optional path prefix, without trailing slashes; callers append `/batch/`. */
  host: string;
  /** Public PostHog project key (`phc_…`). */
  key: string;
}

const PROJECT_KEY = /^phc_[A-Za-z0-9_]+$/;

/** The endpoint to send to, or null when telemetry has no usable key or host. */
export function resolveTelemetryEndpoint(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryEndpoint | null {
  const key = usableSecret(env.QQ_TELEMETRY_KEY) ?? __QUEQUE_TELEMETRY_KEY__;
  if (!PROJECT_KEY.test(key)) {
    return null;
  }

  const host = usableSecret(env.QQ_TELEMETRY_HOST) ?? __QUEQUE_TELEMETRY_HOST__;
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    // Credentials in the URL would travel with every batch; refuse the host instead.
    return null;
  }
  return { host: host.replace(/\/+$/, ''), key };
}
