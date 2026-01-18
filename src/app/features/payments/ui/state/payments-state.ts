import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { PaymentStatePort, PaymentsUiState, Unsubscribe } from '../../application/state/payment-state';
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { StartPaymentUseCase } from '../../application/use-cases/start-payment.use-case';
import { ConfirmPaymentUseCase } from '../../application/use-cases/confirm-payment.use-case';
import { CancelPaymentUseCase } from '../../application/use-cases/cancel-payment.use-case';
import { GetPaymentStatusUseCase } from '../../application/use-cases/get-payment-status.use-case';
import { Subscription } from 'rxjs';

/**
 * Implementación del estado de pagos para la UI.
 *
 * Coordina los use cases y mantiene el estado reactivo usando signals.
 * Implementa el patrón "Adapter" del port PaymentStatePort.
 */
@Injectable()
export class PaymentState implements PaymentStatePort {
    private readonly startPayment = inject(StartPaymentUseCase);
    private readonly confirmPayment = inject(ConfirmPaymentUseCase);
    private readonly cancelPayment = inject(CancelPaymentUseCase);
    private readonly getStatus = inject(GetPaymentStatusUseCase);

    private readonly _state = signal<PaymentsUiState>({ status: "idle" });

    private inflight?: Subscription;

    readonly state = this._state.asReadonly();
    readonly isLoading = computed(() => this.state().status === "loading");
    readonly intent = computed(() => {
        const s = this.state();
        return s.status === "ready" ? s.intent : null;
    });
    readonly error = computed(() => {
        const s = this.state();
        return s.status === "error" ? s.error : null;
    });


    getSnapshot(): Readonly<PaymentsUiState> {
        return this._state();
    }
    subscribe(listener: () => void): Unsubscribe {
        const ref = effect(() => {
            this._state();
            listener();
        });

        return () => ref.destroy();
    }


    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void {
        this.runExclusive(() => this.startPayment.execute(req, providerId));
    }
    confirm(req: ConfirmPaymentRequest, providerId: PaymentProviderId): void {
        this.runExclusive(() => this.confirmPayment.execute(req, providerId));
    }
    cancel(req: CancelPaymentRequest, providerId: PaymentProviderId): void {
        this.runExclusive(() => this.cancelPayment.execute(req, providerId));
    }
    refresh(req: GetPaymentStatusRequest, providerId: PaymentProviderId): void {
        this.runExclusive(() => this.getStatus.execute(req, providerId));
    }
    reset(): void {
        this.cancelInflight();
        this._state.set({ status: "idle" });
    }

    private runExclusive(work$: () => import("rxjs").Observable<PaymentIntent>) {
        this.cancelInflight();
        this._state.set({ status: "loading" });

        this.inflight = work$().subscribe({
            next: (intent) => this._state.set({ status: "ready", intent }),
            error: (error) => this._state.set({ status: "error", error }),
        });
    }

    private cancelInflight() {
        if (!this.inflight) return;

        this.inflight.unsubscribe();
        this.inflight = undefined;
    }
}