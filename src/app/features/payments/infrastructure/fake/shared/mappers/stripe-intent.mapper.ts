import type {
  PaymentIntent,
  PaymentIntentStatus,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

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

  let nextAction: PaymentIntent['nextAction'];
  if (dto.next_action) {
    if (dto.next_action.type === 'redirect_to_url') {
      nextAction = {
        kind: 'redirect',
        url: dto.next_action.redirect_to_url?.url ?? '',
      };
    } else {
      nextAction = {
        kind: 'client_confirm',
        token: dto.client_secret,
      };
    }
  }

  return {
    id: dto.id,
    provider: 'stripe',
    status: statusMap[dto.status],
    money: {
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    },
    clientSecret: dto.client_secret,
    nextAction,
    raw: dto,
  };
}
