import { inject, Injectable } from '@angular/core';
import { GetPaymentStatusRequest, PaymentIntent, PaymentProviderId, PaymentError } from '../../domain/models';
import { defer, Observable, catchError, throwError } from 'rxjs';
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

    /**
     * Obtiene el estado actual de un pago.
     *
     * @param req Request con el intentId a consultar
     * @param providerId Proveedor del pago
     */
    execute(req: GetPaymentStatusRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.getIntent(req);
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
                    false
                );

                // Siempre propagar el error
                return throwError(() => error);
            })
        );
    }
}
