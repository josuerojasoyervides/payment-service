import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import { PaypalIntentFacade } from '@app/features/payments/infrastructure/paypal/workflows/order/order.facade';
import type { FinalizePort, FinalizeRequest } from '@payments/application/api/ports/finalize.port';
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
