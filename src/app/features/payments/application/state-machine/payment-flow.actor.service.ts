import { inject, Injectable, signal } from '@angular/core';
import { LoggerService } from '@core/logging';
import { CancelPaymentUseCase } from '@payments/application/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@payments/application/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@payments/application/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/use-cases/start-payment.use-case';
import { firstValueFrom } from 'rxjs';
import { createActor, SnapshotFrom } from 'xstate';

import { createPaymentFlowMachine } from './payment-flow.machine';

@Injectable()
export class PaymentFlowActorService {
  private actor = createActor(
    createPaymentFlowMachine({
      startPayment: async (providerId, request, flowContext) =>
        firstValueFrom(this.start.execute(request, providerId, flowContext)),

      confirmPayment: async (providerId, request) =>
        firstValueFrom(this.confirm.execute(request, providerId)),

      cancelPayment: async (providerId, request) =>
        firstValueFrom(this.cancel.execute(request, providerId)),

      getStatus: async (providerId, request) =>
        firstValueFrom(this.status.execute(request, providerId)),
    }),
  );

  snapshot = signal(this.actor.getSnapshot());

  private readonly start = inject(StartPaymentUseCase);
  private readonly confirm = inject(ConfirmPaymentUseCase);
  private readonly cancel = inject(CancelPaymentUseCase);
  private readonly status = inject(GetPaymentStatusUseCase);
  private readonly logger = inject(LoggerService);

  constructor() {
    this.actor.subscribe((snapshot: SnapshotFrom<typeof createPaymentFlowMachine>) => {
      this.snapshot.set(snapshot);
      this.loggerMessage(snapshot);
      this.actor.start();
    });
  }

  send(event: Parameters<typeof this.actor.send>[0]) {
    this.actor.send(event);
  }

  loggerMessage(snapshot: SnapshotFrom<typeof createPaymentFlowMachine>) {
    this.logger.info(
      'PaymentFlowMachine snapshot updated',
      'PaymentFlowActorService',
      {
        state: snapshot.value,
        context: snapshot.context,
        event: snapshot.machine,
      },
      this.logger.getCorrelationId(),
    );
  }
}
