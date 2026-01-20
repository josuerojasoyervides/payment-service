import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../domain/models/payment.requests";
import { PaymentIntent, PaymentProviderId } from "../../domain/models/payment.types";

/**
 * @deprecated Usar PaymentsStore de @ngrx/signals directamente.
 * Este tipo se mantiene por retrocompatibilidad.
 */
export type PaymentsUiState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; intent: PaymentIntent }
    | { status: "error"; error: unknown };

export type Unsubscribe = () => void;

/**
 * @deprecated Usar PaymentsStore de @ngrx/signals directamente.
 * 
 * Este port se mantiene por retrocompatibilidad con código existente.
 * Para nuevas implementaciones, inyectar PaymentsStore directamente:
 * 
 * @example
 * ```typescript
 * import { PaymentsStore } from '../application/store/payments.store';
 * 
 * @Component({...})
 * class MyComponent {
 *   readonly store = inject(PaymentsStore);
 *   readonly isLoading = this.store.isLoading;
 *   readonly intent = this.store.currentIntent;
 * }
 * ```
 */
export interface PaymentStatePort {
    getSnapshot(): Readonly<PaymentsUiState>;
    subscribe(listener: () => void): Unsubscribe;

    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void;
    confirm(req: ConfirmPaymentRequest, providerId: PaymentProviderId): void;
    cancel(req: CancelPaymentRequest, providerId: PaymentProviderId): void;
    refresh(req: GetPaymentStatusRequest, providerId: PaymentProviderId): void;
    reset(): void;
}