import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgRxSignalsStateAdapter } from '../application/adapters/ngrx-signals-state.adapter';
import { PAYMENT_PROVIDER_FACTORIES } from '../application/tokens/payment-provider-factories.token';
import { PAYMENT_STATE } from '../application/tokens/payment-state.token';
import { PaypalProviderFactory } from '../infrastructure/paypal/factories/paypal-provider.factory';
import { StripeProviderFactory } from '../infrastructure/stripe/factories/stripe-provider.factory';
import { StripeIntentFacade } from '../infrastructure/stripe/gateways/intent/intent.facade';
import providePayments, { providePaymentsWithConfig } from './payment.providers';

describe('payment.providers', () => {
  it('registers factories and state adapter (smoke)', () => {
    TestBed.configureTestingModule({
      providers: [...providePayments()],
    });

    const factories = TestBed.inject(PAYMENT_PROVIDER_FACTORIES);
    const state = TestBed.inject(PAYMENT_STATE);

    // multi-token returns an array of instances
    const factoryTypes = factories.map((f: object) => f.constructor);

    expect(factoryTypes).toContain(StripeProviderFactory);
    expect(factoryTypes).toContain(PaypalProviderFactory);
    expect(state).toBeInstanceOf(NgRxSignalsStateAdapter);
  });

  it('resolves real Stripe gateways when useRealGateways = true', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClientTesting(),
        ...providePaymentsWithConfig({ useRealGateways: true }),
      ],
    });

    expect(() => TestBed.inject(StripeIntentFacade)).not.toThrow();
  });
});
