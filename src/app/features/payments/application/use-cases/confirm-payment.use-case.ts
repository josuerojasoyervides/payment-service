import { inject, Injectable } from '@angular/core';
import { ConfirmPaymentRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Caso de uso: Confirmar un pago.
 *
 * Confirma un PaymentIntent que está en estado requires_confirmation.
 * - En Stripe: Confirma el PaymentIntent
 * - En PayPal: Captura la Order aprobada
 */
@Injectable()
export class ConfirmPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);

    /**
     * Confirma un pago existente.
     *
     * @param req Request con el intentId a confirmar
     * @param providerId Proveedor del pago original
     */
    execute(req: ConfirmPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.confirmIntent(req);
        });
    }
}