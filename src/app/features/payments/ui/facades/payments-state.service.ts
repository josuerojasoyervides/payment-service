import { Injectable, signal } from '@angular/core';
import { PaymentProcessState, PaymentUIState, Unsubscribe } from '../../application/state/payment-state';
import { CreatePaymentRequest, ConfirmPaymentRequest, CancelPaymentRequest } from '../../domain/models/payment.requests';
import { PaymentProviderId } from '../../domain/models/payment.types';

@Injectable({ providedIn: 'root' })
export class PaymentsUIStateService implements PaymentUIState {

    private readonly _state = signal<PaymentProcessState>({ kind: 'idle' });

    getSnapshot(): Readonly<PaymentProcessState> {
        throw new Error('Method not implemented.');
    }
    subscribe(listener: () => void): Unsubscribe {
        throw new Error('Method not implemented.');
    }
    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void {
        throw new Error('Method not implemented.');
    }
    confirm(req: ConfirmPaymentRequest): void {
        throw new Error('Method not implemented.');
    }
    cancel(req: CancelPaymentRequest): void {
        throw new Error('Method not implemented.');
    }
    reset(): void {
        throw new Error('Method not implemented.');
    }



}