import { CurrencyCode, CreatePaymentRequest } from '../../../domain/models';
import { PaymentRequestBuilder, PaymentOptions, FieldRequirements } from '../../../domain/ports';

/**
 * Builder específico para pagos vía PayPal (redirect flow).
 * 
 * PayPal SIEMPRE usa flujo de redirección, incluso para tarjetas.
 * El usuario es redirigido a PayPal para autorizar el pago.
 * 
 * Este builder SABE que PayPal necesita:
 * - returnUrl (REQUERIDO) - URL a donde redirigir después del pago
 * - cancelUrl (OPCIONAL) - URL si el usuario cancela (default: returnUrl)
 * 
 * NO necesita:
 * - token (PayPal maneja esto internamente)
 * - customerEmail (PayPal lo obtiene del usuario)
 */
export class PaypalRedirectRequestBuilder implements PaymentRequestBuilder {
    private orderId?: string;
    private amount?: number;
    private currency?: CurrencyCode;
    private returnUrl?: string;
    private cancelUrl?: string;

    /**
     * Requisitos de campos para PayPal.
     */
    static readonly FIELD_REQUIREMENTS: FieldRequirements = {
        description: 'Pagar con PayPal',
        instructions: 'Serás redirigido a PayPal para completar el pago de forma segura',
        fields: [
            {
                name: 'returnUrl',
                label: 'URL de retorno',
                required: true,
                type: 'hidden',      // La UI lo provee automáticamente
                autoFill: 'currentUrl',  // Usar la URL actual
                placeholder: '',
            },
            {
                name: 'cancelUrl',
                label: 'URL de cancelación',
                required: false,
                type: 'hidden',
                autoFill: 'currentUrl',
                placeholder: '',
            },
        ],
    };

    forOrder(orderId: string): this {
        this.orderId = orderId;
        return this;
    }

    withAmount(amount: number, currency: CurrencyCode): this {
        this.amount = amount;
        this.currency = currency;
        return this;
    }

    withOptions(options: PaymentOptions): this {
        // PayPal necesita URLs de redirect
        if (options.returnUrl !== undefined) {
            this.returnUrl = options.returnUrl;
        }
        if (options.cancelUrl !== undefined) {
            this.cancelUrl = options.cancelUrl;
        }
        // Ignora token, customerEmail - PayPal no los usa desde la app
        return this;
    }

    build(): CreatePaymentRequest {
        this.validate();

        return {
            orderId: this.orderId!,
            amount: this.amount!,
            currency: this.currency!,
            method: {
                type: 'card',  // PayPal procesa cards vía su checkout
            },
            returnUrl: this.returnUrl,
            cancelUrl: this.cancelUrl ?? this.returnUrl,  // Default a returnUrl
        };
    }

    private validate(): void {
        if (!this.orderId) {
            throw new Error('orderId is required');
        }
        if (!this.amount || this.amount <= 0) {
            throw new Error('amount must be greater than 0');
        }
        if (!this.currency) {
            throw new Error('currency is required');
        }
        // VALIDACIÓN ESPECÍFICA DE PAYPAL
        if (!this.returnUrl) {
            throw new Error(
                'PayPal payments require returnUrl. ' +
                'This is where the user will be redirected after completing payment.'
            );
        }
        // Validar que sea URL válida
        try {
            new URL(this.returnUrl);
        } catch {
            throw new Error('returnUrl must be a valid URL');
        }
        // Validar cancelUrl si se proporciona
        if (this.cancelUrl) {
            try {
                new URL(this.cancelUrl);
            } catch {
                throw new Error('cancelUrl must be a valid URL');
            }
        }
    }
}
