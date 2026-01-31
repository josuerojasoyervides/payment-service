import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { I18nKeys, I18nService } from '@core/i18n';
import type { OrderItem } from '@payments/ui/shared/ui.types';

/**
 * Component that displays order summary.
 *
 * Shows order ID, total amount, and optionally
 * an item breakdown.
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
  private readonly i18n = inject(I18nService);

  /** Unique order ID */
  readonly orderId = input.required<string>();

  /** Total amount to pay */
  readonly amount = input.required<number>();

  /** Currency code */
  readonly currency = input.required<CurrencyCode>();

  /** Order items (optional) */
  readonly items = input<OrderItem[]>();

  /** Calculated subtotal from items */
  readonly subtotal = computed(() => {
    const itemsList = this.items();
    if (!itemsList || itemsList.length === 0) return this.amount();
    return itemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  });

  readonly orderSummaryLabel = computed(() => this.i18n.t(I18nKeys.ui.order_summary));

  readonly subtotalLabel = computed(() => this.i18n.t(I18nKeys.ui.subtotal));

  readonly totalLabel = computed(() => this.i18n.t(I18nKeys.ui.total));
}
