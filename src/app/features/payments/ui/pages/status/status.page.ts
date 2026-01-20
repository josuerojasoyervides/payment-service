import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentProviderId, PaymentIntent } from '../../../domain/models';
import { PaymentIntentCardComponent, NextActionCardComponent } from '../../components';
import { I18nService } from '@core/i18n';

/**
 * Página para consultar el estado de un pago por su ID.
 * 
 * Permite ingresar un Intent ID (de Stripe o PayPal) y
 * consultar su estado actual, con opciones para confirmar,
 * cancelar o refrescar.
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
        { id: 'pi_fake_abc123', label: this.i18n.t('ui.stripe_intent'), provider: 'stripe' as const },
        { id: 'ORDER_FAKE_XYZ789', label: this.i18n.t('ui.paypal_order'), provider: 'paypal' as const },
    ];

    constructor() {
        // Usar effect() dentro del constructor (contexto de inyección)
        // para escuchar cambios en el intent del state
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

        // Hacer la consulta
        // El effect en el constructor ya está escuchando cambios
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
        return this.i18n.t('ui.unknown_error');
    }

    // ===== Textos para el template =====
    get consultStatusTitle(): string {
        return this.i18n.t('ui.consult_status');
    }

    get enterPaymentIdText(): string {
        return this.i18n.t('ui.enter_payment_id');
    }

    get intentIdLabel(): string {
        return this.i18n.t('ui.intent_id');
    }

    get intentIdPlaceholder(): string {
        return this.i18n.t('ui.intent_id_placeholder');
    }

    get exampleStripeText(): string {
        return this.i18n.t('ui.example_stripe');
    }

    get providerLabel(): string {
        return this.i18n.t('ui.provider');
    }

    get stripeProviderLabel(): string {
        return this.i18n.t('ui.provider_stripe');
    }

    get paypalProviderLabel(): string {
        return this.i18n.t('ui.provider_paypal');
    }

    get consultingLabel(): string {
        return this.i18n.t('ui.consulting');
    }

    get checkStatusLabel(): string {
        return this.i18n.t('ui.check_status');
    }

    get errorConsultingLabel(): string {
        return this.i18n.t('ui.error_consulting');
    }

    get resultLabel(): string {
        return this.i18n.t('ui.result');
    }

    get quickExamplesLabel(): string {
        return this.i18n.t('ui.quick_examples');
    }

    get checkoutLabel(): string {
        return this.i18n.t('ui.checkout');
    }

    get historyLabel(): string {
        return this.i18n.t('ui.view_history');
    }
}
