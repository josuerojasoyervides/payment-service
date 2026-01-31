import type { Provider, ProviderToken, Type } from '@angular/core';
import { inject } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { FakePaymentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/fake-intent.facade';
import type { FakeCancelIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/cancel-intent.gateway';
import type { FakeConfirmIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/confirm-intent.gateway';
import type { FakeCreateIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/create-intent.gateway';
import type { FakeGetIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/get-intent.gateway';

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
