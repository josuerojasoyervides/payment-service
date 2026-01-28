import { inject, Injectable } from '@angular/core';
import { NextAction } from '@payments/domain/models/payment/payment-action.types';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { Observable, throwError } from 'rxjs';

import { CLIENT_CONFIRM_PORTS } from '../../api/tokens/client-confirm.token';
import { FINALIZE_PORTS } from '../../api/tokens/finalize.token';

@Injectable()
export class NextActionOrchestratorService {
  private readonly clientConfirmPorts = inject(CLIENT_CONFIRM_PORTS);
  private readonly finalizePorts = inject(FINALIZE_PORTS);

  requestClientConfirm(action: NextAction, context: PaymentFlowContext): Observable<PaymentIntent> {
    if (action.kind !== 'client_confirm') {
      return throwError(() => new Error('Client confirmation requires a client_confirm action'));
    }

    const providerId = context.providerId;
    if (!providerId) {
      return throwError(() => new Error('Missing providerId for client confirmation'));
    }

    const port = this.selectPort(this.clientConfirmPorts, providerId);
    if (!port) {
      return throwError(() => new Error(`No client confirmation port for ${providerId}`));
    }

    return port.execute({ providerId, action, context });
  }

  requestFinalize(context: PaymentFlowContext): Observable<PaymentIntent> {
    const providerId = context.providerId;
    if (!providerId) {
      return throwError(() => new Error('Missing providerId for finalization'));
    }

    const port = this.selectPort(this.finalizePorts, providerId);
    if (!port) {
      return throwError(() => new Error(`No finalize port for ${providerId}`));
    }

    return port.execute({ providerId, context });
  }

  private selectPort<T extends { providerId: PaymentProviderId }>(
    ports: T[],
    providerId: PaymentProviderId,
  ): T | null {
    return ports.find((port) => port.providerId === providerId) ?? null;
  }
}
