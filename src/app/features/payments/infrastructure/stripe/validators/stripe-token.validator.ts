import { BaseTokenValidator } from '../../../domain/ports';

/**
 * Validador de tokens para Stripe.
 * 
 * Stripe usa varios formatos de token según el origen:
 * - tok_* : Token de Stripe.js/Elements (tokenización client-side)
 * - pm_*  : PaymentMethod ID (método guardado o creado)
 * - card_*: Card ID legacy (deprecated pero aún soportado)
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
        /^tok_[a-zA-Z0-9]{14,}$/,   // Token de Stripe.js
        /^pm_[a-zA-Z0-9]{14,}$/,    // PaymentMethod ID
        /^card_[a-zA-Z0-9]{14,}$/,  // Card ID legacy
    ];

    protected readonly patternDescriptions = [
        'tok_* (Stripe.js token)',
        'pm_* (PaymentMethod ID)',
        'card_* (Card ID)',
    ];

    /**
     * Detecta si el token es de una tarjeta guardada (PaymentMethod).
     * 
     * Esto es útil para determinar si se necesita SCA (Strong Customer Authentication).
     */
    isSavedCard(token: string): boolean {
        return /^pm_[a-zA-Z0-9]+$/.test(token);
    }

    /**
     * Detecta si el token es de Stripe.js (recién tokenizado).
     */
    isStripeJsToken(token: string): boolean {
        return /^tok_[a-zA-Z0-9]+$/.test(token);
    }

    /**
     * Obtiene el tipo de token.
     */
    getTokenType(token: string): 'stripe_js' | 'payment_method' | 'card' | 'unknown' {
        if (/^tok_/.test(token)) return 'stripe_js';
        if (/^pm_/.test(token)) return 'payment_method';
        if (/^card_/.test(token)) return 'card';
        return 'unknown';
    }
}
