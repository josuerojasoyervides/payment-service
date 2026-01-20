import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentIntent, PaymentProviderId } from '../../../domain/models';
import { PaymentIntentCardComponent } from '../../components';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Página de retorno para callbacks de 3DS y PayPal.
 * 
 * Esta página maneja los retornos de:
 * - 3D Secure authentication
 * - PayPal approval/cancel
 * 
 * Lee los query params para determinar el estado y
 * muestra el resultado apropiado.
 */
@Component({
    selector: 'app-return',
    standalone: true,
    imports: [CommonModule, RouterLink, PaymentIntentCardComponent],
    templateUrl: './return.component.html',
})
export class ReturnComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly paymentState = inject(PAYMENT_STATE);
    private readonly i18n = inject(I18nService);

    // Query params
    readonly intentId = signal<string | null>(null);
    readonly paypalToken = signal<string | null>(null);
    readonly paypalPayerId = signal<string | null>(null);
    readonly redirectStatus = signal<string | null>(null);
    readonly allParams = signal<Record<string, string>>({});

    // Route data
    readonly isReturnFlow = signal(false);
    readonly isCancelFlow = signal(false);

    // State
    readonly currentIntent = this.paymentState.intent;
    readonly isLoading = this.paymentState.isLoading;

    // Computed
    readonly isCancel = computed(() => {
        return this.isCancelFlow() || this.redirectStatus() === 'canceled';
    });

    readonly isSuccess = computed(() => {
        const intent = this.currentIntent();
        return intent?.status === 'succeeded' || this.redirectStatus() === 'succeeded';
    });

    readonly flowType = computed(() => {
        if (this.paypalToken()) return 'PayPal Redirect';
        if (this.intentId()) return '3D Secure';
        return 'Desconocido';
    });

    ngOnInit(): void {
        // Leer route data
        const data = this.route.snapshot.data;
        this.isReturnFlow.set(!!data['returnFlow']);
        this.isCancelFlow.set(!!data['cancelFlow']);

        // Leer query params
        const params = this.route.snapshot.queryParams;
        this.allParams.set(params);
        
        // Stripe params
        this.intentId.set(params['payment_intent'] || params['setup_intent'] || null);
        this.redirectStatus.set(params['redirect_status'] || null);
        
        // PayPal params
        this.paypalToken.set(params['token'] || null);
        this.paypalPayerId.set(params['PayerID'] || null);

        // Si tenemos un intent ID, intentar refrescar el estado
        const id = this.intentId() || this.paypalToken();
        if (id && !this.isCancelFlow()) {
            this.refreshPayment(id);
        }
    }

    confirmPayment(intentId: string): void {
        const provider = this.detectProvider();
        this.paymentState.confirmPayment({ intentId }, provider);
    }

    refreshPayment(intentId: string): void {
        const provider = this.detectProvider();
        this.paymentState.refreshPayment({ intentId }, provider);
    }

    private detectProvider(): PaymentProviderId {
        // Si hay token de PayPal, es PayPal
        if (this.paypalToken()) return 'paypal';
        // Por defecto, asumir Stripe
        return 'stripe';
    }

    get newPaymentButtonText(): string {
        return this.i18n.t(I18nKeys.ui.new_payment_button);
    }

    get retryPaymentText(): string {
        return this.i18n.t(I18nKeys.ui.retry_payment);
    }

    get viewHistoryText(): string {
        return this.i18n.t(I18nKeys.ui.view_history);
    }

    get paymentCanceledText(): string {
        return this.i18n.t(I18nKeys.ui.payment_canceled);
    }

    get paymentCanceledMessageText(): string {
        return this.i18n.t(I18nKeys.ui.payment_canceled_message);
    }

    get paymentCompletedText(): string {
        return this.i18n.t(I18nKeys.ui.payment_completed); // Ya existe en línea 95
    }

    get paymentCompletedMessageText(): string {
        return this.i18n.t(I18nKeys.ui.payment_completed_message);
    }

    get verifyingPaymentText(): string {
        return this.i18n.t(I18nKeys.ui.verifying_payment);
    }

    get verifyingPaymentMessageText(): string {
        return this.i18n.t(I18nKeys.ui.verifying_payment_message);
    }

    get returnInformationText(): string {
        return this.i18n.t(I18nKeys.ui.return_information);
    }

    get paymentStatusText(): string {
        return this.i18n.t(I18nKeys.ui.payment_status);
    }

    get viewAllParamsText(): string {
        return this.i18n.t(I18nKeys.ui.view_all_params);
    }

    get flowTypeText(): string {
        return this.i18n.t(I18nKeys.ui.flow_type);
    }

    get statusLabelText(): string {
        return this.i18n.t(I18nKeys.ui.status_label);
    }

    get canceledText(): string {
        return this.i18n.t(I18nKeys.ui.canceled);
    }

    get completedText(): string {
        return this.i18n.t(I18nKeys.ui.completed);
    }

    get processingText(): string {
        return this.i18n.t(I18nKeys.ui.processing);
    }
}
