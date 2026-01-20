import { inject, Injectable } from '@angular/core';
import { 
    ProviderFactory, 
    PaymentStrategy, 
    PaymentRequestBuilder, 
    FieldRequirements,
    PaymentGateway,
} from '../../../domain/ports';
import { PaymentMethodType } from '../../../domain/models';
import { StripePaymentGateway } from '../gateways/stripe-payment.gateway';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
import { StripeCardRequestBuilder } from '../builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '../builders/stripe-spei-request.builder';
import { StripeTokenValidator } from '../validators/stripe-token.validator';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Factory de Stripe.
 *
 * Responsabilidades:
 * - Proveer el gateway de Stripe
 * - Crear estrategias específicas para Stripe
 * - Proveer builders específicos para cada método de pago
 * - Exponer requisitos de campos para la UI
 *
 * Métodos soportados por Stripe:
 * - card: Tarjetas de crédito/débito con soporte 3DS
 * - spei: Transferencias SPEI (México)
 */
@Injectable()
export class StripeProviderFactory implements ProviderFactory {
    readonly providerId = 'stripe' as const;

    private readonly gateway = inject(StripePaymentGateway);
    private readonly i18n = inject(I18nService);

    /**
     * Cache de estrategias para evitar recrearlas.
     */
    private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

    /**
     * Métodos de pago soportados por Stripe.
     */
    static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card', 'spei'];

    getGateway(): PaymentGateway {
        return this.gateway;
    }

    /**
     * Crea o retorna una estrategia cacheada para el tipo de pago.
     */
    createStrategy(type: PaymentMethodType): PaymentStrategy {
        this.assertSupported(type);

        const cached = this.strategyCache.get(type);
        if (cached) {
            return cached;
        }

        const strategy = this.instantiateStrategy(type);
        this.strategyCache.set(type, strategy);

        return strategy;
    }

    supportsMethod(type: PaymentMethodType): boolean {
        return StripeProviderFactory.SUPPORTED_METHODS.includes(type);
    }

    getSupportedMethods(): PaymentMethodType[] {
        return [...StripeProviderFactory.SUPPORTED_METHODS];
    }

    // ============================================================
    // NUEVOS MÉTODOS PARA BUILDERS
    // ============================================================

    /**
     * Crea un builder específico para el método de pago.
     * 
     * La UI usa esto para construir el request con los campos correctos.
     * Cada builder sabe qué campos necesita y valida al hacer build().
     */
    createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder {
        this.assertSupported(type);

        switch (type) {
            case 'card':
                return new StripeCardRequestBuilder();
            case 'spei':
                return new StripeSpeiRequestBuilder();
            default:
                throw new Error(`No builder for payment method: ${type}`);
        }
    }

    /**
     * Retorna los requisitos de campos para un método de pago.
     * 
     * La UI usa esto para renderizar el formulario correcto.
     */
    getFieldRequirements(type: PaymentMethodType): FieldRequirements {
        this.assertSupported(type);

        switch (type) {
            case 'card':
                return {
                    description: this.i18n.t(I18nKeys.ui.card_payment_description),
                    instructions: this.i18n.t(I18nKeys.ui.enter_card_data),
                    fields: [
                        {
                            name: 'token',
                            label: this.i18n.t(I18nKeys.ui.card_token),
                            required: true,
                            type: 'hidden',
                            placeholder: '',
                        },
                        {
                            name: 'saveForFuture',
                            label: this.i18n.t(I18nKeys.ui.save_card_future),
                            required: false,
                            type: 'text',
                            defaultValue: 'false',
                        },
                    ],
                };
            case 'spei':
                return {
                    description: this.i18n.t(I18nKeys.ui.spei_bank_transfer),
                    instructions: this.i18n.t(I18nKeys.ui.spei_email_instructions),
                    fields: [
                        {
                            name: 'customerEmail',
                            label: this.i18n.t(I18nKeys.ui.email_label),
                            required: true,
                            type: 'email',
                            placeholder: 'tu@email.com',
                        },
                    ],
                };
            default:
                return { fields: [] };
        }
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    private assertSupported(type: PaymentMethodType): void {
        if (!this.supportsMethod(type)) {
            throw new Error(
                `Payment method "${type}" is not supported by Stripe. ` +
                `Supported methods: ${StripeProviderFactory.SUPPORTED_METHODS.join(', ')}`
            );
        }
    }

    private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card':
                // Inyectar el validador de tokens de Stripe
                return new CardStrategy(this.gateway, new StripeTokenValidator(), this.i18n);
            case 'spei':
                return new SpeiStrategy(this.gateway, this.i18n);
            default:
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}
