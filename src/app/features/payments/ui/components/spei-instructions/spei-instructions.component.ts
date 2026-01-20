import { Component, input, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';

/**
 * Componente que muestra instrucciones para pago SPEI.
 * 
 * Incluye CLABE, referencia y monto con funcionalidad
 * de copiar al portapapeles.
 * 
 * @example
 * ```html
 * <app-spei-instructions
 *   [clabe]="'646180157000000001'"
 *   [reference]="'1234567'"
 *   [bank]="'STP'"
 *   [beneficiary]="'Mi Empresa'"
 *   [amount]="499.99"
 *   [currency]="'MXN'"
 *   [expiresAt]="'2024-01-20T12:00:00Z'"
 * />
 * ```
 */
@Component({
    selector: 'app-spei-instructions',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, DatePipe],
    template: `
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div class="flex items-center gap-3 mb-4">
                <span class="text-3xl">🏦</span>
                <div>
                    <h3 class="text-lg font-semibold text-blue-900">Transferencia SPEI</h3>
                    <p class="text-sm text-blue-700">Realiza la transferencia con los siguientes datos</p>
                </div>
            </div>

            <div class="space-y-4">
                <!-- CLABE -->
                <div class="bg-white rounded-lg p-4 border border-blue-100">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs text-gray-500 uppercase tracking-wide">CLABE</p>
                            <p class="text-lg font-mono font-semibold text-gray-900 tracking-wider">
                                {{ formatClabe(clabe()) }}
                            </p>
                        </div>
                        <button 
                            class="btn-secondary text-sm"
                            (click)="copyToClipboard(clabe(), 'clabe')"
                        >
                            @if (copiedField() === 'clabe') {
                                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                </svg>
                                Copiado
                            } @else {
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                                Copiar
                            }
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- Referencia -->
                    <div class="bg-white rounded-lg p-4 border border-blue-100">
                        <p class="text-xs text-gray-500 uppercase tracking-wide">Referencia</p>
                        <div class="flex items-center justify-between mt-1">
                            <p class="font-mono font-semibold text-gray-900">{{ reference() }}</p>
                            <button 
                                class="text-blue-600 hover:text-blue-700 p-1"
                                (click)="copyToClipboard(reference(), 'reference')"
                            >
                                @if (copiedField() === 'reference') {
                                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                    </svg>
                                } @else {
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                    </svg>
                                }
                            </button>
                        </div>
                    </div>

                    <!-- Monto -->
                    <div class="bg-white rounded-lg p-4 border border-blue-100">
                        <p class="text-xs text-gray-500 uppercase tracking-wide">Monto exacto</p>
                        <p class="font-semibold text-gray-900 text-lg mt-1">
                            {{ amount() | currency: currency() }}
                        </p>
                    </div>
                </div>

                <!-- Banco y Beneficiario -->
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-gray-500">Banco destino</p>
                        <p class="font-medium text-gray-900">{{ bank() }}</p>
                    </div>
                    @if (beneficiary()) {
                        <div>
                            <p class="text-gray-500">Beneficiario</p>
                            <p class="font-medium text-gray-900">{{ beneficiary() }}</p>
                        </div>
                    }
                </div>

                <!-- Expiración -->
                @if (expiresAt()) {
                    <div class="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>
                            Esta referencia expira el 
                            <strong>{{ expiresAt() | date:'medium' }}</strong>
                        </span>
                    </div>
                }

                <!-- Notas importantes -->
                <div class="text-xs text-gray-500 space-y-1 mt-4">
                    <p>• Transfiere el monto exacto para evitar rechazos</p>
                    <p>• El pago puede tardar de 1 a 24 horas en reflejarse</p>
                    <p>• Conserva tu comprobante de transferencia</p>
                </div>
            </div>
        </div>
    `,
})
export class SpeiInstructionsComponent {
    /** CLABE interbancaria */
    readonly clabe = input.required<string>();
    
    /** Número de referencia */
    readonly reference = input.required<string>();
    
    /** Nombre del banco */
    readonly bank = input.required<string>();
    
    /** Nombre del beneficiario */
    readonly beneficiary = input<string>();
    
    /** Monto a transferir */
    readonly amount = input.required<number>();
    
    /** Código de moneda */
    readonly currency = input<string>('MXN');
    
    /** Fecha de expiración */
    readonly expiresAt = input<string>();

    /** Campo que acaba de ser copiado */
    readonly copiedField = signal<string | null>(null);

    /** Formatea la CLABE con espacios para mejor legibilidad */
    formatClabe(clabe: string): string {
        // Formato: XXX XXX XXXXXXXXXXX X
        return clabe.replace(/(\d{3})(\d{3})(\d{11})(\d{1})/, '$1 $2 $3 $4');
    }

    /** Copia texto al portapapeles */
    async copyToClipboard(text: string, field: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            this.copiedField.set(field);
            
            // Resetear después de 2 segundos
            setTimeout(() => {
                if (this.copiedField() === field) {
                    this.copiedField.set(null);
                }
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
}
