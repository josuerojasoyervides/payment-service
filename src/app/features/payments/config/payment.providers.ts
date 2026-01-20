import { EnvironmentProviders, Provider } from "@angular/core";
import { PAYMENT_PROVIDER_FACTORIES } from "../application/tokens/payment-provider-factories.token";
import { StripeProviderFactory } from "../infrastructure/stripe/factories/stripe-provider.factory";
import { StripePaymentGateway } from "../infrastructure/stripe/gateways/stripe-payment.gateway";
import { PaypalProviderFactory } from "../infrastructure/paypal/factories/paypal-provider.factory";
import { PaypalPaymentGateway } from "../infrastructure/paypal/gateways/paypal-payment.gateway";
import { FakePaymentGateway } from "../infrastructure/fake/gateway/fake-payment.gateway";
import { PaymentState } from "../ui/state/payments-state";
import { PAYMENTS_STATE } from "../application/tokens/payment-state.token";
import { ProviderFactoryRegistry } from "../application/registry/provider-factory.registry";
import { StartPaymentUseCase } from "../application/use-cases/start-payment.use-case";
import { ConfirmPaymentUseCase } from "../application/use-cases/confirm-payment.use-case";
import { CancelPaymentUseCase } from "../application/use-cases/cancel-payment.use-case";
import { GetPaymentStatusUseCase } from "../application/use-cases/get-payment-status.use-case";
import { FallbackOrchestratorService } from "../application/services/fallback-orchestrator.service";

/**
 * Gateways de cada proveedor.
 *
 * En desarrollo/testing, se pueden reemplazar por fakes.
 */
const GATEWAY_PROVIDERS: Provider[] = [
    // Para desarrollo: usar fake gateway que simula respuestas
    // En producción: quitar esta línea y usar el gateway real
    { provide: StripePaymentGateway, useClass: FakePaymentGateway },
    { provide: PaypalPaymentGateway, useClass: FakePaymentGateway },

    // Gateways reales (comentados para desarrollo)
    // StripePaymentGateway,
    // PaypalPaymentGateway,
];

/**
 * Factories de proveedores (usando multi-token).
 *
 * Cada factory se registra con multi: true para permitir
 * agregar nuevos proveedores sin modificar configuración existente.
 */
const FACTORY_PROVIDERS: Provider[] = [
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

/**
 * Use cases de la capa de aplicación.
 *
 * No usan providedIn: 'root' para permitir testing
 * y dar control explícito del lifecycle.
 */
const USE_CASE_PROVIDERS: Provider[] = [
    StartPaymentUseCase,
    ConfirmPaymentUseCase,
    CancelPaymentUseCase,
    GetPaymentStatusUseCase,
];

/**
 * Servicios de infraestructura de la aplicación.
 */
const APPLICATION_PROVIDERS: Provider[] = [
    ProviderFactoryRegistry,
    { provide: PAYMENTS_STATE, useClass: PaymentState },
    FallbackOrchestratorService,
];

/**
 * Función para proveer toda la infraestructura de pagos.
 *
 * Uso:
 * ```typescript
 * // En app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePayments(),
 *     // otros providers...
 *   ]
 * };
 * ```
 */
export default function providePayments(): (Provider | EnvironmentProviders)[] {
    return [
        ...GATEWAY_PROVIDERS,
        ...FACTORY_PROVIDERS,
        ...USE_CASE_PROVIDERS,
        ...APPLICATION_PROVIDERS,
    ];
}

/**
 * Función para proveer pagos con configuración personalizada.
 *
 * @param options Opciones de configuración
 */
export function providePaymentsWithConfig(options: {
    /** Usar gateways reales en lugar de fakes */
    useRealGateways?: boolean;
    /** Providers adicionales */
    extraProviders?: Provider[];
}): (Provider | EnvironmentProviders)[] {
    const providers: Provider[] = [];

    // Gateways
    if (options.useRealGateways) {
        providers.push(StripePaymentGateway, PaypalPaymentGateway);
    } else {
        providers.push(...GATEWAY_PROVIDERS);
    }

    // Core providers
    providers.push(
        ...FACTORY_PROVIDERS,
        ...USE_CASE_PROVIDERS,
        ...APPLICATION_PROVIDERS,
    );

    // Extra providers
    if (options.extraProviders) {
        providers.push(...options.extraProviders);
    }

    return providers;
}