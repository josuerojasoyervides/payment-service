import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { STATUS_MAP } from '@payments/infrastructure/stripe/workflows/intent/mappers/internal-status.mapper';
import { mapStripeNextAction } from '@payments/infrastructure/stripe/workflows/intent/mappers/next-action.mapper';

export function mapPaymentIntent(
  dto: StripePaymentIntentDto,
  providerId: PaymentProviderId,
): PaymentIntent {
  const status = STATUS_MAP[dto.status] ?? 'processing';

  const intent: PaymentIntent = {
    id: dto.id,
    provider: providerId,
    status,
    money: {
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    },
    clientSecret: dto.client_secret,
    raw: dto,
  };

  if (dto.next_action) {
    intent.nextAction = mapStripeNextAction(dto);
  }

  return intent;
}
