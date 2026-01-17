import { computed, inject, Injectable, signal } from "@angular/core";
import { PaymentIntent, PaymentProviderId } from "../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../domain/models/payment.requests";
import { StartPaymentUseCase } from "../../application/use-cases/start-payment.use-case";

type PaymentsUiState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; intent: PaymentIntent }
    | { status: 'error'; error: unknown };

@Injectable({ providedIn: 'root' })
export class PaymentsFacade {
    private readonly startPayment = inject(StartPaymentUseCase);
    private readonly _state = signal<PaymentsUiState>({ status: 'idle' });

    // public read-only API
    readonly state = this._state.asReadonly();

    readonly isLoading = computed(() => this.state().status === 'loading');
    readonly intent = computed(() => {
        const state = this.state();
        return state.status === 'success' ? state.intent : null;
    });
    readonly error = computed(() => {
        const state = this.state();
        return state.status === 'error' ? state.error : null;
    });

    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void {
        this._state.set({ status: 'loading' });

        this.startPayment.execute(req, providerId).subscribe({
            next: (intent) => this._state.set({ status: 'success', intent }),
            error: (err) => this._state.set({ status: 'error', error: err }),
        });
    }

    reset(): void {
        this._state.set({ status: 'idle' });
    }
}