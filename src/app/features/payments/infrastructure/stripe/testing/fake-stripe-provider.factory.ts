import { inject, Injectable } from '@angular/core';
import { StripeProviderFactory } from '@app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory';
import { FakeStripeClientConfirmPort } from '@app/features/payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-client-confirm.port';
import type { ClientConfirmPort } from '@payments/application/api/ports/client-confirm.port';

/**
 * Stripe provider factory for fake mode.
 * Extends StripeProviderFactory and adds getClientConfirmHandler for FakeIntentStore client_confirm flow.
 */
@Injectable()
export class FakeStripeProviderFactory extends StripeProviderFactory {
  private readonly clientConfirmPort = inject(FakeStripeClientConfirmPort);

  getClientConfirmHandler(): ClientConfirmPort | null {
    return this.clientConfirmPort;
  }
}
