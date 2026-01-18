import { inject, Injectable } from '@angular/core';
import { CancelPaymentRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Cancelar un pago.
 *
 * Cancela un PaymentIntent que aún no ha sido completado.
 * - En Stripe: Cancela el PaymentIntent
 * - En PayPal: Voida la Order (si no ha sido capturada)
 */
@Injectable()
export class CancelPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);

    /**
     * Cancela un pago existente.
     *
     * @param req Request con el intentId a cancelar
     * @param providerId Proveedor del pago original
     */
    execute(req: CancelPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.cancelIntent(req);
        });
    }
}