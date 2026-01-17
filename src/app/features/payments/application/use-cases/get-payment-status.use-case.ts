import { inject, Injectable } from '@angular/core';
import { GetPaymentStatusRequest } from '../../domain/models/payment.requests';
import { defer, Observable } from 'rxjs';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

@Injectable({ providedIn: 'root' })
export class GetPaymentStatusUseCase {

    private readonly registry = inject(ProviderFactoryRegistry);

    execute(req: GetPaymentStatusRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
        return defer(() => {
            const gateway = this.registry.get(providerId).getGateway();
            return gateway.getIntent(req);
        })
    }
}
