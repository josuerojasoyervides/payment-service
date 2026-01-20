import { inject, Injectable } from "@angular/core";
import { PaymentMethodType } from "../../../domain/models";
import { 
    ProviderFactory, 
    PaymentStrategy, 
    PaymentRequestBuilder, 
    FieldRequirements,
    PaymentGateway,
} from "../../../domain/ports";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { PaypalRedirectStrategy } from "../strategies/paypal-redirect.strategy";
import { PaypalRedirectRequestBuilder } from "../builders/paypal-redirect-request.builder";
import { PaypalTokenValidator } from "../validators/paypal-token.validator";
import { I18nService, I18nKeys } from "@core/i18n";

/**
 * PayPal provider factory.
 *
 * Key differences vs Stripe:
 * - PayPal handles cards through its checkout (redirect)
 * - Does not support SPEI (only PayPal payment methods)
 * - All methods use redirect flow
 * - ALWAYS requires returnUrl and cancelUrl
 *
 * Supported methods:
 * - card: Cards via PayPal checkout (with redirect)
 */
@Injectable()
export class PaypalProviderFactory implements ProviderFactory {
    readonly providerId = 'paypal' as const;

    private readonly gateway = inject(PaypalPaymentGateway);
    private readonly i18n = inject(I18nService);

    /**
     * Strategy cache.
     */
    private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

    /**
     * Payment methods supported by PayPal.
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
    // BUILDER METHODS
    // ============================================================

    /**
     * Creates a builder specific to PayPal.
     * 
     * PayPal ALWAYS uses redirect flow, so all methods
     * use the same builder that requires returnUrl.
     */
    createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder {
        this.assertSupported(type);

        return new PaypalRedirectRequestBuilder();
    }

    /**
     * Returns field requirements for PayPal.
     * 
     * PayPal always needs redirect URLs.
     */
    getFieldRequirements(type: PaymentMethodType): FieldRequirements {
        this.assertSupported(type);

        return {
            description: this.i18n.t(I18nKeys.ui.pay_with_paypal),
            instructions: this.i18n.t(I18nKeys.ui.paypal_redirect_secure_message),
            fields: [
                {
                    name: 'returnUrl',
                    label: this.i18n.t(I18nKeys.ui.return_url_label),
                    required: true,
                    type: 'hidden',
                    autoFill: 'currentUrl',
                    placeholder: '',
                },
                {
                    name: 'cancelUrl',
                    label: this.i18n.t(I18nKeys.ui.cancel_url_label),
                    required: false,
                    type: 'hidden',
                    autoFill: 'currentUrl',
                    placeholder: '',
                },
            ],
        };
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
                return new PaypalRedirectStrategy(this.gateway, this.i18n);
            default:
                throw new Error(`Unexpected payment method type: ${type}`);
        }
    }
}