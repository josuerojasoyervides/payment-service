import { inject, Injectable, signal } from '@angular/core';
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

  private readonly actor: PaymentFlowActorRef = createActor(this.machine, {
    inspect: (insp) => {
      if (!isSnapshotInspectionEventWithSnapshot(insp, isPaymentFlowSnapshot)) return;

      const snap = insp.snapshot as PaymentFlowSnapshot;

      this.logger.info(
        'PaymentFlowMachine transition',
        'PaymentFlowActorService',
        {
          event: insp.event,
          state: snap.value,
          context: snap.context,
        },
        this.logger.getCorrelationId(),
      );
    },
  });

  private readonly initialSnapshot = this.actor.getSnapshot();

  snapshot = signal<PaymentFlowSnapshot>(this.initialSnapshot);
  lastSentEvent = signal<PaymentFlowEvent | null>(null);

  constructor() {
    this.actor.subscribe((snapshot) => {
      this.snapshot.set(snapshot);
      this.logger.info('PaymentFlowMachine snapshot updated', 'PaymentFlowActorService', {
        state: snapshot.value,
        context: snapshot.context,
        lastSentEvent: this.lastSentEvent(),
      });
    });

    this.actor.start();
  }

  send(event: PaymentFlowPublicEvent): boolean {
    const snap = this.actor.getSnapshot();

    if (!snap.can(event)) {
      this.logger.warn(
        'Event ignored by machine (cannot transition)',
        'PaymentFlowActorService',
        { event, state: snap.value, context: snap.context },
        this.logger.getCorrelationId(),
      );
      return false;
    }

    this.lastSentEvent.set(event);
    this.actor.send(event);
    return true;
  }
}
