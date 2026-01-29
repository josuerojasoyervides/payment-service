import type { Provider, ProviderToken, Type } from '@angular/core';
import { inject } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { FakePaymentGateway } from '@payments/infrastructure/fake/gateways/fake-payment.gateway';
import type { FakeCancelIntentGateway } from '@payments/infrastructure/fake/gateways/intent/cancel-intent.gateway';
import type { FakeConfirmIntentGateway } from '@payments/infrastructure/fake/gateways/intent/confirm-intent.gateway';
import type { FakeCreateIntentGateway } from '@payments/infrastructure/fake/gateways/intent/create-intent.gateway';
import type { FakeGetIntentGateway } from '@payments/infrastructure/fake/gateways/intent/get-intent.gateway';

export function fakeIntentFacadeFactory<TFacade>(
  providerId: PaymentProviderId,
  facadeToken: ProviderToken<TFacade>,
  createToken: Type<FakeCreateIntentGateway>,
  confirmToken: Type<FakeConfirmIntentGateway>,
  cancelToken: Type<FakeCancelIntentGateway>,
  getToken: Type<FakeGetIntentGateway>,
): Provider {
  return {
    provide: facadeToken,
    useFactory: () =>
      new FakePaymentGateway(
        providerId,
        inject(createToken),
        inject(confirmToken),
        inject(cancelToken),
        inject(getToken),
      ),
  };
}
