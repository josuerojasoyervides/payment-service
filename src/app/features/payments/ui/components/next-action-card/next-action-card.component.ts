import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { NextAction } from '../../../domain/models/payment/payment-action.types';

@Component({
  selector: 'app-next-action-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './next-action-card.component.html',
})
export class NextActionCardComponent {
  private readonly i18n = inject(I18nService);

  readonly nextAction = input<NextAction | null>(null);

  readonly actionRequested = output<NextAction>();

  readonly actionRequiredLabel = computed(() => this.i18n.t(I18nKeys.ui.action_required));
  readonly actionRequiresAttentionText = computed(() =>
    this.i18n.t(I18nKeys.ui.action_requires_attention),
  );
  readonly viewActionDetailsLabel = computed(() => this.i18n.t(I18nKeys.ui.view_action_details));
  readonly continueLabel = computed(() => this.i18n.t(I18nKeys.ui.continue_action));
  readonly confirmLabel = computed(() => this.i18n.t(I18nKeys.ui.confirm_button));
  readonly processingLabel = computed(() => this.i18n.t(I18nKeys.ui.processing));

  onActionRequested(): void {
    const action = this.nextAction();
    if (!action) return;
    this.actionRequested.emit(action);
  }
}
