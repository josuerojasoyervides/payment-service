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
    templateUrl: './order-summary.component.html',
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
