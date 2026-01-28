import { BaseTokenValidator } from '@payments/domain/ports/provider/token-validator.port';

/**
 * Token validator for Stripe.
 *
 * Stripe uses multiple token formats based on origin:
 * - tok_* : Stripe.js/Elements token (client-side tokenization)
 * - pm_*  : PaymentMethod ID (saved or created method)
 * - card_*: Legacy Card ID (deprecated but still supported)
 *
 * @example
 * ```typescript
 * const validator = new StripeTokenValidator();
 * validator.validate('tok_1234567890abcdef'); // OK
 * validator.validate('pm_1234567890abcdef');  // OK
 * validator.validate('invalid');               // throws Error
 * ```
 */
export class StripeTokenValidator extends BaseTokenValidator {
  protected readonly patterns = [
    /^tok_[a-zA-Z0-9]{14,}$/, // Stripe.js token
    /^pm_[a-zA-Z0-9]{14,}$/, // PaymentMethod ID
    /^card_[a-zA-Z0-9]{14,}$/, // Card ID legacy
  ];

  protected readonly patternDescriptions = [
    'tok_* (Stripe.js token)',
    'pm_* (PaymentMethod ID)',
    'card_* (Card ID)',
  ];

  /**
   * Detect whether the token is for a saved card (PaymentMethod).
   *
   * Useful to decide if SCA (Strong Customer Authentication) is needed.
   */
  isSavedCard(token: string): boolean {
    return /^pm_[a-zA-Z0-9]+$/.test(token);
  }

  /**
   * Detect whether the token is from Stripe.js (freshly tokenized).
   */
  isStripeJsToken(token: string): boolean {
    return /^tok_[a-zA-Z0-9]+$/.test(token);
  }

  /**
   * Get the token type.
   */
  getTokenType(token: string): 'stripe_js' | 'payment_method' | 'card' | 'unknown' {
    if (/^tok_/.test(token)) return 'stripe_js';
    if (/^pm_/.test(token)) return 'payment_method';
    if (/^card_/.test(token)) return 'card';
    return 'unknown';
  }
}
