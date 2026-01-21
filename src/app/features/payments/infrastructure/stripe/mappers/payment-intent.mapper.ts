import { PaymentIntent, PaymentProviderId } from "@payments/domain/models";
import { mapStripeNextAction } from "./next-action.mapper";
import { STATUS_MAP } from "./internal-status.mapper";
import { StripePaymentIntentDto } from "../dto/stripe.dto";

export function mapPaymentIntent(dto: StripePaymentIntentDto, providerId: PaymentProviderId): PaymentIntent {
    const status = STATUS_MAP[dto.status] ?? 'processing';

    const intent: PaymentIntent = {
        id: dto.id,
        provider: providerId,
        status,
        amount: dto.amount / 100,
        currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
        clientSecret: dto.client_secret,
        raw: dto,
    };

    if (dto.next_action) {
        intent.nextAction = mapStripeNextAction(dto);
    }

    return intent;
}