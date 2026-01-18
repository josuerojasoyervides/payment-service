import { inject, Injectable } from "@angular/core";
import { PaymentMethodType } from "../../../domain/models/payment.types";
import { ProviderFactory } from "../../../domain/ports/provider-factory.port";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { PaypalRedirectStrategy } from "../strategies/paypal-redirect.strategy";
import { PaymentStrategy } from "../../../domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";

/**
 * Factory de PayPal.
 *
 * Diferencias clave vs Stripe:
 * - PayPal maneja tarjetas a través de su checkout (redirect)
 * - No soporta SPEI (solo métodos de pago de PayPal)
 * - Todos los métodos usan flujo de redirección
 *
 * Métodos soportados:
 * - card: Tarjetas vía PayPal checkout (con redirección)
 *
 * Nota: PayPal también soporta PayPal balance, PayPal Credit,
 * Venmo, etc., pero todos usan el mismo flujo de redirección.
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
     *
     * Nota: PayPal maneja tarjetas a través de su checkout,
     * no directamente como Stripe.
     */
    static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card'];

    getGateway(): PaymentGateway {
        return this.gateway;
    }

    /**
     * Crea o retorna una estrategia cacheada.
     *
     * PayPal usa PaypalRedirectStrategy para todo,
     * ya que su flujo siempre involucra redirección.
     */
    createStrategy(type: PaymentMethodType): PaymentStrategy {
        if (!PaypalProviderFactory.SUPPORTED_METHODS.includes(type)) {
            throw new Error(
                `Payment method "${type}" is not supported by PayPal. ` +
                `PayPal processes cards through its checkout flow. ` +
                `Supported methods: ${PaypalProviderFactory.SUPPORTED_METHODS.join(', ')}`
            );
        }

        const cached = this.strategyCache.get(type);
        if (cached) {
            return cached;
        }

        const strategy = this.instantiateStrategy(type);
        this.strategyCache.set(type, strategy);

        return strategy;
    }

    /**
     * Verifica si un método de pago está soportado.
     */
    supportsMethod(type: PaymentMethodType): boolean {
        return PaypalProviderFactory.SUPPORTED_METHODS.includes(type);
    }

    /**
     * Retorna los métodos soportados.
     */
    getSupportedMethods(): PaymentMethodType[] {
        return [...PaypalProviderFactory.SUPPORTED_METHODS];
    }

    /**
     * Instancia la estrategia correspondiente.
     *
     * Las estrategias reciben el gateway como dependencia manual.
     */
    private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card':
                // PayPal procesa tarjetas a través de su checkout
                return new PaypalRedirectStrategy(this.gateway);
            default:
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}