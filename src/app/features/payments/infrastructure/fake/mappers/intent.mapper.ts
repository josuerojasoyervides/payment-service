import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { mapGeneric } from '@payments/infrastructure/fake/mappers/generic.mapper';
import { mapPaypalOrder } from '@payments/infrastructure/fake/mappers/paypal-order.mapper';
import { mapStripeIntent } from '@payments/infrastructure/fake/mappers/stripe-intent.mapper';
import { mapStripeSpeiSource } from '@payments/infrastructure/fake/mappers/stripe-spei-source.mapper';
import type { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';
import type {
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@payments/infrastructure/stripe/dto/stripe.dto';

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
