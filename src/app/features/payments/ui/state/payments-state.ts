import { computed, effect, inject, Injectable } from '@angular/core';
import { PaymentStatePort, PaymentsUiState, Unsubscribe } from '../../application/state/payment-state';
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from '../../domain/models/payment.requests';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentsStore } from '../../application/store/payments.store';

/**
 * @deprecated Usar PaymentsStore directamente.
 * 
 * Este adapter mantiene retrocompatibilidad con el port PaymentStatePort
 * mientras internamente delega al nuevo PaymentsStore de @ngrx/signals.
 * 
 * Para nuevas implementaciones, usar PaymentsStore directamente:
 * ```typescript
 * readonly store = inject(PaymentsStore);
 * ```
 */
@Injectable()
export class PaymentState implements PaymentStatePort {
    private readonly store = inject(PaymentsStore);

    // Computed que mapea el nuevo estado al formato legacy
    readonly state = computed<PaymentsUiState>(() => {
        const status = this.store.status();
        const intent = this.store.intent();
        const error = this.store.error();

        if (status === 'loading') return { status: 'loading' };
        if (status === 'ready' && intent) return { status: 'ready', intent };
        if (status === 'error') return { status: 'error', error };
        return { status: 'idle' };
    });

    readonly isLoading = this.store.isLoading;
    readonly intent = this.store.currentIntent;
    readonly error = this.store.currentError;

    getSnapshot(): Readonly<PaymentsUiState> {
        return this.state();
    }

    subscribe(listener: () => void): Unsubscribe {
        const ref = effect(() => {
            // Trigger en cualquier cambio de estado
            this.state();
            listener();
        });

        return () => ref.destroy();
    }

    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void {
        this.store.startPayment({ request: req, providerId });
    }

    confirm(req: ConfirmPaymentRequest, providerId: PaymentProviderId): void {
        this.store.confirmPayment({ request: req, providerId });
    }

    cancel(req: CancelPaymentRequest, providerId: PaymentProviderId): void {
        this.store.cancelPayment({ request: req, providerId });
    }

    refresh(req: GetPaymentStatusRequest, providerId: PaymentProviderId): void {
        this.store.refreshPayment({ request: req, providerId });
    }

    reset(): void {
        this.store.reset();
    }
}