import { TestBed } from '@angular/core/testing';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import type { PaymentsInfraConfigInput } from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { PaypalProviderFactory } from '@payments/infrastructure/paypal/core/factories/paypal-provider.factory';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/workflows/order/order.facade';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import { firstValueFrom, of } from 'rxjs';

describe('NextActionOrchestratorService (PayPal wiring)', () => {
  it('routes finalize via registry->paypal factory capability->handler.execute (real wiring)', async () => {
    const infraConfigInput: PaymentsInfraConfigInput = {
      paymentsBackendBaseUrl: '/test/payments',
      timeouts: { stripeMs: 10_000, paypalMs: 10_000 },
      paypal: {
        defaults: {
          brand_name: 'Test Brand',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
        },
      },
      spei: {
        displayConfig: {
          receivingBanks: { STP: 'STP (Transfers and Payments System)' },
          beneficiaryName: 'Payment Service',
        },
      },
    };

    const paypalIntentFacadeMock: Pick<PaypalIntentFacade, 'providerId' | 'confirmIntent'> = {
      providerId: 'paypal',
      confirmIntent: vi.fn(() =>
        of({
          id: createPaymentIntentId('ORDER_1'),
          provider: 'paypal' as const,
          status: 'succeeded' as const,
          money: { amount: 100, currency: 'MXN' as const },
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
        providePaymentsInfraConfig(infraConfigInput),
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
    expect(result).toMatchObject({
      provider: 'paypal',
      status: 'succeeded',
      id: expect.objectContaining({ value: 'ORDER_1' }),
    });
  });
});
