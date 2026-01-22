import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Obtener estado de un pago.
 *
 * Consulta el estado actual de un PaymentIntent dentro de un provider específico.
 * - Polling después de 3DS
 * - Verificar estado de SPEI
 * - Refrescar UI después de retorno de PayPal
 *
 * ✅ No aplica fallback aquí: el intent ya vive en un provider determinado.
 * Si falla, se propaga el error y el Store/UI decide cómo presentarlo.
 */
@Injectable()
export class GetPaymentStatusUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: GetPaymentStatusRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: GetPaymentStatusRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ?? this.idempotencyKeyFactory.generateForGet(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.getIntent(requestWithIdempotency);
    });
  }
}
