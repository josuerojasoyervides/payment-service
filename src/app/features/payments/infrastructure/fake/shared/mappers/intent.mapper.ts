import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { mapGeneric } from '@app/features/payments/infrastructure/fake/shared/mappers/generic.mapper';
import { mapPaypalOrder } from '@app/features/payments/infrastructure/fake/shared/mappers/paypal-order.mapper';
import { mapStripeIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/stripe-intent.mapper';
import { mapStripeSpeiSource } from '@app/features/payments/infrastructure/fake/shared/mappers/stripe-spei-source.mapper';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import type {
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function mapIntent(dto: unknown, providerId: PaymentProviderId): PaymentIntent {
  if (isRecord(dto) && dto['object'] === 'payment_intent') {
    return mapStripeIntent(dto as unknown as StripePaymentIntentDto);
  }
  if (isRecord(dto) && dto['object'] === 'source') {
    return mapStripeSpeiSource(dto as unknown as StripeSpeiSourceDto);
  }
  if (isRecord(dto) && dto['intent'] === 'CAPTURE') {
    return mapPaypalOrder(dto as unknown as PaypalOrderDto);
  }

  return mapGeneric(dto, providerId);
}
