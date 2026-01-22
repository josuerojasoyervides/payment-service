import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Confirmar un pago.
 *
 * Confirma un PaymentIntent en un provider específico:
 * - Stripe: confirma PaymentIntent
 * - PayPal: captura la Order aprobada
 *
 * ✅ No aplica fallback aquí: el intent ya existe en un provider determinado.
 * Si falla, se propaga el error y el Store/UI decide cómo presentarlo.
 */
@Injectable()
export class ConfirmPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: ConfirmPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: ConfirmPaymentRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ??
          this.idempotencyKeyFactory.generateForConfirm(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.confirmIntent(requestWithIdempotency);
    });
  }
}
