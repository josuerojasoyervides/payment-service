import { NullTokenValidator } from '@payments/domain/common/ports/token-validator.port';

/**
 * Token validator for PayPal.
 *
 * PayPal does NOT use tokens the same way as Stripe.
 * Instead of tokenizing cards client-side, PayPal uses a redirect flow:
 *
 * 1. Create an Order in PayPal
 * 2. User is redirected to PayPal for approval
 * 3. PayPal redirects back with an approval token
 * 4. Capture the payment using the Order ID
 *
 * This validator is a no-op that always passes.
 * PayPal validations happen in the strategy (return URLs, etc.).
 *
 * @example
 * ```typescript
 * const validator = new PaypalTokenValidator();
 * validator.requiresToken();      // false
 * validator.validate('anything'); // Does nothing
 * validator.isValid('anything');  // true
 * ```
 */
export class PaypalTokenValidatorPolicy extends NullTokenValidator {
  /**
   * Override to provide a more specific message.
   */
  override getAcceptedPatterns(): string[] {
    return ['(PayPal uses redirect flow, no client-side token required)'];
  }
}
