import { sanitizeDebugEventForUi } from './debug-sanitize.rule';

describe('sanitizeDebugEventForUi', () => {
  it('accepts { type: "RESET" } and returns { type: "RESET" }', () => {
    const result = sanitizeDebugEventForUi({ type: 'RESET' });
    expect(result).toEqual({ type: 'RESET' });
  });

  it('filters payload: only allowlisted keys (providerId, referenceId) kept; raw and clientSecret removed', () => {
    const input = {
      type: 'WEBHOOK_RECEIVED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_1',
        raw: { secret: 'x', body: {} },
        clientSecret: 'x',
      },
    };
    const result = sanitizeDebugEventForUi(input);
    expect(result).toEqual({
      type: 'WEBHOOK_RECEIVED',
      payload: { providerId: 'stripe', referenceId: 'pi_1' },
    });
  });

  it('returns null for invalid input (null)', () => {
    expect(sanitizeDebugEventForUi(null)).toBeNull();
  });

  it('returns null for invalid input (string)', () => {
    expect(sanitizeDebugEventForUi('RESET')).toBeNull();
  });

  it('returns null for object without type', () => {
    expect(sanitizeDebugEventForUi({ payload: {} })).toBeNull();
  });

  it('returns null for object with non-string type', () => {
    expect(sanitizeDebugEventForUi({ type: 123 })).toBeNull();
  });

  it('returns null for array', () => {
    expect(sanitizeDebugEventForUi([{ type: 'RESET' }])).toBeNull();
  });
});
