import { inject, Injectable } from '@angular/core';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';

@Injectable()
export class ProviderMethodPolicyRegistry {
  private readonly policies = inject<ProviderMethodPolicyPort[]>(PAYMENT_PROVIDER_METHOD_POLICIES);
  private readonly factories = inject(ProviderFactoryRegistry);
  private readonly policyMap = new Map<string, ProviderMethodPolicy>();

  constructor() {
    this.buildPolicyMap();
  }

  getPolicy(providerId: PaymentProviderId, method: PaymentMethodType): ProviderMethodPolicy {
    const key = `${providerId}:${method}`;
    const policy = this.policyMap.get(key);
    if (!policy) {
      throw new Error(`No policy found for provider "${providerId}" and method "${method}".`);
    }
    return policy;
  }

  listPolicies(): ProviderMethodPolicy[] {
    return Array.from(this.policyMap.values());
  }

  private buildPolicyMap(): void {
    for (const policyProvider of this.policies) {
      const providerId = policyProvider.providerId;
      const methods = this.getSupportedMethods(providerId);

      for (const method of methods) {
        try {
          const policy = policyProvider.getPolicy(method);
          const key = `${providerId}:${policy.method}`;
          if (this.policyMap.has(key)) {
            throw new Error(`Duplicate policy for "${key}".`);
          }
          this.policyMap.set(key, policy);
        } catch {
          // method not supported by this provider
        }
      }
    }
  }

  private getSupportedMethods(providerId: PaymentProviderId): PaymentMethodType[] {
    try {
      return this.factories.get(providerId).getSupportedMethods();
    } catch {
      return [];
    }
  }
}
