import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { NgRxSignalsStateAdapter } from '@payments/application/adapters/state/ngrx-signals-state.adapter';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import providePayments, { providePaymentsWithConfig } from '@payments/config/payment.providers';

describe('payment.providers', () => {
  it('registers factories and state adapter (smoke)', () => {
    TestBed.configureTestingModule({
      providers: [...providePayments()],
    });

    const factories = TestBed.inject(PAYMENT_PROVIDER_FACTORIES);
    const state = TestBed.inject(PAYMENT_STATE);

    // Default mode is fake: FakeStripeProviderFactory + PaypalProviderFactory
    expect(factories.length).toBe(2);
    expect(factories.some((f: { providerId: string }) => f.providerId === 'stripe')).toBe(true);
    expect(factories.some((f: { providerId: string }) => f.providerId === 'paypal')).toBe(true);
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
