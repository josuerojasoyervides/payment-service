import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port';

/**
 * Null validator for providers that do not use tokens.
 *
 * Useful for providers that do not use tokens (redirect flow).
 */
export class NoopTokenValidator implements TokenValidator {
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
