import { CommonModule } from '@angular/common';
import type { OnInit } from '@angular/core';
import { Component, computed, inject } from '@angular/core';
import type { Params } from '@angular/router';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { mapReturnQueryToReference } from '../../../application/adapters/events/external/payment-flow-return.mapper';
import { ExternalEventAdapter } from '../../../application/adapters/external-event.adapter';
import { PaymentFlowFacade } from '../../../application/orchestration/flow/payment-flow.facade';
import { PaymentIntentCardComponent } from '../../components/payment-intent-card/payment-intent-card.component';

// TODO : This is a utility function, not a component responsibility
function normalizeQueryParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) out[k] = v.join(',');
    else if (v == null) out[k] = '';
    else out[k] = String(v);
  }
  return out;
}

// TODO : This is a utility type, not a component responsibility
type RedirectStatus = PaymentIntent['status'] | null;

interface ReturnPageState {
  // Query params
  intentId: string | null;
  paypalToken: string | null;
  paypalPayerId: string | null;
  redirectStatus: RedirectStatus;
  allParams: Record<string, string>;
  // Route data
  isReturnFlow: boolean;
  isCancelFlow: boolean;
}

/**
 * Return page for 3DS and PayPal callbacks.
 *
 * This page handles returns from:
 * - 3D Secure authentication
 * - PayPal approval/cancel
 *
 * Reads query params to determine status and
 * displays the appropriate result.
 */
@Component({
  selector: 'app-return',
  standalone: true,
  imports: [CommonModule, RouterLink, PaymentIntentCardComponent],
  templateUrl: './return.component.html',
})
export class ReturnComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly flow = inject(PaymentFlowFacade);
  private readonly i18n = inject(I18nService);
  private readonly externalEvents = inject(ExternalEventAdapter);

  // Page State
  readonly returnPageState = signalState<ReturnPageState>({
    // Query params
    intentId: null,
    paypalToken: null,
    paypalPayerId: null,
    redirectStatus: null,
    allParams: {},

    // Route data
    isReturnFlow: false,
    isCancelFlow: false,
  });

  // Global State
  readonly flowState = deepComputed(() => ({
    currentIntent: this.flow.intent(),
    isLoading: this.flow.isLoading(),
  }));

  // Computed
  readonly isCancel = computed(() => {
    if (this.returnPageState.isCancelFlow()) return true;
    if (this.returnPageState.redirectStatus() === 'canceled') return true;
    return false;
  });

  readonly isSuccess = computed(() => {
    const intent = this.flowState.currentIntent();
    if (intent) return intent.status === 'succeeded';
    if (this.returnPageState.redirectStatus() === 'succeeded') return true;
    return false;
  });

  readonly flowType = computed(() => {
    if (this.returnPageState.paypalToken()) return this.i18n.t(I18nKeys.ui.flow_paypal_redirect);
    if (this.returnPageState.intentId()) return this.i18n.t(I18nKeys.ui.flow_3ds);
    return this.i18n.t(I18nKeys.ui.flow_unknown);
  });

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    const params = this.route.snapshot.queryParams;

    const rs = params['redirect_status'];
    const redirectStatus = rs === 'succeeded' || rs === 'canceled' || rs === 'failed' ? rs : null;
    patchState(this.returnPageState, {
      intentId: params['payment_intent'] || params['setup_intent'] || null,
      paypalToken: params['token'] || null,
      paypalPayerId: params['PayerID'] || null,
      redirectStatus: redirectStatus,
      allParams: normalizeQueryParams(params),

      isReturnFlow: !!data['returnFlow'],
      isCancelFlow: !!data['cancelFlow'],
    });

    const reference = mapReturnQueryToReference(params);
    if (reference.referenceId) {
      this.externalEvents.redirectReturned({
        providerId: reference.providerId,
        referenceId: reference.referenceId,
      });
    }
  }

  confirmPayment(_intentId: string): void {
    this.flow.confirm();
  }

  refreshPaymentByReference(referenceId: string): void {
    const reference = mapReturnQueryToReference(this.route.snapshot.queryParams);
    const providerId = reference.providerId;
    this.flow.refresh(providerId, referenceId);
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

    canceled: this.i18n.t(I18nKeys.ui.canceled),
    completed: this.i18n.t(I18nKeys.ui.completed),
    processing: this.i18n.t(I18nKeys.ui.processing),

    intentIdLabel: this.i18n.t(I18nKeys.ui.intent_id),
    paypalTokenLabel: this.i18n.t(I18nKeys.ui.paypal_token),
    paypalPayerIdLabel: this.i18n.t(I18nKeys.ui.paypal_payer_id),
  }));
}
