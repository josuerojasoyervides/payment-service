import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NgRxSignalsStateAdapter } from '@payments/application/adapters/state/ngrx-signals-state.adapter';
import { PAYMENT_STATE } from '@payments/application/api/tokens/flow/payment-state.token';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import providePayments, { providePaymentsWithConfig } from '@payments/config/payment.providers';
import { PaypalProviderFactory } from '@payments/infrastructure/paypal/factories/paypal-provider.factory';
import { StripeProviderFactory } from '@payments/infrastructure/stripe/factories/stripe-provider.factory';
import { StripeIntentFacade } from '@payments/infrastructure/stripe/workflows/intent/facades/intent.facade';

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
