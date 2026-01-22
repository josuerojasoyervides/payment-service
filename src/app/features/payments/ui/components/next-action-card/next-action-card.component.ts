import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { NextAction } from '../../../domain/models/payment/payment-action.types';
import { SpeiInstructionsComponent } from '../spei-instructions/spei-instructions.component';

@Component({
  selector: 'app-next-action-card',
  standalone: true,
  imports: [CommonModule, SpeiInstructionsComponent],
  templateUrl: './next-action-card.component.html',
})
export class NextActionCardComponent {
  private readonly i18n = inject(I18nService);

  readonly nextAction = input<NextAction | null>(null);

  readonly actionCompleted = output<void>();
  readonly paypalRequested = output<string>();

  // ✅ Labels UI como computed
  readonly threeDsTitle = computed(() => this.i18n.t(I18nKeys.ui['3ds_verification_required']));
  readonly bankRequiresVerificationText = computed(() =>
    this.i18n.t(I18nKeys.ui.bank_requires_verification),
  );
  readonly threeDsVersionLabel = computed(() => this.i18n.t(I18nKeys.ui['3ds_version']));
  readonly completeVerificationLabel = computed(() =>
    this.i18n.t(I18nKeys.ui.complete_verification),
  );

  readonly paypalApprovalTitle = computed(() => this.i18n.t(I18nKeys.ui.paypal_approval_required));
  readonly redirectedToPaypalText = computed(() => this.i18n.t(I18nKeys.ui.redirected_to_paypal));
  readonly orderIdLabel = computed(() => this.i18n.t(I18nKeys.ui.order_id));
  readonly goToPaypalLabel = computed(() => this.i18n.t(I18nKeys.ui.go_to_paypal));
  readonly afterApproveVerifyText = computed(() => this.i18n.t(I18nKeys.ui.after_approve_verify));

  readonly actionRequiredLabel = computed(() => this.i18n.t(I18nKeys.ui.action_required));
  readonly actionRequiresAttentionText = computed(() =>
    this.i18n.t(I18nKeys.ui.action_requires_attention),
  );
  readonly viewActionDetailsLabel = computed(() => this.i18n.t(I18nKeys.ui.view_action_details));

  onPayPalClick(): void {
    const action = this.nextAction();
    if (!action) return;

    if (action.type === 'paypal_approve') {
      const maybe = action as { approveUrl?: unknown };
      if (typeof maybe.approveUrl === 'string' && maybe.approveUrl.length > 0) {
        this.paypalRequested.emit(maybe.approveUrl);
      }
    }
  }
}
