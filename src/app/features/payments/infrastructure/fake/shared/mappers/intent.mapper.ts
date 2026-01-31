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

export function mapIntent(dto: any, providerId: PaymentProviderId): PaymentIntent {
  if ('object' in dto && dto.object === 'payment_intent') {
    return mapStripeIntent(dto as StripePaymentIntentDto);
  }
  if ('object' in dto && dto.object === 'source') {
    return mapStripeSpeiSource(dto as StripeSpeiSourceDto);
  }
  if ('intent' in dto && dto.intent === 'CAPTURE') {
    return mapPaypalOrder(dto as PaypalOrderDto);
  }

  return mapGeneric(dto, providerId);
}
