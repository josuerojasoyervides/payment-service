import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { I18nKeys } from "@core/i18n";
import {
    PaymentIntent,
    CancelPaymentRequest,
    ConfirmPaymentRequest,
    CreatePaymentRequest,
    GetPaymentStatusRequest,
    PaymentError,
} from "../../../domain/models";
import {
    StripePaymentIntentDto,
    StripeCreateIntentRequest,
    StripeConfirmIntentRequest,
    StripeSpeiSourceDto,
    StripeCreateResponseDto
} from "../dto/stripe.dto";
import { BasePaymentGateway } from "@payments/shared/base-payment.gateway";
import { ERROR_CODE_MAP } from "../mappers/error-code.mapper";
import { SpeiSourceMapper } from "../mappers/spei-source.mapper";
import { mapPaymentIntent } from "../mappers/payment-intent.mapper";
import { getIdempotencyHeaders } from "../validators/get-idempotency-headers";
import { isStripeErrorResponse } from "../mappers/error-response.mapper";
import { ErrorKeyMapper } from "../mappers/error-key.mapper";
import { PaymentGateway } from "@payments/domain/ports";
import { StripeCreateIntentGateway } from "./intent/create-intent.gateway";
import { StripeConfirmIntentGateway } from "./intent/confirm-intent.gateway";
import { StripeCancelIntentGateway } from "./intent/cancel-intent.gateway";
import { StripeGetIntentGateway } from "./intent/get-intent.gateway";


/**
 * Stripe gateway.
 *
 * Stripe-specific features:
 * - Uses PaymentIntents as main model
 * - Amounts in cents (100 = $1.00)
 * - Client secret for client-side authentication
 * - Native 3D Secure with next_action
 * - SPEI via Sources (Mexico)
 * - Idempotency keys for safe operations
 */
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
    readonly providerId = 'stripe' as const;
    constructor(
        private readonly createIntentOp: StripeCreateIntentGateway,
        private readonly confirmIntentOp: StripeConfirmIntentGateway,
        private readonly cancelIntentOp: StripeCancelIntentGateway,
        private readonly getIntentOp: StripeGetIntentGateway,
    ) { }

    createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return this.createIntentOp.execute(req);
    }

    confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent> {
        return this.confirmIntentOp.execute(req);
    }

    cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent> {
        return this.cancelIntentOp.execute(req);
    }

    getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent> {
        return this.getIntentOp.execute(req);
    }
}
