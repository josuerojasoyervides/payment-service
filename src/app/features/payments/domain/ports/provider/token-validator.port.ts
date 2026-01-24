/**
 * Port para validación de tokens de pago.
 *
 * Cada proveedor implementa su propia lógica de validación
 * ya que los formatos de token varían:
 * - Stripe: tok_*, pm_*, card_*
 * - PayPal: No usa tokens (redirect flow)
 * - Conekta: tok_*
 * - MercadoPago: card_token_*
 *
 * Esto permite que las estrategias compartidas (CardStrategy)
 * deleguen la validación específica al proveedor.
 */
export interface TokenValidator {
  /**
   * Valida que el token tenga el formato correcto para este proveedor.
   *
   * @param token Token a validar
   * @throws Error si el token es inválido
   */
  validate(token: string): void;

  /**
   * Verifica si un token tiene formato válido sin lanzar error.
   *
   * @param token Token a verificar
   * @returns true si el token es válido
   */
  isValid(token: string): boolean;

  /**
   * Retorna los patrones de token aceptados (para documentación/debugging).
   *
   * @returns Array de strings describiendo los patrones aceptados
   */
  getAcceptedPatterns(): string[];

  /**
   * Indica si este proveedor requiere token para el método de pago.
   *
   * Por ejemplo, PayPal no requiere token (usa redirect).
   */
  requiresToken(): boolean;
}

/**
 * Validador nulo para proveedores que no usan tokens.
 *
 * Útil para PayPal u otros proveedores con flujo redirect.
 */
export class NullTokenValidator implements TokenValidator {
  validate(_token: string): void {
    // No-op: este proveedor no usa tokens
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
 * Validador base que puede ser extendido por proveedores.
 */
export abstract class BaseTokenValidator implements TokenValidator {
  protected abstract readonly patterns: RegExp[];
  protected abstract readonly patternDescriptions: string[];

  validate(token: string): void {
    if (!this.requiresToken()) {
      return;
    }

    if (!token) {
      // TODO: Fix this magic strings
      throw new Error(`Token is required for this payment method`);
    }

    if (!this.isValid(token)) {
      // TODO: Fix this magic strings
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
   * Enmascara el token para logging seguro.
   */
  protected maskToken(token: string): string {
    if (!token || token.length < 8) {
      // TODO: Fix this magic strings
      return '[invalid]';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}
