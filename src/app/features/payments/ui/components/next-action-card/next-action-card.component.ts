import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NextAction } from '../../../domain/models/payment/payment-action.types';
import { SpeiInstructionsComponent } from '../spei-instructions/spei-instructions.component';
import { I18nService } from '@core/i18n';

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
    private readonly i18n = inject(I18nService);
    
    /** Acción requerida */
    readonly nextAction = input<NextAction | null>(null);
    
    /** Emite cuando la acción se ha completado */
    readonly actionCompleted = output<void>();

    onPayPalClick(): void {
        // En una implementación real, podríamos trackear esto
        console.log('[NextActionCard] PayPal redirect clicked');
    }

    // ===== Textos para el template =====
    get threeDsTitle(): string {
        return this.i18n.t('ui.3ds_verification_required');
    }

    get bankRequiresVerificationText(): string {
        return this.i18n.t('ui.bank_requires_verification');
    }

    get threeDsVersionLabel(): string {
        return this.i18n.t('ui.3ds_version');
    }

    get completeVerificationLabel(): string {
        return this.i18n.t('ui.complete_verification');
    }

    get paypalApprovalTitle(): string {
        return this.i18n.t('ui.paypal_approval_required');
    }

    get redirectedToPaypalText(): string {
        return this.i18n.t('ui.redirected_to_paypal');
    }

    get orderIdLabel(): string {
        return this.i18n.t('ui.order_id');
    }

    get goToPaypalLabel(): string {
        return this.i18n.t('ui.go_to_paypal');
    }

    get afterApproveVerifyText(): string {
        return this.i18n.t('ui.after_approve_verify');
    }

    get actionRequiredLabel(): string {
        return this.i18n.t('ui.action_required');
    }

    get actionRequiresAttentionText(): string {
        return this.i18n.t('ui.action_requires_attention');
    }

    get viewActionDetailsLabel(): string {
        return this.i18n.t('ui.view_action_details');
    }
}
