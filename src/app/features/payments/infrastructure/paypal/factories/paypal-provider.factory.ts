import { inject, Injectable } from "@angular/core";
import { PaymentMethodType } from "../../../domain/models/payment.types";
import { ProviderFactory } from "../../../domain/ports/provider-factory.port";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { PaypalRedirectStrategy } from "../strategies/paypal-redirect.strategy";
import { PaymentStrategy } from "../../../domain/ports/payment-strategy.port";
import { PaymentRequestBuilder, FieldRequirements } from "../../../domain/ports/payment-request-builder.port";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";
import { PaypalRedirectRequestBuilder } from "../builders/paypal-redirect-request.builder";
import { PaypalTokenValidator } from "../validators/paypal-token.validator";

/**
 * Factory de PayPal.
 *
 * Diferencias clave vs Stripe:
 * - PayPal maneja tarjetas a través de su checkout (redirect)
 * - No soporta SPEI (solo métodos de pago de PayPal)
 * - Todos los métodos usan flujo de redirección
 * - SIEMPRE requiere returnUrl y cancelUrl
 *
 * Métodos soportados:
 * - card: Tarjetas vía PayPal checkout (con redirección)
 */
@Injectable()
export class PaypalProviderFactory implements ProviderFactory {
    readonly providerId = 'paypal' as const;

    private readonly gateway = inject(PaypalPaymentGateway);

    /**
     * Cache de estrategias.
     */
    private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

    /**
     * Métodos de pago soportados por PayPal.
     */
    static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card'];

    getGateway(): PaymentGateway {
        return this.gateway;
    }

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
        return PaypalProviderFactory.SUPPORTED_METHODS.includes(type);
    }

    getSupportedMethods(): PaymentMethodType[] {
        return [...PaypalProviderFactory.SUPPORTED_METHODS];
    }

    // ============================================================
    // NUEVOS MÉTODOS PARA BUILDERS
    // ============================================================

    /**
     * Crea un builder específico para PayPal.
     * 
     * PayPal SIEMPRE usa redirect flow, así que todos los métodos
     * usan el mismo builder que requiere returnUrl.
     */
    createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder {
        this.assertSupported(type);

        // PayPal usa el mismo builder para todo (redirect flow)
        return new PaypalRedirectRequestBuilder();
    }

    /**
     * Retorna los requisitos de campos para PayPal.
     * 
     * PayPal siempre necesita URLs de redirect.
     */
    getFieldRequirements(type: PaymentMethodType): FieldRequirements {
        this.assertSupported(type);

        // PayPal usa los mismos requisitos para todos los métodos
        return PaypalRedirectRequestBuilder.FIELD_REQUIREMENTS;
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================

    private assertSupported(type: PaymentMethodType): void {
        if (!this.supportsMethod(type)) {
            throw new Error(
                `Payment method "${type}" is not supported by PayPal. ` +
                `PayPal processes cards through its checkout flow. ` +
                `Supported methods: ${PaypalProviderFactory.SUPPORTED_METHODS.join(', ')}`
            );
        }
    }

    private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card':
                return new PaypalRedirectStrategy(this.gateway);
            default:
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}