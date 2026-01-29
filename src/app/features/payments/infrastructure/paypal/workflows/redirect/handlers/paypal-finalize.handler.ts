import { inject, Injectable } from '@angular/core';
import type { FinalizePort, FinalizeRequest } from '@payments/application/api/ports/finalize.port';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/workflows/order/facades/intent.facade';
import type { Observable } from 'rxjs';

/**
 * PayPal finalize handler.
 *
 * In PayPal redirect flow, "finalize" maps to capturing (confirming) the order.
 * Provider-specific details stay in infrastructure; application routes via factory capability.
 */
@Injectable()
export class PaypalFinalizeHandler implements FinalizePort {
  readonly providerId: PaymentProviderId = 'paypal' as const;

  private readonly gateway = inject(PaypalIntentFacade);

  execute(request: FinalizeRequest): Observable<PaymentIntent> {
    const orderId = this.resolveOrderId(request);
    return this.gateway.confirmIntent({ intentId: orderId });
  }

  private resolveOrderId(request: FinalizeRequest): string {
    const providerRefs = request.context.providerRefs?.[request.providerId] ?? null;
    const fromRefs =
      providerRefs?.orderId ?? providerRefs?.intentId ?? providerRefs?.paymentId ?? null;
    const fromExternalRef = request.context.externalReference ?? null;

    const orderId = fromRefs ?? fromExternalRef;
    if (!orderId) {
      throw invalidRequestError('errors.intent_id_required', { field: 'context.providerRefs' });
    }

    return orderId;
  }
}
