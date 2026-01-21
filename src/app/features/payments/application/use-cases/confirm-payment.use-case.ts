import { inject, Injectable } from '@angular/core';
import { ConfirmPaymentRequest, PaymentIntent, PaymentProviderId, PaymentError } from '../../domain/models';
import { defer, Observable, catchError, throwError } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';

/**
 * Caso de uso: Confirmar un pago.
 *
 * Confirma un PaymentIntent que está en estado requires_confirmation.
 * - En Stripe: Confirma el PaymentIntent
 * - En PayPal: Captura la Order aprobada
 *
 * Maneja errores recuperables y reporta al orchestrator para consistencia,
 * aunque el fallback no aplica directamente (el intent ya existe en un provider específico).
 */
@Injectable()
export class ConfirmPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly fallbackOrchestrator = inject(FallbackOrchestratorService);
    private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

    /**
     * Confirma un pago existente.
     *
     * @param req Request con el intentId a confirmar
     * @param providerId Proveedor del pago original
     */
    execute(req: ConfirmPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            // Generate idempotency key if not already provided
            const requestWithIdempotency: ConfirmPaymentRequest = {
                ...req,
                idempotencyKey: req.idempotencyKey ?? this.idempotencyKeyFactory.generateForConfirm(providerId, req.intentId),
            };
            
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.confirmIntent(requestWithIdempotency);
        }).pipe(
            catchError((error: PaymentError) => {
                // Reportar fallo al orchestrator para consistencia
                // Aunque el fallback no aplica directamente para confirm (el intent ya existe),
                // reportamos para tracking y posibles acciones futuras
                // Nota: No pasamos originalRequest porque confirm no crea un nuevo pago
                // El orchestrator puede decidir si reportar o no sin request
                this.fallbackOrchestrator.reportFailure(
                    providerId,
                    error,
                    // Para confirm, no hay un CreatePaymentRequest original
                    // Pasamos un request mínimo para mantener la estructura
                    {
                        orderId: req.intentId, // Usamos intentId como orderId temporal
                        amount: 0, // No disponible en confirm request
                        currency: 'MXN', // Default
                        method: { type: 'card' }, // Default
                    },
                    false
                );

                // Siempre propagar el error
                return throwError(() => error);
            })
        );
    }
}