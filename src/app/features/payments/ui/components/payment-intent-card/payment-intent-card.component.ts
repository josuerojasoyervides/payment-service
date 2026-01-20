import { Component, input, output, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { PaymentIntent, STATUS_BADGE_MAP, STATUS_TEXT_MAP } from '../../shared';

/**
 * Componente card para mostrar un PaymentIntent.
 * 
 * Útil para listas de historial, página de status, etc.
 * Muestra información resumida y acciones opcionales.
 * 
 * @example
 * ```html
 * <app-payment-intent-card
 *   [intent]="intent"
 *   [showActions]="true"
 *   [expanded]="false"
 *   (confirm)="onConfirm($event)"
 *   (cancel)="onCancel($event)"
 *   (refresh)="onRefresh($event)"
 * />
 * ```
 */
@Component({
    selector: 'app-payment-intent-card',
    standalone: true,
    imports: [CommonModule, CurrencyPipe],
    template: `
        <div class="card hover:shadow-md transition-shadow">
            <!-- Header -->
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center"
                         [class.bg-green-100]="isSucceeded()"
                         [class.bg-red-100]="isFailed()"
                         [class.bg-yellow-100]="isPending()"
                         [class.bg-blue-100]="isProcessing()"
                         [class.bg-gray-100]="isCanceled()">
                        @if (isSucceeded()) {
                            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                        } @else if (isFailed()) {
                            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        } @else if (isProcessing()) {
                            <svg class="w-5 h-5 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        } @else {
                            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        }
                    </div>
                    <div>
                        <p class="font-mono text-sm text-gray-600">{{ intent().id }}</p>
                        <span [class]="statusBadgeClass()">{{ statusText() }}</span>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-semibold text-gray-900">
                        {{ intent().amount | currency: intent().currency }}
                    </p>
                    <p class="text-sm text-gray-500 capitalize">{{ intent().provider }}</p>
                </div>
            </div>

            <!-- Details (expandible) -->
            @if (expanded()) {
                <div class="border-t border-gray-100 pt-4 mt-4">
                    <dl class="grid grid-cols-2 gap-3 text-sm">
                        <dt class="text-gray-500">ID</dt>
                        <dd class="font-mono text-gray-900">{{ intent().id }}</dd>
                        
                        <dt class="text-gray-500">Proveedor</dt>
                        <dd class="capitalize text-gray-900">{{ intent().provider }}</dd>
                        
                        <dt class="text-gray-500">Estado</dt>
                        <dd class="text-gray-900">{{ intent().status }}</dd>
                        
                        <dt class="text-gray-500">Monto</dt>
                        <dd class="text-gray-900">{{ intent().amount | currency: intent().currency }}</dd>
                        
                        @if (intent().clientSecret) {
                            <dt class="text-gray-500">Client Secret</dt>
                            <dd class="font-mono text-xs text-gray-600 truncate">{{ intent().clientSecret }}</dd>
                        }
                        
                        @if (intent().redirectUrl) {
                            <dt class="text-gray-500">Redirect URL</dt>
                            <dd class="text-xs text-blue-600 truncate">
                                <a [href]="intent().redirectUrl" target="_blank">{{ intent().redirectUrl }}</a>
                            </dd>
                        }
                    </dl>

                    @if (intent().nextAction) {
                        <div class="mt-4 p-3 bg-amber-50 rounded-lg">
                            <p class="text-sm font-medium text-amber-800">
                                Acción requerida: {{ intent().nextAction!.type }}
                            </p>
                        </div>
                    }
                </div>
            }

            <!-- Actions -->
            @if (showActions()) {
                <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    @if (canConfirm()) {
                        <button 
                            class="btn-primary text-sm flex-1"
                            (click)="confirm.emit(intent().id)"
                        >
                            Confirmar
                        </button>
                    }
                    
                    @if (canCancel()) {
                        <button 
                            class="btn-danger text-sm flex-1"
                            (click)="cancel.emit(intent().id)"
                        >
                            Cancelar
                        </button>
                    }
                    
                    <button 
                        class="btn-secondary text-sm"
                        (click)="refresh.emit(intent().id)"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                    </button>
                    
                    <button 
                        class="btn-secondary text-sm"
                        (click)="toggleExpanded()"
                    >
                        @if (expanded()) {
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
                            </svg>
                        } @else {
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        }
                    </button>
                </div>
            }
        </div>
    `,
})
export class PaymentIntentCardComponent {
    /** Intent a mostrar */
    readonly intent = input.required<PaymentIntent>();
    
    /** Si mostrar acciones */
    readonly showActions = input<boolean>(true);
    
    /** Si está expandido */
    readonly expanded = input<boolean>(false);
    
    /** Emite para confirmar el intent */
    readonly confirm = output<string>();
    
    /** Emite para cancelar el intent */
    readonly cancel = output<string>();
    
    /** Emite para refrescar el estado */
    readonly refresh = output<string>();
    
    /** Emite para expandir/colapsar */
    readonly expandedChange = output<boolean>();

    private _expanded = false;

    /** Estado helpers */
    readonly isSucceeded = computed(() => this.intent().status === 'succeeded');
    readonly isFailed = computed(() => this.intent().status === 'failed');
    readonly isCanceled = computed(() => this.intent().status === 'canceled');
    readonly isPending = computed(() => 
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(this.intent().status)
    );
    readonly isProcessing = computed(() => this.intent().status === 'processing');

    /** Si se puede confirmar */
    readonly canConfirm = computed(() => 
        ['requires_confirmation', 'requires_action'].includes(this.intent().status)
    );

    /** Si se puede cancelar */
    readonly canCancel = computed(() => 
        !['succeeded', 'canceled', 'failed'].includes(this.intent().status)
    );

    /** Clase del badge de estado */
    readonly statusBadgeClass = computed(() => {
        return STATUS_BADGE_MAP[this.intent().status] || 'badge';
    });

    /** Texto del estado */
    readonly statusText = computed(() => {
        return STATUS_TEXT_MAP[this.intent().status] || this.intent().status;
    });

    toggleExpanded(): void {
        this._expanded = !this._expanded;
        this.expandedChange.emit(this._expanded);
    }
}
