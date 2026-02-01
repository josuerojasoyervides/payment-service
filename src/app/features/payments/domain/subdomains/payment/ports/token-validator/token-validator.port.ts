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
