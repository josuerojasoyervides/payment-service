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
    templateUrl: './spei-instructions.component.html',
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
