import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import {
  GetPaymentStatusRequest,
  PaymentError,
  PaymentIntent,
  PaymentProviderId,
} from '../../domain/models';
import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

/**
 * Caso de uso: Obtener estado de un pago.
 *
 * Consulta el estado actual de un PaymentIntent.
 * Útil para:
 * - Polling después de 3DS
 * - Verificar estado de SPEI
 * - Refrescar UI después de retorno de PayPal
 *
 * Maneja errores recuperables y reporta al orchestrator para consistencia,
 * aunque el fallback no aplica directamente (el intent ya existe en un provider específico).
 */
@Injectable()
export class GetPaymentStatusUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly fallbackOrchestrator = inject(FallbackOrchestratorService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  /**
   * Obtiene el estado actual de un pago.
   *
   * @param req Request con el intentId a consultar
   * @param providerId Proveedor del pago
   */
  execute(req: GetPaymentStatusRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      // Generate idempotency key if not already provided (although GET typically doesn't need it)
      const requestWithIdempotency: GetPaymentStatusRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ?? this.idempotencyKeyFactory.generateForGet(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.getIntent(requestWithIdempotency);
    }).pipe(
      catchError((error: PaymentError) => {
        // Reportar fallo al orchestrator para consistencia
        // Aunque el fallback no aplica directamente para get-status (el intent ya existe),
        // reportamos para tracking y posibles acciones futuras
        this.fallbackOrchestrator.reportFailure(
          providerId,
          error,
          // Para get-status, no hay un CreatePaymentRequest original
          // Pasamos un request mínimo para mantener la estructura
          {
            orderId: req.intentId, // Usamos intentId como orderId temporal
            amount: 0, // No disponible en get-status request
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
