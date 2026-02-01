/**
 * Port for payment token validation.
 *
 * Each provider implements its own validation logic
 *
 * This allows shared strategies (CardStrategy)
 * to delegate provider-specific validation.
 */
export interface TokenValidator {
  /**
   * Validate that the token has the correct format for this provider.
   *
   * @param token Token to validate
   * @throws Error if the token is invalid
   */
  validate(token: string): void;

  /**
   * Check whether a token has a valid format without throwing.
   *
   * @param token Token to check
   * @returns true if the token is valid
   */
  isValid(token: string): boolean;

  /**
   * Return the accepted token patterns (for docs/debugging).
   *
   * @returns Array of strings describing accepted patterns
   */
  getAcceptedPatterns(): string[];

  /**
   * Indicates whether this provider requires a token for the payment method.
   *
   * For example, providers that do not use tokens (uses redirect).
   */
  requiresToken(): boolean;
}

/**
 * Null validator for providers that do not use tokens.
 *
 * Useful for providers that do not use tokens (redirect flow).
 */
export class NullTokenValidator implements TokenValidator {
  validate(_token: string): void {
    // No-op: this provider does not use tokens
  }

  isValid(_token: string): boolean {
    return true;
  }

  getAcceptedPatterns(): string[] {
    return ['(no token required)'];
  }

  requiresToken(): boolean {
    return false;
  }
}

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
