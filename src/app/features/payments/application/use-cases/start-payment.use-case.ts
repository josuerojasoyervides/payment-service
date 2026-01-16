import { inject, Injectable } from '@angular/core';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

@Injectable({ providedIn: 'root' })
export class StartPaymentUseCase {
    private readonly defaultProvider = 'stripe' as const;
    private readonly registry = inject(ProviderFactoryRegistry);

    execute(req: CreatePaymentRequest, providerId: PaymentProviderId = this.defaultProvider): Observable<PaymentIntent> {
        return defer(() => {
            const providerFactory = this.registry.get(providerId);
            const strategy = providerFactory.createStrategy(req.method.type);
            return strategy.start(req);
        })
    }
}