import { inject, Injectable } from '@angular/core';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { PAYMENT_PROVIDER_FACTORIES } from '../tokens/payment-provider-factories.token';

@Injectable({ providedIn: 'root' })
export class ProviderFactoryRegistry {
    private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);

    get(providerId: PaymentProviderId): ProviderFactory {
        const factory = this.factories.find(x => x.providerId === providerId);
        if (!factory) throw new Error(`Provider factory for ${providerId} not found.`);
        return factory;
    }
}
