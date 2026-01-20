import { inject, Injectable } from '@angular/core';
import { GetPaymentStatusRequest, PaymentIntent, PaymentProviderId } from '../../domain/models';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Obtener estado de un pago.
 *
 * Consulta el estado actual de un PaymentIntent.
 * Útil para:
 * - Polling después de 3DS
 * - Verificar estado de SPEI
 * - Refrescar UI después de retorno de PayPal
 */
@Injectable()
export class GetPaymentStatusUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);

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
        });
    }
}
