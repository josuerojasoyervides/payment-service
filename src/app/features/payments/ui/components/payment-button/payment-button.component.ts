import { Component, input, output, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { PaymentProviderId, CurrencyCode, PaymentButtonState } from '../../shared';

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
    template: `
        <button
            type="button"
            class="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3"
            [class]="buttonClasses()"
            [disabled]="disabled() || loading()"
            (click)="handleClick()"
        >
            @switch (state()) {
                @case ('loading') {
                    <div class="spinner"></div>
                    <span>Procesando...</span>
                }
                @case ('success') {
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>Pago exitoso</span>
                }
                @case ('error') {
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Error en el pago</span>
                }
                @default {
                    <span class="text-xl">💳</span>
                    <span>
                        Pagar {{ amount() | currency: currency() }}
                        @if (provider()) {
                            con {{ providerName() }}
                        }
                    </span>
                }
            }
        </button>
    `,
})
export class PaymentButtonComponent {
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
        return p.charAt(0).toUpperCase() + p.slice(1);
    });

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
