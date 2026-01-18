import { inject, Injectable } from '@angular/core';
import { ProviderFactory } from '../../../domain/ports/provider-factory.port';
import { PaymentMethodType } from '../../../domain/models/payment.types';
import { PaymentStrategy } from '../../../domain/ports/payment-strategy.port';
import { StripePaymentGateway } from '../gateways/stripe-payment.gateway';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
import { PaymentGateway } from '../../../domain/ports/payment-gateway.port';

/**
 * Factory de Stripe.
 *
 * Responsabilidades:
 * - Proveer el gateway de Stripe
 * - Crear estrategias específicas para Stripe
 * - Cachear estrategias para reutilización
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
     *
     * Las estrategias son stateless, así que podemos reutilizarlas.
     * Esto mejora el rendimiento.
     */
    private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

    /**
     * Métodos de pago soportados por Stripe en esta implementación.
     */
    static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card', 'spei'];

    getGateway(): PaymentGateway {
        return this.gateway;
    }

    /**
     * Crea o retorna una estrategia cacheada para el tipo de pago.
     */
    createStrategy(type: PaymentMethodType): PaymentStrategy {
        // Verificar si está soportado
        if (!StripeProviderFactory.SUPPORTED_METHODS.includes(type)) {
            throw new Error(
                `Payment method "${type}" is not supported by Stripe. ` +
                `Supported methods: ${StripeProviderFactory.SUPPORTED_METHODS.join(', ')}`
            );
        }

        // Retornar del cache si existe
        const cached = this.strategyCache.get(type);
        if (cached) {
            return cached;
        }

        // Crear nueva estrategia
        const strategy = this.instantiateStrategy(type);
        this.strategyCache.set(type, strategy);

        return strategy;
    }

    /**
     * Verifica si un método de pago está soportado.
     */
    supportsMethod(type: PaymentMethodType): boolean {
        return StripeProviderFactory.SUPPORTED_METHODS.includes(type);
    }

    /**
     * Retorna los métodos soportados.
     */
    getSupportedMethods(): PaymentMethodType[] {
        return [...StripeProviderFactory.SUPPORTED_METHODS];
    }

    /**
     * Instancia la estrategia correspondiente.
     *
     * Las estrategias reciben el gateway como dependencia manual.
     * Esto es intencional: las estrategias son objetos simples
     * que no necesitan el DI de Angular.
     */
    private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card':
                return new CardStrategy(this.gateway);
            case 'spei':
                return new SpeiStrategy(this.gateway);
            default:
                // TypeScript debería prevenir llegar aquí
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}
