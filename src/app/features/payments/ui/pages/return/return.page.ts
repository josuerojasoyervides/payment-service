import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { mapReturnQueryToReference } from '../../../application/events/external/payment-flow-return.mapper';
import { PaymentFlowFacade } from '../../../application/state-machine/payment-flow.facade';
import { PaymentIntentCardComponent } from '../../components/payment-intent-card/payment-intent-card.component';

function normalizeQueryParams(params: Params): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) out[k] = v.join(',');
    else if (v == null) out[k] = '';
    else out[k] = String(v);
  }
  return out;
}

type RedirectStatus = PaymentIntent['status'] | null;

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

  // Query params
  readonly intentId = signal<string | null>(null);
  readonly paypalToken = signal<string | null>(null);
  readonly paypalPayerId = signal<string | null>(null);
  readonly redirectStatus = signal<RedirectStatus>(null);
  readonly allParams = signal<Record<string, string>>({});

  // Route data
  readonly isReturnFlow = signal(false);
  readonly isCancelFlow = signal(false);

  // State
  readonly currentIntent = this.flow.intent;
  readonly isLoading = this.flow.isLoading;

  // Computed
  readonly isCancel = computed(() => {
    if (this.isCancelFlow()) return true;
    return this.redirectStatus() === 'canceled';
  });

  readonly isSuccess = computed(() => {
    const intent = this.currentIntent();
    if (intent) return intent.status === 'succeeded';
    return this.redirectStatus() === 'succeeded';
  });

  readonly flowType = computed(() => {
    if (this.paypalToken()) return this.i18n.t(I18nKeys.ui.flow_paypal_redirect);
    if (this.intentId()) return this.i18n.t(I18nKeys.ui.flow_3ds);
    return this.i18n.t(I18nKeys.ui.flow_unknown);
  });

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.isReturnFlow.set(!!data['returnFlow']);
    this.isCancelFlow.set(!!data['cancelFlow']);

    const params = this.route.snapshot.queryParams;
    this.allParams.set(normalizeQueryParams(params));

    this.intentId.set(params['payment_intent'] || params['setup_intent'] || null);
    const rs = params['redirect_status'];
    if (rs === 'succeeded' || rs === 'canceled' || rs === 'failed') {
      this.redirectStatus.set(rs);
    } else {
      this.redirectStatus.set(null);
    }

    this.paypalToken.set(params['token'] || null);
    this.paypalPayerId.set(params['PayerID'] || null);

    const reference = mapReturnQueryToReference(params);
    if (reference.referenceId && !this.isCancelFlow()) {
      this.flow.refresh(reference.providerId, reference.referenceId);
    }
  }

  confirmPayment(_intentId: string): void {
    this.flow.confirm();
  }

  refreshPaymentByReference(referenceId: string): void {
    const reference = mapReturnQueryToReference(this.route.snapshot.queryParams);
    const providerId = reference.referenceId ? reference.providerId : 'stripe';
    this.flow.refresh(providerId, referenceId);
  }

  readonly newPaymentButtonText = computed(() => this.i18n.t(I18nKeys.ui.new_payment_button));

  readonly retryPaymentText = computed(() => this.i18n.t(I18nKeys.ui.retry_payment));

  readonly viewHistoryText = computed(() => this.i18n.t(I18nKeys.ui.view_history));

  readonly paymentCanceledText = computed(() => this.i18n.t(I18nKeys.ui.payment_canceled));

  readonly paymentCanceledMessageText = computed(() =>
    this.i18n.t(I18nKeys.ui.payment_canceled_message),
  );

  readonly paymentCompletedText = computed(() => this.i18n.t(I18nKeys.ui.payment_completed));

  readonly paymentCompletedMessageText = computed(() =>
    this.i18n.t(I18nKeys.ui.payment_completed_message),
  );

  readonly verifyingPaymentText = computed(() => this.i18n.t(I18nKeys.ui.verifying_payment));

  readonly verifyingPaymentMessageText = computed(() =>
    this.i18n.t(I18nKeys.ui.verifying_payment_message),
  );

  readonly returnInformationText = computed(() => this.i18n.t(I18nKeys.ui.return_information));

  readonly paymentStatusText = computed(() => this.i18n.t(I18nKeys.ui.payment_status));

  readonly viewAllParamsText = computed(() => this.i18n.t(I18nKeys.ui.view_all_params));

  readonly flowTypeText = computed(() => this.i18n.t(I18nKeys.ui.flow_type));

  readonly statusLabelText = computed(() => this.i18n.t(I18nKeys.ui.status_label));

  readonly canceledText = computed(() => this.i18n.t(I18nKeys.ui.canceled));

  readonly completedText = computed(() => this.i18n.t(I18nKeys.ui.completed));

  readonly processingText = computed(() => this.i18n.t(I18nKeys.ui.processing));

  readonly intentIdLabel = computed(() => this.i18n.t(I18nKeys.ui.intent_id));

  readonly paypalTokenLabel = computed(() => this.i18n.t(I18nKeys.ui.paypal_token));

  readonly paypalPayerIdLabel = computed(() => this.i18n.t(I18nKeys.ui.paypal_payer_id));
}
