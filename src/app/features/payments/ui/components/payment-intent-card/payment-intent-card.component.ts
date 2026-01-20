import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { PaymentIntent, STATUS_BADGE_MAP, getStatusText } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Card component to display a PaymentIntent.
 * 
 * Useful for history lists, status page, etc.
 * Shows summarized information and optional actions.
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
    templateUrl: './payment-intent-card.component.html',
})
export class PaymentIntentCardComponent {
    private readonly i18n = inject(I18nService);
    
    /** Intent to display */
    readonly intent = input.required<PaymentIntent>();
    
    /** Whether to show actions */
    readonly showActions = input<boolean>(true);
    
    /** Whether expanded */
    readonly expanded = input<boolean>(false);
    
    /** Emits to confirm the intent */
    readonly confirm = output<string>();
    
    /** Emits to cancel the intent */
    readonly cancel = output<string>();
    
    /** Emits to refresh status */
    readonly refresh = output<string>();
    
    /** Emits to expand/collapse */
    readonly expandedChange = output<boolean>();

    private _expanded = false;

    /** Status helpers */
    readonly isSucceeded = computed(() => this.intent().status === 'succeeded');
    readonly isFailed = computed(() => this.intent().status === 'failed');
    readonly isCanceled = computed(() => this.intent().status === 'canceled');
    readonly isPending = computed(() => 
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(this.intent().status)
    );
    readonly isProcessing = computed(() => this.intent().status === 'processing');

    /** Whether can confirm */
    readonly canConfirm = computed(() => 
        ['requires_confirmation', 'requires_action'].includes(this.intent().status)
    );

    /** Whether can cancel */
    readonly canCancel = computed(() => 
        !['succeeded', 'canceled', 'failed'].includes(this.intent().status)
    );

    /** Status badge class */
    readonly statusBadgeClass = computed(() => {
        return STATUS_BADGE_MAP[this.intent().status] || 'badge';
    });

    /** Status text */
    readonly statusText = computed(() => {
        return getStatusText(this.i18n, this.intent().status);
    });

    toggleExpanded(): void {
        this._expanded = !this._expanded;
        this.expandedChange.emit(this._expanded);
    }

    get providerLabel(): string {
        return this.i18n.t(I18nKeys.ui.payment_provider);
    }

    get statusLabel(): string {
        return this.i18n.t(I18nKeys.ui.status_label);
    }

    get amountLabel(): string {
        return this.i18n.t(I18nKeys.ui.amount_label);
    }

    get actionRequiredLabel(): string {
        return this.i18n.t(I18nKeys.ui.action_required_label);
    }

    get confirmButtonText(): string {
        return this.i18n.t(I18nKeys.ui.confirm_button);
    }

    get cancelButtonText(): string {
        return this.i18n.t(I18nKeys.ui.cancel_button);
    }

    get idLabel(): string {
        return this.i18n.t(I18nKeys.ui.id_label);
    }

    get clientSecretLabel(): string {
        return this.i18n.t(I18nKeys.ui.client_secret);
    }

    get redirectUrlLabel(): string {
        return this.i18n.t(I18nKeys.ui.redirect_url);
    }
}
