import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentProviderId, PaymentIntent } from '../../../domain/models';
import { PaymentIntentCardComponent } from '../../components';
import { PaymentHistoryEntry } from '../../../application/store/payment.models';

/**
 * Página de historial de pagos.
 * 
 * Muestra todos los intentos de pago realizados durante la sesión.
 * Permite ver detalles, refrescar estados y realizar acciones.
 */
@Component({
    selector: 'app-history',
    standalone: true,
    imports: [CommonModule, RouterLink, PaymentIntentCardComponent],
    templateUrl: './history.component.html',
})
export class HistoryComponent {
    private readonly paymentState = inject(PAYMENT_STATE);

    readonly history = this.paymentState.history;
    readonly historyCount = this.paymentState.historyCount;
    readonly isLoading = this.paymentState.isLoading;

    isActionRequired(status: string): boolean {
        return ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(status);
    }

    entryToIntent(entry: PaymentHistoryEntry): PaymentIntent {
        return {
            id: entry.intentId,
            provider: entry.provider,
            status: entry.status as PaymentIntent['status'],
            amount: entry.amount,
            currency: entry.currency as PaymentIntent['currency'],
        };
    }

    confirmPayment(intentId: string, provider: PaymentProviderId): void {
        this.paymentState.confirmPayment({ intentId }, provider);
    }

    cancelPayment(intentId: string, provider: PaymentProviderId): void {
        this.paymentState.cancelPayment({ intentId }, provider);
    }

    refreshPayment(intentId: string, provider: PaymentProviderId): void {
        this.paymentState.refreshPayment({ intentId }, provider);
    }

    clearHistory(): void {
        this.paymentState.clearHistory();
    }
}
