import { inject, Injectable } from '@angular/core';
import { ProviderFactory } from '../../../domain/ports/provider-factory.port';
import { PaymentMethodType } from '../../../domain/models/payment.types';
import { PaymentStrategy } from '../../../domain/ports/payment-strategy.port';
import { PaymentRequestBuilder, FieldRequirements } from '../../../domain/ports/payment-request-builder.port';
import { StripePaymentGateway } from '../gateways/stripe-payment.gateway';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
import { PaymentGateway } from '../../../domain/ports/payment-gateway.port';
import { StripeCardRequestBuilder } from '../builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '../builders/stripe-spei-request.builder';

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
                return StripeCardRequestBuilder.FIELD_REQUIREMENTS;
            case 'spei':
                return StripeSpeiRequestBuilder.FIELD_REQUIREMENTS;
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
                return new CardStrategy(this.gateway);
            case 'spei':
                return new SpeiStrategy(this.gateway);
            default:
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}
