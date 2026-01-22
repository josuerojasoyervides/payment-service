export class PaymentValidationError extends Error {
  constructor(
    public readonly messageKey: string,
    public readonly params?: Record<string, string | number | boolean>,
  ) {
    super(messageKey);
    this.name = 'PaymentValidationError';
  }
}
