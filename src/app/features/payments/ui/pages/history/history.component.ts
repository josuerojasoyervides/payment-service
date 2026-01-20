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
    template: `
        <div class="min-h-screen bg-gray-50 py-8">
            <div class="max-w-3xl mx-auto px-4">
                <!-- Header -->
                <div class="flex items-center justify-between mb-8">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">Historial de Pagos</h1>
                        <p class="text-gray-600 mt-1">
                            {{ historyCount() }} pago(s) en esta sesión
                        </p>
                    </div>
                    <div class="flex gap-3">
                        <button 
                            class="btn-secondary text-sm"
                            [disabled]="historyCount() === 0"
                            (click)="clearHistory()"
                        >
                            Limpiar historial
                        </button>
                        <a routerLink="/payments/checkout" class="btn-primary text-sm">
                            Nuevo pago
                        </a>
                    </div>
                </div>

                <!-- Empty State -->
                @if (historyCount() === 0) {
                    <div class="card text-center py-12">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">
                            No hay pagos en el historial
                        </h3>
                        <p class="text-gray-600 mb-6">
                            Los pagos que realices aparecerán aquí
                        </p>
                        <a routerLink="/payments/checkout" class="btn-primary">
                            Realizar un pago
                        </a>
                    </div>
                } @else {
                    <!-- History List -->
                    <div class="space-y-4">
                        @for (entry of history(); track entry.intentId; let i = $index) {
                            <div class="relative">
                                <!-- Timeline connector -->
                                @if (i < history().length - 1) {
                                    <div class="absolute left-5 top-16 bottom-0 w-0.5 bg-gray-200"></div>
                                }
                                
                                <!-- Entry -->
                                <div class="flex gap-4">
                                    <!-- Timeline dot -->
                                    <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10"
                                         [class.bg-green-100]="entry.status === 'succeeded'"
                                         [class.bg-red-100]="entry.status === 'failed' || entry.status === 'canceled'"
                                         [class.bg-blue-100]="entry.status === 'processing'"
                                         [class.bg-yellow-100]="isActionRequired(entry.status)">
                                        <span class="text-sm font-medium text-gray-600">
                                            {{ history().length - i }}
                                        </span>
                                    </div>
                                    
                                    <!-- Card -->
                                    <div class="flex-1">
                                        <p class="text-xs text-gray-500 mb-2">
                                            {{ entry.timestamp | date:'medium' }}
                                        </p>
                                        <app-payment-intent-card
                                            [intent]="entryToIntent(entry)"
                                            [showActions]="true"
                                            (confirm)="confirmPayment($event, entry.provider)"
                                            (cancel)="cancelPayment($event, entry.provider)"
                                            (refresh)="refreshPayment($event, entry.provider)"
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                }

                <!-- Navigation -->
                <div class="mt-8 flex justify-center gap-4 text-sm">
                    <a routerLink="/payments/checkout" class="text-blue-600 hover:underline">
                        Checkout
                    </a>
                    <a routerLink="/payments/status" class="text-blue-600 hover:underline">
                        Consultar por ID
                    </a>
                </div>
            </div>
        </div>
    `,
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
