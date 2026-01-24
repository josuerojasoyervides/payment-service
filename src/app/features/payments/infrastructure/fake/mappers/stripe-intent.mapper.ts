import {
  PaymentIntent,
  PaymentIntentStatus,
} from '@payments/domain/models/payment/payment-intent.types';
import { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

export function mapStripeIntent(dto: StripePaymentIntentDto): PaymentIntent {
  const statusMap: Record<StripePaymentIntentDto['status'], PaymentIntentStatus> = {
    requires_payment_method: 'requires_payment_method',
    requires_confirmation: 'requires_confirmation',
    requires_action: 'requires_action',
    processing: 'processing',
    requires_capture: 'processing',
    canceled: 'canceled',
    succeeded: 'succeeded',
  };

  return {
    id: dto.id,
    provider: 'stripe',
    status: statusMap[dto.status],
    amount: dto.amount / 100,
    currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    clientSecret: dto.client_secret,
    nextAction: dto.next_action
      ? {
          type: '3ds',
          clientSecret: dto.client_secret,
          returnUrl: dto.next_action.redirect_to_url?.return_url ?? '',
        }
      : undefined,
    raw: dto,
  };
}
