import { describe, expect, it } from 'vitest';
import { resolveTelemetryEndpoint } from '../src/shared/telemetry-endpoint.js';

// vitest.config.ts bakes an empty key and the discard-port host `http://127.0.0.1:9`, so a
// test that forgets to inject fetch can never reach the internet.
const VITEST_HOST = 'http://127.0.0.1:9';

describe('resolveTelemetryEndpoint', () => {
  it('is null with the empty baked key (D-22: nothing is ever sent)', () => {
    expect(resolveTelemetryEndpoint({})).toBeNull();
  });

  it('uses a QQ_TELEMETRY_KEY override with the baked host', () => {
    expect(resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: 'phc_abc123' })).toEqual({
      host: VITEST_HOST,
      key: 'phc_abc123',
    });
  });

  it('trims the key override', () => {
    expect(resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: '  phc_abc123\n' })?.key).toBe(
      'phc_abc123',
    );
  });

  it('counts an empty or whitespace key override as unset', () => {
    expect(resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: '' })).toBeNull();
    expect(resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: '  ' })).toBeNull();
  });

  it('uses a QQ_TELEMETRY_HOST override and strips trailing slashes', () => {
    expect(
      resolveTelemetryEndpoint({
        QQ_TELEMETRY_KEY: 'phc_a',
        QQ_TELEMETRY_HOST: 'https://example.test/',
      }),
    ).toEqual({ host: 'https://example.test', key: 'phc_a' });
    expect(
      resolveTelemetryEndpoint({
        QQ_TELEMETRY_KEY: 'phc_a',
        QQ_TELEMETRY_HOST: 'https://example.test/ingest//',
      })?.host,
    ).toBe('https://example.test/ingest');
  });

  it('counts an empty host override as unset', () => {
    expect(
      resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: 'phc_a', QQ_TELEMETRY_HOST: ' ' })?.host,
    ).toBe(VITEST_HOST);
  });

  it('is null for a host that is not an http(s) URL', () => {
    for (const host of ['ftp://x', 'not a url', 'file:///etc/passwd', 'javascript:alert(1)']) {
      expect(
        resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: 'phc_a', QQ_TELEMETRY_HOST: host }),
      ).toBeNull();
    }
  });

  it('is null for a host URL with a username or password', () => {
    expect(
      resolveTelemetryEndpoint({
        QQ_TELEMETRY_KEY: 'phc_a',
        QQ_TELEMETRY_HOST: 'https://user:secret@example.test',
      }),
    ).toBeNull();
  });

  it('is null for a key that is not a PostHog project key', () => {
    for (const key of ['sk-ant-x', 'phc_', 'phc_a b', 'phx_abc']) {
      expect(resolveTelemetryEndpoint({ QQ_TELEMETRY_KEY: key })).toBeNull();
    }
  });
});
