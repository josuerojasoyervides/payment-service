import { inject, Injectable } from '@angular/core';
import { CancelPaymentRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

@Injectable({ providedIn: 'root' })
export class CancelPaymentUseCase {

    private readonly registry = inject(ProviderFactoryRegistry);

    execute(req: CancelPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.cancelIntent(req);
        })
    }
}