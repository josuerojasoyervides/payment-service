import { inject, Injectable } from '@angular/core';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { PAYMENT_PROVIDER_FACTORIES } from '../tokens/payment-provider-factories.token';

@Injectable({ providedIn: 'root' })
export class ProviderFactoryRegistry {
    private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);

    get(providerId: PaymentProviderId): ProviderFactory {
        const matches = this.factories.filter(f => f.providerId === providerId);
        this.validateFactoryList(matches, providerId);
        return matches[0];
    }

    private validateFactoryList(matches: ProviderFactory[], providerId: PaymentProviderId): void {
        if (matches.length === 0) throw new Error(`Provider factory for ${providerId} not found.`);
        if (matches.length > 1) {
            const providers = matches.map(m => m.providerId).join(', ');
            throw new Error(`Duplicate provider factories for ${providerId}. Matches: [${providers}]`);
        }
    }
}
