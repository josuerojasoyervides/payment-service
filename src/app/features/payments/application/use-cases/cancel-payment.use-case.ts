import { inject, Injectable } from '@angular/core';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { catchError, Observable, throwError } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

/**
 * Caso de uso: Cancelar un pago.
 *
 * Cancela un PaymentIntent que aún no ha sido completado.
 * - En Stripe: Cancela el PaymentIntent
 * - En PayPal: Voida la Order (si no ha sido capturada)
 *
 * Maneja errores recuperables y reporta al orchestrator para consistencia,
 * aunque el fallback no aplica directamente (el intent ya existe en un provider específico).
 */
@Injectable()
export class CancelPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly fallbackOrchestrator = inject(FallbackOrchestratorService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  /**
   * Cancela un pago existente.
   *
   * @param req Request con el intentId a cancelar
   * @param providerId Proveedor del pago original
   */
  execute(req: CancelPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      // Generate idempotency key if not already provided
      const requestWithIdempotency: CancelPaymentRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ??
          this.idempotencyKeyFactory.generateForCancel(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.cancelIntent(requestWithIdempotency);
    }).pipe(
      catchError((error: PaymentError) => {
        // Reportar fallo al orchestrator para consistencia
        // Aunque el fallback no aplica directamente para cancel (el intent ya existe),
        // reportamos para tracking y posibles acciones futuras
        this.fallbackOrchestrator.reportFailure(
          providerId,
          error,
          // Para cancel, no hay un CreatePaymentRequest original
          // Pasamos un request mínimo para mantener la estructura
          {
            orderId: req.intentId, // Usamos intentId como orderId temporal
            amount: 0, // No disponible en cancel request
            currency: 'MXN', // Default
            method: { type: 'card' }, // Default
          },
          false,
        );

        // Siempre propagar el error
        return throwError(() => error);
      }),
    );
  }
}
