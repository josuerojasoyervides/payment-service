import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Cancelar un pago.
 *
 * Cancela un PaymentIntent dentro de un provider específico:
 * - Stripe: cancela PaymentIntent
 * - PayPal: void/cancel de Order si no ha sido capturada
 *
 * ✅ No aplica fallback aquí: el intent ya vive en un provider determinado.
 * Si falla, se propaga el error y el Store/UI decide cómo presentarlo.
 */
@Injectable()
export class CancelPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: CancelPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: CancelPaymentRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ??
          this.idempotencyKeyFactory.generateForCancel(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.cancelIntent(requestWithIdempotency);
    });
  }
}
