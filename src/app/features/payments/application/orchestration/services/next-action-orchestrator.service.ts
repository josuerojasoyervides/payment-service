import { inject, Injectable } from '@angular/core';
import { NextAction } from '@payments/domain/models/payment/payment-action.types';
import { createPaymentError } from '@payments/domain/models/payment/payment-error.factory';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { Observable, throwError } from 'rxjs';

import { FINALIZE_PORTS } from '../../api/tokens/finalize.token';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/** Stable i18n key for unsupported client confirm (application must not import i18n.t). */
const UNSUPPORTED_CLIENT_CONFIRM_MESSAGE_KEY = 'errors.unsupported_client_confirm';

@Injectable()
export class NextActionOrchestratorService {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly finalizePorts = inject(FINALIZE_PORTS);

  requestClientConfirm(action: NextAction, context: PaymentFlowContext): Observable<PaymentIntent> {
    if (action.kind !== 'client_confirm') {
      return throwError(() => new Error('Client confirmation requires a client_confirm action'));
    }

    const providerId = context.providerId;
    if (!providerId) {
      return throwError(() => new Error('Missing providerId for client confirmation'));
    }

    const handler = this.getClientConfirmHandler(providerId);
    if (!handler) {
      return throwError(() =>
        createPaymentError(
          'unsupported_client_confirm',
          UNSUPPORTED_CLIENT_CONFIRM_MESSAGE_KEY,
          undefined,
          null,
        ),
      );
    }

    return handler.execute({ providerId, action, context });
  }

  /** Resolves client-confirm handler via provider factory capability; no provider-name branching. */
  private getClientConfirmHandler(providerId: PaymentProviderId) {
    if (!this.registry.has(providerId)) return null;
    const factory = this.registry.get(providerId);
    return factory.getClientConfirmHandler?.() ?? null;
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
    return ports.find((p) => p.providerId === providerId) ?? null;
  }
}
