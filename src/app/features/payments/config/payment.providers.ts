import { EnvironmentProviders, Provider } from "@angular/core";
import { PAYMENT_PROVIDER_FACTORIES } from "../application/tokens/payment-provider-factories.token";
import { StripeProviderFactory } from "../infrastructure/stripe/factories/stripe-provider.factory";
import { StripePaymentGateway } from "../infrastructure/stripe/gateways/stripe-payment.gateway";
import { PaypalProviderFactory } from "../infrastructure/paypal/factories/paypal-provider.factory";
import { PaypalPaymentGateway } from "../infrastructure/paypal/gateways/paypal-payment.gateway";
import { FakePaymentGateway } from "../infrastructure/fake/gateways/fake-payment.gateway";
import { PAYMENT_STATE } from "../application/tokens/payment-state.token";
import { NgRxSignalsStateAdapter } from "../application/adapters/ngrx-signals-state.adapter";
import { ProviderFactoryRegistry } from "../application/registry/provider-factory.registry";
import { StartPaymentUseCase } from "../application/use-cases/start-payment.use-case";
import { ConfirmPaymentUseCase } from "../application/use-cases/confirm-payment.use-case";
import { CancelPaymentUseCase } from "../application/use-cases/cancel-payment.use-case";
import { GetPaymentStatusUseCase } from "../application/use-cases/get-payment-status.use-case";
import { FallbackOrchestratorService } from "../application/services/fallback-orchestrator.service";
import { PaymentsStore } from "../application/store/payment.store";
import { IdempotencyKeyFactory } from "../shared/idempotency/idempotency-key.factory";

/**
 * Gateways for each provider.
 *
 * In development/testing, can be replaced with fakes.
 */
const GATEWAY_PROVIDERS: Provider[] = [
    // For development: use fake gateway that simulates responses
    // In production: remove this line and use real gateway

    /**
     * ! TODO: ✅ El contrato real no debería ser “StripePaymentGateway”, debería ser “PaymentGateway”.
     * ! UI/Application no deberían inyectar gateways por clase concreta nunca.
     * ! Solo la infra debería decidir la implementación concreta.
     * ! las clases concretas de gateways no deberían importarse en config si quieres reemplazabilidad total.
     */
    {
        provide: StripePaymentGateway,
        useFactory: () => FakePaymentGateway.create('stripe')
    },
    {
        provide: PaypalPaymentGateway,
        useFactory: () => FakePaymentGateway.create('paypal')
    },

    // Real gateways (commented for development)
    // StripePaymentGateway,
    // PaypalPaymentGateway,
];

/**
 * Provider factories (using multi-token).
 *
 * Each factory is registered with multi: true to allow
 * adding new providers without modifying existing configuration.
 */
const FACTORY_PROVIDERS: Provider[] = [
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

/**
 * Application layer use cases.
 *
 * Do not use providedIn: 'root' to allow testing
 * and give explicit control of lifecycle.
 */
const USE_CASE_PROVIDERS: Provider[] = [
    StartPaymentUseCase,
    ConfirmPaymentUseCase,
    CancelPaymentUseCase,
    GetPaymentStatusUseCase,
];

/**
 * Application infrastructure services.
 * 
 * IMPORTANT: State is injected via PAYMENT_STATE token.
 * This allows changing the implementation (NgRx Signals, Akita, etc.)
 * without modifying components that consume the state.
 */
const APPLICATION_PROVIDERS: Provider[] = [
    ProviderFactoryRegistry,
    FallbackOrchestratorService,
    PaymentsStore,
    // Adapter that implements PaymentStatePort using NgRx Signals
    // If you decide to change state manager, only change this provider
    { provide: PAYMENT_STATE, useClass: NgRxSignalsStateAdapter },
];

/**
 * Shared services (utilities used across layers).
 */
const SHARED_PROVIDERS: Provider[] = [
    IdempotencyKeyFactory,
];

/**
 * Function to provide all payment infrastructure.
 *
 * Usage:
 * ```typescript
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     providePayments(),
 *     // other providers...
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
        ...SHARED_PROVIDERS,
    ];
}

/**
 * Function to provide payments with custom configuration.
 *
 * @param options Configuration options
 */
export function providePaymentsWithConfig(options: {
    /** Use real gateways instead of fakes */
    useRealGateways?: boolean;
    /** Additional providers */
    extraProviders?: Provider[];
}): (Provider | EnvironmentProviders)[] {
    const providers: Provider[] = [];

    if (options.useRealGateways) {
        providers.push(StripePaymentGateway, PaypalPaymentGateway);
    } else {
        providers.push(...GATEWAY_PROVIDERS);
    }

    providers.push(
        ...FACTORY_PROVIDERS,
        ...USE_CASE_PROVIDERS,
        ...APPLICATION_PROVIDERS,
        ...SHARED_PROVIDERS,
    );

    if (options.extraProviders) {
        providers.push(...options.extraProviders);
    }

    return providers;
}
