import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port';
import { I18nKeys } from '@core/i18n';

/**
 * Base validator for provider-specific token formats.
 *
 * Lives in Infrastructure (Stripe) — not in Domain — because it throws
 * PaymentError with i18n keys. Domain only exposes the TokenValidator port.
 */
export abstract class BaseTokenValidator implements TokenValidator {
  protected abstract readonly patterns: RegExp[];
  protected abstract readonly patternDescriptions: string[];

  validate(token: string): void {
    if (!this.requiresToken()) {
      return;
    }

    if (!token) {
      throw invalidRequestError(I18nKeys.errors.card_token_required);
    }

    if (!this.isValid(token)) {
      throw invalidRequestError(I18nKeys.errors.card_token_invalid_format, {
        expected: this.patternDescriptions.join(' or '),
        got: this.maskToken(token),
      });
    }
  }

  isValid(token: string): boolean {
    if (!this.requiresToken()) {
      return true;
    }

    if (!token) {
      return false;
    }

    return this.patterns.some((pattern) => pattern.test(token));
  }

  getAcceptedPatterns(): string[] {
    return [...this.patternDescriptions];
  }

  requiresToken(): boolean {
    return true;
  }

  /**
   * Mask the token for safe logging/error messages.
   */
  protected maskToken(token: string): string {
    if (!token || token.length < 8) {
      return '***';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}
