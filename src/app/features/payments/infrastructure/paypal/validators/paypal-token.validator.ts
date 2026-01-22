import { NullTokenValidator } from '@payments/domain/ports/provider/token-validator.port';

/**
 * Validador de tokens para PayPal.
 *
 * PayPal NO usa tokens de la misma forma que Stripe.
 * En lugar de tokenizar tarjetas client-side, PayPal usa un flujo de redirección:
 *
 * 1. Se crea una Order en PayPal
 * 2. El usuario es redirigido a PayPal para aprobar
 * 3. PayPal redirige de vuelta con un token de aprobación
 * 4. Se captura el pago usando el Order ID
 *
 * Por lo tanto, este validador es un "no-op" que siempre pasa.
 * Las validaciones de PayPal ocurren en la estrategia (URLs de retorno, etc).
 *
 * @example
 * ```typescript
 * const validator = new PaypalTokenValidator();
 * validator.requiresToken();     // false
 * validator.validate('anything'); // No hace nada
 * validator.isValid('anything');  // true
 * ```
 */
export class PaypalTokenValidator extends NullTokenValidator {
  /**
   * Override para dar mensaje más específico.
   */
  override getAcceptedPatterns(): string[] {
    return ['(PayPal uses redirect flow, no client-side token required)'];
  }
}
