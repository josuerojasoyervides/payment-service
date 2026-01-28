import { TestBed } from '@angular/core/testing';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/payment-provider-factories.token';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory.registry';
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action-orchestrator.service';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/facades/intent.facade';
import { PaypalProviderFactory } from '@payments/infrastructure/paypal/factories/paypal-provider.factory';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/handlers/paypal-finalize.handler';
import { firstValueFrom, of } from 'rxjs';

describe('NextActionOrchestratorService (PayPal wiring)', () => {
  it('routes finalize via registry->paypal factory capability->handler.execute (real wiring)', async () => {
    const paypalIntentFacadeMock: Pick<PaypalIntentFacade, 'providerId' | 'confirmIntent'> = {
      providerId: 'paypal',
      confirmIntent: vi.fn(() =>
        of({
          id: 'ORDER_1',
          provider: 'paypal' as const,
          status: 'succeeded' as const,
          amount: 100,
          currency: 'MXN' as const,
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        NextActionOrchestratorService,
        ProviderFactoryRegistry,
        PaypalFinalizeHandler,
        PaypalProviderFactory,
        { provide: PaypalIntentFacade, useValue: paypalIntentFacadeMock },
        { provide: PAYMENT_PROVIDER_FACTORIES, useExisting: PaypalProviderFactory, multi: true },
      ],
    });

    const orchestrator = TestBed.inject(NextActionOrchestratorService);
    const handler = TestBed.inject(PaypalFinalizeHandler);
    const executeSpy = vi.spyOn(handler, 'execute');

    const result = await firstValueFrom(
      orchestrator.requestFinalize({
        providerId: 'paypal',
        providerRefs: { paypal: { orderId: 'ORDER_1' } },
      }),
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ provider: 'paypal', status: 'succeeded', id: 'ORDER_1' });
  });
});
