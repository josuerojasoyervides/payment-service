import { CommonModule } from '@angular/common';
import type { OnInit } from '@angular/core';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { PaymentCheckoutCatalogPort } from '@app/features/payments/application/api/ports/payment-store.port';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { I18nKeys, I18nService } from '@core/i18n';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import { FlowDebugPanelComponent } from '@payments/ui/components/flow-debug-panel/flow-debug-panel.component';
import { PaymentIntentCardComponent } from '@payments/ui/components/payment-intent-card/payment-intent-card.component';
import { normalizeQueryParams } from '@payments/ui/shared/normalize-query-params';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

interface ReturnReference {
  providerId: PaymentProviderId;
  referenceId: string | null;
  providerLabel: string;
}

interface ReturnPageState {
  returnReference: ReturnReference | null;
  allParams: Record<string, string>;
  isReturnFlow: boolean;
  isCancelFlow: boolean;
}

/**
 * Return page for redirect callbacks (e.g. 3DS, provider redirect).
 *
 * Provider-agnostic: normalizes query params via util, calls port notifyRedirectReturned
 * and getReturnReferenceFromQuery; displays provider label (from catalog) + referenceId.
 * Cancel/success based on route data (returnFlow/cancelFlow) and intent status from state.
 */
@Component({
  selector: 'app-return',
  standalone: true,
  imports: [CommonModule, RouterLink, FlowDebugPanelComponent, PaymentIntentCardComponent],
  templateUrl: './return.component.html',
})
export class ReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(PAYMENT_STATE);
  private readonly i18n = inject(I18nService);
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG) as PaymentCheckoutCatalogPort;

  readonly returnPageState = signalState<ReturnPageState>({
    returnReference: null,
    allParams: {},
    isReturnFlow: false,
    isCancelFlow: false,
  });

  readonly flowState = deepComputed(() => ({
    currentIntent: this.state.intent(),
    isLoading: this.state.isLoading(),
    error: this.state.error(),
    hasError: this.state.hasError(),
  }));

  readonly isCancel = computed(() => this.returnPageState.isCancelFlow());

  readonly isSuccess = computed(() => {
    const intent = this.flowState.currentIntent();
    return intent?.status === 'succeeded';
  });

  readonly returnFlowTypeLabel = computed(() => {
    const ref = this.returnPageState.returnReference();
    if (ref?.providerLabel) return ref.providerLabel;
    return this.i18n.t(I18nKeys.ui.flow_unknown);
  });

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    const params = this.route.snapshot.queryParams;
    const normalizedParams = normalizeQueryParams(params);

    this.state.notifyRedirectReturned(normalizedParams);

    const { providerId, referenceId } = this.state.getReturnReferenceFromQuery(normalizedParams);
    const descriptor = this.catalog.getProviderDescriptor(providerId);
    const providerLabel = descriptor ? this.i18n.t(descriptor.labelKey) : providerId;

    if (providerId) {
      this.state.selectProvider(providerId);
    }

    patchState(this.returnPageState, {
      returnReference: { providerId, referenceId, providerLabel },
      allParams: normalizedParams,
      isReturnFlow: !!data['returnFlow'],
      isCancelFlow: !!data['cancelFlow'],
    });
  }

  confirmPayment(intentId: string): void {
    this.state.confirmPayment({ intentId });
  }

  refreshPaymentByReference(referenceId: string): void {
    const ref = this.returnPageState.returnReference();
    const providerId = ref?.providerId ?? this.state.selectedProvider();
    if (providerId) {
      this.state.refreshPayment({ intentId: referenceId }, providerId);
    }
  }

  clearErrorAndRetry(): void {
    this.state.clearError();
  }

  getErrorMessage(error: unknown): string {
    return renderPaymentError(this.i18n, error);
  }

  readonly i18nLabels = deepComputed(() => ({
    newPaymentButton: this.i18n.t(I18nKeys.ui.new_payment_button),
    retryPayment: this.i18n.t(I18nKeys.ui.retry_payment),
    viewHistory: this.i18n.t(I18nKeys.ui.view_history),

    paymentCanceled: this.i18n.t(I18nKeys.ui.payment_canceled),
    paymentCanceledMessage: this.i18n.t(I18nKeys.ui.payment_canceled_message),

    paymentCompleted: this.i18n.t(I18nKeys.ui.payment_completed),
    paymentCompletedMessage: this.i18n.t(I18nKeys.ui.payment_completed_message),

    verifyingPayment: this.i18n.t(I18nKeys.ui.verifying_payment),
    verifyingPaymentMessage: this.i18n.t(I18nKeys.ui.verifying_payment_message),

    returnInformation: this.i18n.t(I18nKeys.ui.return_information),
    paymentStatus: this.i18n.t(I18nKeys.ui.payment_status),
    viewAllParams: this.i18n.t(I18nKeys.ui.view_all_params),
    flowTypeLabel: this.i18n.t(I18nKeys.ui.flow_type),
    statusLabel: this.i18n.t(I18nKeys.ui.status_label),
    intentIdLabel: this.i18n.t(I18nKeys.ui.intent_id),
    referenceIdLabel: this.i18n.t(I18nKeys.ui.reference_id),

    canceled: this.i18n.t(I18nKeys.ui.canceled),
    completed: this.i18n.t(I18nKeys.ui.completed),
    processing: this.i18n.t(I18nKeys.ui.processing),

    providerLabel: this.i18n.t(I18nKeys.ui.provider_label),
    tryAgainLabel: this.i18n.t(I18nKeys.ui.try_again),
  }));
}
