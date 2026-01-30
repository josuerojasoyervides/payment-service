import { computed, inject, Injectable } from '@angular/core';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type { PaymentFlowPublicEvent } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * PaymentFlowMachineDriver
 *
 * Imperative driver for the XState payment-flow actor.
 *
 * Purpose:
 * - Send machine commands (START, CONFIRM, CANCEL, REFRESH, RESET)
 * - Provide snapshot/flags for debugging, demos, and test harnesses
 * - Perform inherently imperative "next actions" (e.g. browser redirects)
 *
 * Not the UI API:
 * - UI should inject PAYMENT_STATE (PaymentStorePort) for reactive state + actions.
 * - Keeping UI on the port avoids coupling to XState internals and keeps the wiring swappable.
 */
@Injectable()
export class PaymentFlowMachineDriver {
  private readonly flow = inject(PaymentFlowActorService);

  readonly snapshot = this.flow.snapshot;
  readonly lastSentEvent = this.flow.lastSentEvent;

  readonly intent = computed(() => this.snapshot().context.intent);
  readonly error = computed(() => this.snapshot().context.error);
  readonly providerId = computed(() => this.snapshot().context.providerId);

  // flags macro
  readonly isIdle = this.flow.isIdle;
  readonly isLoading = this.flow.isLoading;
  readonly isReady = this.flow.isReady;
  readonly hasError = this.flow.hasError;

  // helpers UI (debug/demo only — UI should prefer the port)
  readonly redirectUrl = computed(() => this.intent()?.redirectUrl ?? null);
  readonly nextAction = computed(() => this.intent()?.nextAction ?? null);

  start(
    providerId: PaymentProviderId,
    request: CreatePaymentRequest,
    flowContext?: PaymentFlowContext,
  ): boolean {
    return this.flow.send({
      type: 'START',
      providerId,
      request,
      flowContext,
    } satisfies PaymentFlowPublicEvent);
  }

  confirm(): boolean {
    const snap = this.snapshot();
    const providerId = snap.context.providerId;
    const intentId = snap.context.intent?.id ?? snap.context.intentId ?? null;

    if (!providerId || !intentId) return false;

    return this.flow.send({
      type: 'CONFIRM',
      providerId,
      intentId,
      returnUrl: snap.context.flowContext?.returnUrl,
    } satisfies PaymentFlowPublicEvent);
  }

  cancel(): boolean {
    const snap = this.snapshot();
    const providerId = snap.context.providerId;
    const intentId = snap.context.intent?.id ?? snap.context.intentId ?? null;

    if (!providerId || !intentId) return false;

    return this.flow.send({
      type: 'CANCEL',
      providerId,
      intentId,
    } satisfies PaymentFlowPublicEvent);
  }

  refresh(providerId: PaymentProviderId, intentId: string): boolean {
    return this.flow.send({
      type: 'REFRESH',
      providerId,
      intentId,
    } satisfies PaymentFlowPublicEvent);
  }

  performNextAction(action: NextAction | null): boolean {
    if (!action) return false;

    if (action.kind === 'redirect') {
      if (!action.url) return false;
      this.navigateToExternal(action.url);
      return true;
    }

    if (action.kind === 'client_confirm') {
      return this.confirm();
    }

    return false;
  }

  reset(): boolean {
    return this.flow.send({ type: 'RESET' } satisfies PaymentFlowPublicEvent);
  }

  private navigateToExternal(url: string): void {
    if (typeof window === 'undefined') return;
    window.location.href = url;
  }
}
