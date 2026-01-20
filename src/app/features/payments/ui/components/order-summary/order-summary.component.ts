import { Component, input, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { CurrencyCode, OrderItem } from '../../shared';

/**
 * Componente que muestra el resumen de una orden.
 * 
 * Muestra el ID de la orden, el monto total, y opcionalmente
 * un desglose de los items.
 * 
 * @example
 * ```html
 * <app-order-summary
 *   [orderId]="'order_123'"
 *   [amount]="499.99"
 *   [currency]="'MXN'"
 *   [items]="cartItems"
 * />
 * ```
 */
@Component({
    selector: 'app-order-summary',
    standalone: true,
    imports: [CommonModule, CurrencyPipe],
    template: `
        <div class="card">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Resumen de Orden</h3>
                <span class="text-sm text-gray-500 font-mono">{{ orderId() }}</span>
            </div>

            @if (items() && items()!.length > 0) {
                <div class="space-y-3 mb-4">
                    @for (item of items(); track item.name) {
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600">
                                {{ item.name }}
                                @if (item.quantity > 1) {
                                    <span class="text-gray-400">x{{ item.quantity }}</span>
                                }
                            </span>
                            <span class="text-gray-900">
                                {{ item.price * item.quantity | currency: currency() }}
                            </span>
                        </div>
                    }
                </div>
                <div class="border-t border-gray-200 pt-3">
                    <div class="flex justify-between text-sm text-gray-500 mb-1">
                        <span>Subtotal</span>
                        <span>{{ subtotal() | currency: currency() }}</span>
                    </div>
                </div>
            }

            <div class="flex justify-between items-center" 
                 [class.pt-3]="items() && items()!.length > 0"
                 [class.border-t]="items() && items()!.length > 0"
                 [class.border-gray-200]="items() && items()!.length > 0">
                <span class="text-base font-medium text-gray-900">Total</span>
                <span class="text-2xl font-bold text-gray-900">
                    {{ amount() | currency: currency() }}
                </span>
            </div>
        </div>
    `,
})
export class OrderSummaryComponent {
    /** ID único de la orden */
    readonly orderId = input.required<string>();
    
    /** Monto total a pagar */
    readonly amount = input.required<number>();
    
    /** Código de moneda */
    readonly currency = input.required<CurrencyCode>();
    
    /** Items de la orden (opcional) */
    readonly items = input<OrderItem[]>();

    /** Subtotal calculado de los items */
    readonly subtotal = computed(() => {
        const itemsList = this.items();
        if (!itemsList || itemsList.length === 0) return this.amount();
        return itemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    });
}
