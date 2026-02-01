import { inject, Injectable } from '@angular/core';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-action.model';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { FinalizePort } from '@payments/application/api/ports/finalize.port';
import { createPaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';

/** Stable i18n key for unsupported client confirm (application must not import i18n.t). */
const UNSUPPORTED_CLIENT_CONFIRM_MESSAGE_KEY = 'errors.unsupported_client_confirm';
/** Stable i18n key for unsupported finalize (application must not import i18n.t). */
const UNSUPPORTED_FINALIZE_MESSAGE_KEY = 'errors.unsupported_finalize';

@Injectable()
export class NextActionOrchestratorService {
  private readonly registry = inject(ProviderFactoryRegistry);

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

    const handler = this.getFinalizeHandler(providerId);
    if (!handler) {
      return throwError(() =>
        createPaymentError(
          'unsupported_finalize',
          UNSUPPORTED_FINALIZE_MESSAGE_KEY,
          undefined,
          null,
        ),
      );
    }

    return handler.execute({ providerId, context });
  }

  /** Resolves finalize handler via provider factory capability; no provider-name branching. */
  private getFinalizeHandler(providerId: PaymentProviderId): FinalizePort | null {
    if (!this.registry.has(providerId)) return null;
    const factory = this.registry.get(providerId);
    return factory.getFinalizeHandler?.() ?? null;
  }
}
