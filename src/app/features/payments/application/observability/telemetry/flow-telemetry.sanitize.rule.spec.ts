import { sanitizeTelemetryPayloadForSink } from './flow-telemetry.sanitize.rule';

describe('sanitizeTelemetryPayloadForSink', () => {
  it('filters secrets (raw/clientSecret/token/email)', () => {
    const input = {
      providerId: 'stripe',
      raw: { client_secret: 'sk_secret' },
      clientSecret: 'pi_xxx_secret_yyy',
      token: 'bearer_abc',
      email: 'user@example.com',
      headers: { Authorization: 'Bearer x' },
      authorization: 'Bearer y',
    };
    const out = sanitizeTelemetryPayloadForSink(input);
    expect(out).toEqual({ providerId: 'stripe' });
    expect(out).not.toHaveProperty('raw');
    expect(out).not.toHaveProperty('clientSecret');
    expect(out).not.toHaveProperty('token');
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('headers');
    expect(out).not.toHaveProperty('authorization');
  });

  it('keeps allowlisted keys', () => {
    const input = {
      providerId: 'paypal',
      referenceId: 'ref_123',
      eventId: 'ev_456',
      returnNonce: 'nonce_abc',
      operation: 'start',
      attempt: 1,
      reason: 'timeout',
      status: 'processing',
      code: 'ERR_TIMEOUT',
      messageKey: 'errors.timeout',
    };
    const out = sanitizeTelemetryPayloadForSink(input);
    expect(out).toEqual(input);
  });

  it('invalid input returns null', () => {
    expect(sanitizeTelemetryPayloadForSink(null)).toBeNull();
    expect(sanitizeTelemetryPayloadForSink(undefined)).toBeNull();
    expect(sanitizeTelemetryPayloadForSink(42)).toBeNull();
    expect(sanitizeTelemetryPayloadForSink('string')).toBeNull();
    expect(sanitizeTelemetryPayloadForSink([])).toBeNull();
  });

  it('ignores unknown keys', () => {
    const input = {
      providerId: 'stripe',
      unknownKey: 'ignored',
      internalId: 999,
    };
    const out = sanitizeTelemetryPayloadForSink(input);
    expect(out).toEqual({ providerId: 'stripe' });
    expect(out).not.toHaveProperty('unknownKey');
    expect(out).not.toHaveProperty('internalId');
  });
});
