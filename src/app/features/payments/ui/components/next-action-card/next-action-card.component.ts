import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextAction } from '../../../domain/models/payment/payment-action.types';
import { SpeiInstructionsComponent } from '../spei-instructions';

/**
 * Componente que muestra la acción requerida para completar un pago.
 * 
 * Soporta diferentes tipos de acciones:
 * - 3DS: Autenticación bancaria
 * - SPEI: Instrucciones de transferencia
 * - PayPal: Redirección a PayPal
 * 
 * @example
 * ```html
 * <app-next-action-card
 *   [nextAction]="intent.nextAction"
 *   (actionCompleted)="onActionCompleted()"
 * />
 * ```
 */
@Component({
    selector: 'app-next-action-card',
    standalone: true,
    imports: [CommonModule, SpeiInstructionsComponent],
    template: `
        @if (nextAction(); as action) {
            <div class="mt-4">
                @switch (action.type) {
                    @case ('3ds') {
                        <div class="bg-amber-50 border border-amber-200 rounded-xl p-6">
                            <div class="flex items-start gap-4">
                                <div class="flex-shrink-0">
                                    <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                        <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                        </svg>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-amber-900">
                                        Verificación 3D Secure requerida
                                    </h3>
                                    <p class="mt-1 text-amber-700">
                                        Tu banco requiere verificación adicional para completar esta transacción.
                                        Serás redirigido a una página segura para autenticar el pago.
                                    </p>
                                    
                                    @if ($any(action).threeDsVersion) {
                                        <p class="mt-2 text-sm text-amber-600">
                                            Versión 3DS: {{ $any(action).threeDsVersion }}
                                        </p>
                                    }
                                    
                                    <div class="mt-4">
                                        <a 
                                            [href]="$any(action).returnUrl || '#'"
                                            target="_blank"
                                            class="btn-primary inline-flex items-center gap-2"
                                        >
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                            </svg>
                                            Completar verificación
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                    
                    @case ('spei') {
                        <app-spei-instructions
                            [clabe]="$any(action).clabe"
                            [reference]="$any(action).reference"
                            [bank]="$any(action).bank"
                            [beneficiary]="$any(action).beneficiary"
                            [amount]="$any(action).amount"
                            [currency]="$any(action).currency"
                            [expiresAt]="$any(action).expiresAt"
                        />
                    }
                    
                    @case ('paypal_approve') {
                        <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                            <div class="flex items-start gap-4">
                                <div class="flex-shrink-0">
                                    <div class="w-12 h-12 bg-paypal-primary rounded-full flex items-center justify-center">
                                        <span class="text-white text-xl font-bold">P</span>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <h3 class="text-lg font-semibold text-blue-900">
                                        Aprobación de PayPal requerida
                                    </h3>
                                    <p class="mt-1 text-blue-700">
                                        Serás redirigido a PayPal para aprobar este pago.
                                        Una vez aprobado, regresarás automáticamente.
                                    </p>
                                    
                                    @if ($any(action).paypalOrderId) {
                                        <p class="mt-2 text-sm text-blue-600 font-mono">
                                            Order ID: {{ $any(action).paypalOrderId }}
                                        </p>
                                    }
                                    
                                    <div class="mt-4 flex flex-wrap gap-3">
                                        <a 
                                            [href]="$any(action).approveUrl"
                                            target="_blank"
                                            class="btn-paypal inline-flex items-center gap-2"
                                            (click)="onPayPalClick()"
                                        >
                                            <span class="text-lg">🅿️</span>
                                            Ir a PayPal
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                            </svg>
                                        </a>
                                    </div>
                                    
                                    <p class="mt-4 text-xs text-blue-500">
                                        Después de aprobar en PayPal, haz clic en "Verificar estado" 
                                        para confirmar el pago.
                                    </p>
                                </div>
                            </div>
                        </div>
                    }
                    
                    @default {
                        <div class="bg-gray-50 border border-gray-200 rounded-xl p-6">
                            <div class="flex items-center gap-3">
                                <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <div>
                                    <h3 class="font-semibold text-gray-900">
                                        Acción requerida: {{ action.type }}
                                    </h3>
                                    <p class="text-sm text-gray-600 mt-1">
                                        Este tipo de acción requiere atención adicional.
                                    </p>
                                </div>
                            </div>
                            
                            <details class="mt-4">
                                <summary class="text-sm text-gray-500 cursor-pointer">
                                    Ver detalles de la acción
                                </summary>
                                <pre class="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">{{ action | json }}</pre>
                            </details>
                        </div>
                    }
                }
            </div>
        }
    `,
})
export class NextActionCardComponent {
    /** Acción requerida */
    readonly nextAction = input<NextAction | null>(null);
    
    /** Emite cuando la acción se ha completado */
    readonly actionCompleted = output<void>();

    onPayPalClick(): void {
        // En una implementación real, podríamos trackear esto
        console.log('[NextActionCard] PayPal redirect clicked');
    }
}
