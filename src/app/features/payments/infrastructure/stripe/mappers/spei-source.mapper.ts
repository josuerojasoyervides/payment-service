import { NextActionSpei, PaymentIntent, PaymentProviderId } from "@payments/domain/models";
import { StripeSpeiSourceDto } from "../dto/stripe.dto";
import { I18nKeys, I18nService } from "@core/i18n";
import { inject } from "@angular/core";
import { SpeiStatusMapper } from "./spei-status.mapper";

export class SpeiSourceMapper {

    private readonly i18n = inject(I18nService);

    constructor(private readonly providerId: PaymentProviderId) { }

    mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
        const speiAction: NextActionSpei = {
            type: 'spei',
            instructions: this.i18n.t(I18nKeys.messages.spei_instructions),
            clabe: dto.spei.clabe,
            reference: dto.spei.reference,
            bank: dto.spei.bank,
            beneficiary: this.i18n.t(I18nKeys.ui.stripe_beneficiary),
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase(),
            expiresAt: new Date(dto.expires_at * 1000).toISOString(),
        };


        const status = new SpeiStatusMapper().mapSpeiStatus(dto.status);
        return {
            id: dto.id,
            provider: this.providerId,
            status: status,
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            nextAction: speiAction,
            raw: dto,
        };
    }
}
