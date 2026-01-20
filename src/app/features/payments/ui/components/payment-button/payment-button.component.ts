import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { PaymentProviderId, CurrencyCode, PaymentButtonState } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Componente de botón de pago con estados visuales.
 * 
 * Muestra el monto a pagar y el proveedor seleccionado,
 * con diferentes estados: idle, loading, success, error.
 * 
 * @example
 * ```html
 * <app-payment-button
 *   [amount]="499.99"
 *   [currency]="'MXN'"
 *   [provider]="'stripe'"
 *   [loading]="isLoading()"
 *   [disabled]="!isFormValid()"
 *   (pay)="processPayment()"
 * />
 * ```
 */
@Component({
    selector: 'app-payment-button',
    standalone: true,
    imports: [CommonModule, CurrencyPipe],
    templateUrl: './payment-button.component.html',
})
export class PaymentButtonComponent {
    private readonly i18n = inject(I18nService);
    
    /** Monto a pagar */
    readonly amount = input.required<number>();
    
    /** Código de moneda */
    readonly currency = input.required<CurrencyCode>();
    
    /** Proveedor de pago */
    readonly provider = input<PaymentProviderId | null>(null);
    
    /** Si está en estado de carga */
    readonly loading = input<boolean>(false);
    
    /** Si el botón está deshabilitado */
    readonly disabled = input<boolean>(false);
    
    /** Estado explícito del botón */
    readonly buttonState = input<PaymentButtonState>('idle');
    
    /** Emite cuando se hace clic en el botón */
    readonly pay = output<void>();

    /** Estado computado del botón */
    readonly state = computed<PaymentButtonState>(() => {
        if (this.loading()) return 'loading';
        return this.buttonState();
    });

    /** Nombre legible del proveedor */
    readonly providerName = computed(() => {
        const p = this.provider();
        if (!p) return '';
        if (p === 'stripe') return this.i18n.t(I18nKeys.ui.provider_stripe);
        if (p === 'paypal') return this.i18n.t(I18nKeys.ui.provider_paypal);
        const providerStr = String(p);
        return providerStr.charAt(0).toUpperCase() + providerStr.slice(1);
    });

    get processingText(): string {
        return this.i18n.t(I18nKeys.ui.processing);
    }

    get paymentSuccessfulText(): string {
        return this.i18n.t(I18nKeys.ui.payment_successful);
    }

    get paymentErrorText(): string {
        return this.i18n.t(I18nKeys.ui.payment_error_text);
    }

    get payWithText(): string {
        return this.i18n.t(I18nKeys.ui.pay_with);
    }

    get withText(): string {
        return this.i18n.t(I18nKeys.ui.with);
    }

    /** Clases CSS del botón según estado */
    readonly buttonClasses = computed(() => {
        const state = this.state();
        const disabled = this.disabled() || this.loading();

        const base = 'focus:outline-none focus:ring-2 focus:ring-offset-2';
        
        if (state === 'success') {
            return `${base} bg-green-600 text-white cursor-default`;
        }
        
        if (state === 'error') {
            return `${base} bg-red-600 text-white cursor-default`;
        }
        
        if (disabled) {
            return `${base} bg-gray-300 text-gray-500 cursor-not-allowed`;
        }

        // Estado normal - color según proveedor
        const provider = this.provider();
        if (provider === 'stripe') {
            return `${base} bg-stripe-primary hover:opacity-90 text-white focus:ring-stripe-primary`;
        }
        if (provider === 'paypal') {
            return `${base} bg-paypal-primary hover:opacity-90 text-white focus:ring-paypal-primary`;
        }
        
        return `${base} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
    });

    handleClick(): void {
        if (!this.disabled() && !this.loading()) {
            this.pay.emit();
        }
    }
}
