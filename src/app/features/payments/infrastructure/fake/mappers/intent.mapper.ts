import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';
import {
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@payments/infrastructure/stripe/dto/stripe.dto';

import { mapGeneric } from './generic.mapper';
import { mapPaypalOrder } from './paypal-order.mapper';
import { mapStripeIntent } from './stripe-intent.mapper';
import { mapStripeSpeiSource } from './stripe-spei-source.mapper';

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
