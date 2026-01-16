import { inject, Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentIntent } from '../../domain/models/payment.types';
import { defer, Observable } from 'rxjs';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

@Injectable({ providedIn: 'root' })
export class StartPaymentUseCase {
    private readonly defaultProvider = 'stripe' as const;
    private readonly registry = inject(ProviderFactoryRegistry);

    execute(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return defer(() => {
            const providerFactory = this.registry.get(this.defaultProvider);
            const strategy = providerFactory.createStrategy(req.method.type);
            return strategy.start(req);
        })
    }
}