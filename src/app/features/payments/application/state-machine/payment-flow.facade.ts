import { computed, inject, Injectable } from '@angular/core';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { StrategyContext } from '../ports/payment-strategy.port';
import { PaymentFlowActorService } from './payment-flow.actor.service';
import { PaymentFlowPublicEvent } from './payment-flow.types';

// Si ya tienes un tipo formal para flowContext en tu proyecto, úsalo aquí.
// Si no, esta es una versión mínima para no usar `any`.
export type PaymentFlowContext = StrategyContext;

@Injectable()
export class PaymentFlowFacade {
  private readonly flow = inject(PaymentFlowActorService);

  readonly snapshot = this.flow.snapshot;

  readonly intent = computed(() => this.snapshot().context.intent);
  readonly error = computed(() => this.snapshot().context.error);
  readonly providerId = computed(() => this.snapshot().context.providerId);

  // flags macro
  readonly isIdle = this.flow.isIdle;
  readonly isLoading = this.flow.isLoading;
  readonly isReady = this.flow.isReady;
  readonly hasError = this.flow.hasError;

  // helpers UI
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

  reset(): boolean {
    return this.flow.send({ type: 'RESET' } satisfies PaymentFlowPublicEvent);
  }
}
