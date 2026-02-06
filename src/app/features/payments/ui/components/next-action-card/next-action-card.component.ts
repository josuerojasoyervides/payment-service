import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import type {
  NextAction,
  NextActionManualStepDetails,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import { I18nKeys, I18nPipe, I18nService } from '@core/i18n';
import { SpeiInstructionsComponent } from '@payments/ui/components/spei-instructions/spei-instructions.component';

@Component({
  selector: 'app-next-action-card',
  standalone: true,
  imports: [CommonModule, I18nPipe, SpeiInstructionsComponent],
  templateUrl: './next-action-card.component.html',
})
export class NextActionCardComponent {
  private readonly i18n = inject(I18nService);

  readonly nextAction = input<NextAction | null>(null);
  readonly showRetry = input<boolean>(false);

  readonly actionRequested = output<NextAction>();

  readonly actionRequiredLabel = computed(() => this.i18n.t(I18nKeys.ui.action_required));
  readonly actionRequiresAttentionText = computed(() =>
    this.i18n.t(I18nKeys.ui.action_requires_attention),
  );
  readonly viewActionDetailsLabel = computed(() => this.i18n.t(I18nKeys.ui.view_action_details));
  readonly continueLabel = computed(() => this.i18n.t(I18nKeys.ui.continue_action));
  readonly confirmLabel = computed(() => this.i18n.t(I18nKeys.ui.confirm_button));
  readonly retryVerificationLabel = computed(() => this.i18n.t(I18nKeys.ui.retry_verification));
  readonly processingLabel = computed(() => this.i18n.t(I18nKeys.ui.processing));
  readonly redirectUrl = computed(() => {
    const action = this.nextAction();
    return action?.kind === 'redirect' ? action.url : null;
  });
  readonly manualStepDetails = computed<NextActionManualStepDetails | null>(() => {
    const action = this.nextAction();
    return action?.kind === 'manual_step' ? (action.details ?? null) : null;
  });
  readonly manualStepInstructions = computed<string[]>(() => {
    const action = this.nextAction();
    return action?.kind === 'manual_step' ? (action.instructions ?? []) : [];
  });
  readonly externalWaitHint = computed(() => {
    const action = this.nextAction();
    return action?.kind === 'external_wait' ? (action.hint ?? null) : null;
  });
  readonly actionKindLabel = computed(() => this.nextAction()?.kind ?? 'unknown');
  readonly clientConfirmButtonLabel = computed(() =>
    this.showRetry() ? this.retryVerificationLabel() : this.confirmLabel(),
  );

  onActionRequested(): void {
    const action = this.nextAction();
    if (!action) return;
    this.actionRequested.emit(action);
  }
}
