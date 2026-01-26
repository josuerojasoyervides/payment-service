import { computed, DestroyRef, inject, Injectable, Signal, signal } from '@angular/core';
import { LoggerService } from '@core/logging';
import { CancelPaymentUseCase } from '@payments/application/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@payments/application/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@payments/application/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/use-cases/start-payment.use-case';
import { firstValueFrom } from 'rxjs';
import { createActor } from 'xstate';

import {
  isPaymentFlowSnapshot,
  isSnapshotInspectionEventWithSnapshot,
} from './payment-flow.guards';
import { createPaymentFlowMachine } from './payment-flow.machine';
import {
  PaymentFlowActorRef,
  PaymentFlowEvent,
  PaymentFlowMachine,
  PaymentFlowPublicEvent,
  PaymentFlowSnapshot,
} from './payment-flow.types';

@Injectable()
export class PaymentFlowActorService {
  private readonly start = inject(StartPaymentUseCase);
  private readonly confirm = inject(ConfirmPaymentUseCase);
  private readonly cancel = inject(CancelPaymentUseCase);
  private readonly status = inject(GetPaymentStatusUseCase);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly machine: PaymentFlowMachine = createPaymentFlowMachine({
    startPayment: async (providerId, request, flowContext) =>
      firstValueFrom(this.start.execute(request, providerId, flowContext)),
    confirmPayment: async (providerId, request) =>
      firstValueFrom(this.confirm.execute(request, providerId)),
    cancelPayment: async (providerId, request) =>
      firstValueFrom(this.cancel.execute(request, providerId)),
    getStatus: async (providerId, request) =>
      firstValueFrom(this.status.execute(request, providerId)),
  });

  private prevSnapshot: PaymentFlowSnapshot | null = null;

  private readonly actor: PaymentFlowActorRef = createActor(this.machine, {
    inspect: (insp) => {
      if (!isSnapshotInspectionEventWithSnapshot(insp, isPaymentFlowSnapshot)) return;

      const snap = insp.snapshot as PaymentFlowSnapshot;
      const prevState = this.prevSnapshot?.value ?? null;
      const changed = this.prevSnapshot?.value !== snap.value;
      const tags = snap.tags ? Array.from(snap.tags) : undefined;

      this.logger.info(
        'PaymentFlowMachine transition',
        'PaymentFlowActorService',
        {
          event: insp.event,
          state: snap.value,
          prevState,
          changed,
          ...(tags && { tags }),
          context: snap.context,
        },
        this.logger.getCorrelationId(),
      );

      this.prevSnapshot = snap;
    },
  });

  private _snapshot = signal(this.actor.getSnapshot() as PaymentFlowSnapshot);
  readonly snapshot: Signal<PaymentFlowSnapshot> = this._snapshot.asReadonly();
  readonly lastSentEvent = signal<PaymentFlowEvent | null>(null);

  readonly isIdle = computed(() => this.snapshot().hasTag('idle'));
  readonly isLoading = computed(() => this.snapshot().hasTag('loading'));
  readonly isReady = computed(() => this.snapshot().hasTag('ready'));
  readonly hasError = computed(() => this.snapshot().hasTag('error'));

  constructor() {
    this.actor.start();

    this.prevSnapshot = this.actor.getSnapshot() as PaymentFlowSnapshot;
    this.actor.subscribe((snapshot) => {
      this._snapshot.set(snapshot);
    });
    this.destroyRef.onDestroy(() => {
      this.logger.info('Stopping payment flow actor', 'PaymentFlowActorService');
      this.actor.stop();
    });
  }

  send(event: PaymentFlowPublicEvent): boolean {
    const snap = this.snapshot();

    const prevState = this.prevSnapshot?.value ?? null;
    const changed = false; // No hay transición cuando el evento es ignorado
    const tags = snap.tags ? Array.from(snap.tags) : undefined;

    if (!snap.can(event)) {
      this.logger.warn(
        'Event ignored by machine (cannot transition)',
        'PaymentFlowActorService',
        {
          event,
          state: snap.value,
          prevState,
          changed,
          ...(tags && { tags }),
          context: snap.context,
        },
        this.logger.getCorrelationId(),
      );
      return false;
    }

    this.lastSentEvent.set(event);
    this.actor.send(event);
    return true;
  }
}
