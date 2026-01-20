import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentIntent, PaymentProviderId } from '../../../domain/models';
import { PaymentIntentCardComponent } from '../../components';

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
}
