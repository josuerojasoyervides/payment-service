import { CommonModule } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { NextAction } from '../../../domain/models/payment/payment-action.types';
import { SpeiInstructionsComponent } from '../spei-instructions/spei-instructions.component';

type PaypalApproveAction = Extract<NextAction, { type: 'paypal_approve' }> & {
  approveUrl: string;
};

function isPaypalApproveAction(action: NextAction): action is PaypalApproveAction {
  if (action.type !== 'paypal_approve') return false;

  // Validación runtime sin any
  const maybe = action as { approveUrl?: unknown };
  return typeof maybe.approveUrl === 'string' && maybe.approveUrl.length > 0;
}

/**
 * Component that displays the required action to complete a payment.
 *
 * Supports different action types:
 * - 3DS: Bank authentication
 * - SPEI: Transfer instructions
 * - PayPal: Redirect to PayPal
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

  /** Required action */
  readonly nextAction = input<NextAction | null>(null);

  /** Emits when action is completed */
  readonly actionCompleted = output<void>();

  /** Emits when PayPal redirect is requested */
  readonly paypalRequested = output<string>();

  onPayPalClick(): void {
    const action = this.nextAction();
    if (!action) return;

    if (isPaypalApproveAction(action)) {
      this.paypalRequested.emit(action.approveUrl);
    }
  }

  // ===== Textos para el template =====
  get threeDsTitle(): string {
    return this.i18n.t(I18nKeys.ui['3ds_verification_required']);
  }

  get bankRequiresVerificationText(): string {
    return this.i18n.t(I18nKeys.ui.bank_requires_verification);
  }

  get threeDsVersionLabel(): string {
    return this.i18n.t(I18nKeys.ui['3ds_version']);
  }

  get completeVerificationLabel(): string {
    return this.i18n.t(I18nKeys.ui.complete_verification);
  }

  get paypalApprovalTitle(): string {
    return this.i18n.t(I18nKeys.ui.paypal_approval_required);
  }

  get redirectedToPaypalText(): string {
    return this.i18n.t(I18nKeys.ui.redirected_to_paypal);
  }

  get orderIdLabel(): string {
    return this.i18n.t(I18nKeys.ui.order_id);
  }

  get goToPaypalLabel(): string {
    return this.i18n.t(I18nKeys.ui.go_to_paypal);
  }

  get afterApproveVerifyText(): string {
    return this.i18n.t(I18nKeys.ui.after_approve_verify);
  }

  get actionRequiredLabel(): string {
    return this.i18n.t(I18nKeys.ui.action_required);
  }

  get actionRequiresAttentionText(): string {
    return this.i18n.t(I18nKeys.ui.action_requires_attention);
  }

  get viewActionDetailsLabel(): string {
    return this.i18n.t(I18nKeys.ui.view_action_details);
  }
}
