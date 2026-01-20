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
    template: `
        @if (hasError()) {
            <!-- Error State -->
            <div class="alert-error">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-red-800">Error en el pago</h3>
                        <p class="mt-1 text-red-700">
                            {{ errorMessage() }}
                        </p>
                        
                        @if (errorCode()) {
                            <p class="mt-2 text-sm text-red-600">
                                Código: <code class="font-mono">{{ errorCode() }}</code>
                            </p>
                        }
                        
                        <details class="mt-3">
                            <summary class="text-sm text-red-600 cursor-pointer hover:underline">
                                Ver detalles técnicos
                            </summary>
                            <pre class="mt-2 p-3 bg-red-100 rounded-lg text-xs overflow-auto max-h-40">{{ error() | json }}</pre>
                        </details>
                        
                        <div class="mt-4 flex gap-3">
                            <button class="btn-primary" (click)="retry.emit()">
                                Intentar de nuevo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        } @else if (hasIntent()) {
            <!-- Success State -->
            <div class="alert-success">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-green-800">
                            @if (isSucceeded()) {
                                Pago completado
                            } @else {
                                Pago iniciado correctamente
                            }
                        </h3>
                        
                        <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <dt class="text-green-700">Intent ID</dt>
                            <dd class="font-mono text-green-900">{{ intent()!.id }}</dd>
                            
                            <dt class="text-green-700">Proveedor</dt>
                            <dd class="text-green-900 capitalize">{{ intent()!.provider }}</dd>
                            
                            <dt class="text-green-700">Estado</dt>
                            <dd>
                                <span [class]="statusBadgeClass()">
                                    {{ statusText() }}
                                </span>
                            </dd>
                            
                            <dt class="text-green-700">Monto</dt>
                            <dd class="text-green-900 font-semibold">
                                {{ intent()!.amount | currency: intent()!.currency }}
                            </dd>
                        </dl>
                        
                        <details class="mt-4">
                            <summary class="text-sm text-green-600 cursor-pointer hover:underline">
                                Ver respuesta completa
                            </summary>
                            <pre class="mt-2 p-3 bg-green-100 rounded-lg text-xs overflow-auto max-h-40">{{ intent() | json }}</pre>
                        </details>
                        
                        <div class="mt-4">
                            <button class="btn-success" (click)="newPayment.emit()">
                                Nuevo pago
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        }
    `,
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
