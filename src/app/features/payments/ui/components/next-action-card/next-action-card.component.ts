import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextAction } from '../../../domain/models/payment/payment-action.types';
import { SpeiInstructionsComponent } from '../spei-instructions/spei-instructions.component';

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
    templateUrl: './next-action-card.component.html',
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
