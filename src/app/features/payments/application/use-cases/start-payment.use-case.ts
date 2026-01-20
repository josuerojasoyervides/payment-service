import { inject, Injectable } from '@angular/core';
import { PaymentIntent, PaymentProviderId, CreatePaymentRequest, PaymentError } from '../../domain/models';
import { defer, Observable, catchError, throwError } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { StrategyContext } from '../../domain/ports';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

/**
 * Caso de uso: Iniciar un pago.
 *
 * Orquesta el flujo completo:
 * 1. Obtiene la factory del provider
 * 2. Crea la estrategia para el método de pago
 * 3. Ejecuta el flujo de inicio (validate → prepare → createIntent)
 * 4. Maneja errores y fallback automático/manual
 *
 * No usa providedIn: 'root' para:
 * - Permitir testing más fácil con diferentes configuraciones
 * - Evitar singletons globales que persisten estado
 * - Dar control explícito del lifecycle al módulo de payments
 */
@Injectable()
export class StartPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly fallbackOrchestrator = inject(FallbackOrchestratorService);

    /**
     * Inicia un nuevo pago.
     *
     * @param req Request con los datos del pago
     * @param providerId Proveedor a usar (stripe, paypal)
     * @param context Contexto opcional (returnUrl, deviceData, etc.)
     * @param wasAutoFallback Indica si este intento es un auto-fallback
     */
    execute(
        req: CreatePaymentRequest,
        providerId: PaymentProviderId,
        context?: StrategyContext,
        wasAutoFallback: boolean = false
    ): Observable<PaymentIntent> {
        return defer(() => {
            const providerFactory = this.registry.get(providerId);
            const strategy = providerFactory.createStrategy(req.method.type);
            return strategy.start(req, context);
        }).pipe(
            catchError((error: PaymentError) => {
                // Reportar fallo al orchestrator
                // El orchestrator determinará si hay fallback disponible (auto o manual)
                this.fallbackOrchestrator.reportFailure(
                    providerId,
                    error,
                    req,
                    wasAutoFallback
                );

                // Siempre propagar el error
                // El store verificará si hay fallback disponible antes de mostrar el error
                // Si hay fallback auto, el orchestrator emitirá fallbackExecute$ y el store lo manejará
                // Si hay fallback manual, el orchestrator emitirá fallbackAvailable$ y la UI lo manejará
                return throwError(() => error);
            })
        );
    }
}