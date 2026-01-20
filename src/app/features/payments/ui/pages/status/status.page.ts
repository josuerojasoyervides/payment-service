import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentProviderId, PaymentIntent } from '../../../domain/models';
import { PaymentIntentCardComponent, NextActionCardComponent } from '../../components';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Page to query payment status by ID.
 * 
 * Allows entering an Intent ID (from Stripe or PayPal) and
 * querying its current status, with options to confirm,
 * cancel or refresh.
 */
@Component({
    selector: 'app-status',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PaymentIntentCardComponent, NextActionCardComponent],
    templateUrl: './status.component.html',
})
export class StatusComponent {
    private readonly paymentState = inject(PAYMENT_STATE);
    private readonly i18n = inject(I18nService);

    intentId = '';
    readonly selectedProvider = signal<PaymentProviderId>('stripe');
    readonly result = signal<PaymentIntent | null>(null);
    readonly error = this.paymentState.error;
    readonly isLoading = this.paymentState.isLoading;

    readonly examples = [
        { id: 'pi_fake_abc123', label: this.i18n.t(I18nKeys.ui.stripe_intent), provider: 'stripe' as const },
        { id: 'ORDER_FAKE_XYZ789', label: this.i18n.t(I18nKeys.ui.paypal_order), provider: 'paypal' as const },
    ];

    constructor() {
        effect(() => {
            const intent = this.paymentState.intent();
            if (intent) {
                this.result.set(intent);
            }
        });
    }

    searchIntent(): void {
        if (!this.intentId.trim()) return;

        this.result.set(null);

        this.paymentState.refreshPayment(
            { intentId: this.intentId.trim() },
            this.selectedProvider()
        );
    }

    confirmPayment(intentId: string): void {
        this.paymentState.confirmPayment({ intentId }, this.selectedProvider());
    }

    cancelPayment(intentId: string): void {
        this.paymentState.cancelPayment({ intentId }, this.selectedProvider());
    }

    refreshPayment(intentId: string): void {
        this.paymentState.refreshPayment({ intentId }, this.selectedProvider());
    }

    useExample(example: { id: string; provider: PaymentProviderId }): void {
        this.intentId = example.id;
        this.selectedProvider.set(example.provider);
    }

    getErrorMessage(error: unknown): string {
        if (typeof error === 'object' && error !== null && 'message' in error) {
            return (error as { message: string }).message;
        }
        return this.i18n.t(I18nKeys.ui.unknown_error);
    }

    get consultStatusTitle(): string {
        return this.i18n.t(I18nKeys.ui.consult_status);
    }

    get enterPaymentIdText(): string {
        return this.i18n.t(I18nKeys.ui.enter_payment_id);
    }

    get intentIdLabel(): string {
        return this.i18n.t(I18nKeys.ui.intent_id);
    }

    get intentIdPlaceholder(): string {
        return this.i18n.t(I18nKeys.ui.intent_id_placeholder);
    }

    get exampleStripeText(): string {
        return this.i18n.t(I18nKeys.ui.example_stripe);
    }

    get providerLabel(): string {
        return this.i18n.t(I18nKeys.ui.provider);
    }

    get stripeProviderLabel(): string {
        return this.i18n.t(I18nKeys.ui.provider_stripe);
    }

    get paypalProviderLabel(): string {
        return this.i18n.t(I18nKeys.ui.provider_paypal);
    }

    get consultingLabel(): string {
        return this.i18n.t(I18nKeys.ui.consulting);
    }

    get checkStatusLabel(): string {
        return this.i18n.t(I18nKeys.ui.check_status);
    }

    get errorConsultingLabel(): string {
        return this.i18n.t(I18nKeys.ui.error_consulting);
    }

    get resultLabel(): string {
        return this.i18n.t(I18nKeys.ui.result);
    }

    get quickExamplesLabel(): string {
        return this.i18n.t(I18nKeys.ui.quick_examples);
    }

    get checkoutLabel(): string {
        return this.i18n.t(I18nKeys.ui.checkout);
    }

    get historyLabel(): string {
        return this.i18n.t(I18nKeys.ui.view_history);
    }
}
