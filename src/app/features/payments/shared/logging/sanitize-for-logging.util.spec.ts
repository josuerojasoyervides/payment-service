import { sanitizeForLogging } from './sanitize-for-logging.util';

describe('sanitizeForLogging', () => {
  it('redacts default sensitive keys', () => {
    const input = {
      token: 'tok_123',
      authorization: 'Bearer secret',
      nested: { clientSecret: 'secret_123', cvc: '123' },
    };

    const result = sanitizeForLogging(input);

    expect(result).toEqual({
      token: '[REDACTED]',
      authorization: '[REDACTED]',
      nested: { clientSecret: '[REDACTED]', cvc: '[REDACTED]' },
    });
  });

  it('redacts extra keys passed via options', () => {
    const input = {
      customerEmail: 'test@example.com',
      profile: { phone: '555-1234' },
    };

    const result = sanitizeForLogging(input, {
      redactKeys: ['customerEmail', 'phone'],
    });

    expect(result).toEqual({
      customerEmail: '[REDACTED]',
      profile: { phone: '[REDACTED]' },
    });
  });

  it('handles arrays and circular references safely', () => {
    const input: any = { token: 'tok_123' };
    input.self = input;
    input.items = [{ cardNumber: '4111111111111111' }];

    const result = sanitizeForLogging(input);

    expect(result.token).toBe('[REDACTED]');
    expect(result.self).toBe('[Circular]');
    expect(result.items).toEqual([{ cardNumber: '[REDACTED]' }]);
  });
});
