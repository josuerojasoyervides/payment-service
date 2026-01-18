import { inject, Injectable } from '@angular/core';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { StrategyContext } from '../../domain/ports/payment-strategy.port';

/**
 * Caso de uso: Iniciar un pago.
 *
 * Orquesta el flujo:
 * 1. Obtiene la factory del provider
 * 2. Crea la estrategia para el método de pago
 * 3. Ejecuta el flujo de inicio (validate → prepare → createIntent)
 *
 * No usa providedIn: 'root' para:
 * - Permitir testing más fácil con diferentes configuraciones
 * - Evitar singletons globales que persisten estado
 * - Dar control explícito del lifecycle al módulo de payments
 */
@Injectable()
export class StartPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);

    /**
     * Inicia un nuevo pago.
     *
     * @param req Request con los datos del pago
     * @param providerId Proveedor a usar (stripe, paypal)
     * @param context Contexto opcional (returnUrl, deviceData, etc.)
     */
    execute(
        req: CreatePaymentRequest,
        providerId: PaymentProviderId,
        context?: StrategyContext
    ): Observable<PaymentIntent> {
        return defer(() => {
            const providerFactory = this.registry.get(providerId);
            const strategy = providerFactory.createStrategy(req.method.type);
            return strategy.start(req, context);
        });
    }
}