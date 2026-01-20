import { Component, input, output, computed } from '@angular/core';
import { CommonModule, CurrencyPipe, JsonPipe, DatePipe } from '@angular/common';
import { PaymentIntent, PaymentError, STATUS_BADGE_MAP, STATUS_TEXT_MAP } from '../../shared';

/**
 * Componente que muestra el resultado de un pago.
 * 
 * Puede mostrar un pago exitoso con detalles del intent,
 * o un error con mensaje y opción de reintentar.
 * 
 * @example
 * ```html
 * <app-payment-result
 *   [intent]="currentIntent()"
 *   [error]="currentError()"
 *   (retry)="resetPayment()"
 *   (newPayment)="startNewPayment()"
 * />
 * ```
 */
@Component({
    selector: 'app-payment-result',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, JsonPipe],
    templateUrl: './payment-result.component.html',
})
export class PaymentResultComponent {
    /** Intent del pago (si fue exitoso) */
    readonly intent = input<PaymentIntent | null>(null);
    
    /** Error del pago (si falló) */
    readonly error = input<PaymentError | null>(null);
    
    /** Emite cuando el usuario quiere reintentar */
    readonly retry = output<void>();
    
    /** Emite cuando el usuario quiere hacer un nuevo pago */
    readonly newPayment = output<void>();

    /** Si hay un intent válido */
    readonly hasIntent = computed(() => this.intent() !== null);
    
    /** Si hay un error */
    readonly hasError = computed(() => this.error() !== null);
    
    /** Si el pago fue exitoso */
    readonly isSucceeded = computed(() => {
        const i = this.intent();
        return i !== null && i.status === 'succeeded';
    });

    /** Mensaje de error legible */
    readonly errorMessage = computed(() => {
        const e = this.error();
        if (!e) return 'Ha ocurrido un error procesando el pago';
        if (typeof e === 'object' && 'message' in e) {
            return (e as { message: string }).message;
        }
        return 'Ha ocurrido un error procesando el pago';
    });

    /** Código de error */
    readonly errorCode = computed(() => {
        const e = this.error();
        if (!e) return null;
        if (typeof e === 'object' && 'code' in e) {
            return (e as { code: string }).code;
        }
        return null;
    });

    /** Clase CSS del badge de estado */
    readonly statusBadgeClass = computed(() => {
        const i = this.intent();
        if (!i) return 'badge';
        return STATUS_BADGE_MAP[i.status] || 'badge';
    });

    /** Texto del estado */
    readonly statusText = computed(() => {
        const i = this.intent();
        if (!i) return '';
        return STATUS_TEXT_MAP[i.status] || i.status;
    });
}
