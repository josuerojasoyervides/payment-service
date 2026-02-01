import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator.port';

/**
 * Base validator that can be extended by providers.
 */
export abstract class BaseTokenValidator implements TokenValidator {
  protected abstract readonly patterns: RegExp[];
  protected abstract readonly patternDescriptions: string[];

  validate(token: string): void {
    if (!this.requiresToken()) {
      return;
    }

    if (!token) {
      // TODO : Fix this magic strings
      // TODO : Fix - i18n usage here
      throw new Error(`Token is required for this payment method`);
    }

    if (!this.isValid(token)) {
      // TODO : Fix this magic strings
      // TODO : Fix - i18n usage here
      throw new Error(
        `Invalid token format. Expected: ${this.patternDescriptions.join(' or ')}. ` +
          `Got: ${this.maskToken(token)}`,
      );
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
   * Mask the token for safe logging.
   */
  protected maskToken(token: string): string {
    if (!token || token.length < 8) {
      // TODO : Fix this magic strings
      // TODO : Fix - i18n usage here
      return '[invalid]';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}
