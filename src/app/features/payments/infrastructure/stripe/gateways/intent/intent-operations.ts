import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest, PaymentIntent } from "@payments/domain/models";
import { PaymentGatewayOperation } from "@payments/shared/payment-operation.gateway";
import { StripePaymentIntentDto, StripeSpeiSourceDto } from "../../dto/stripe.dto";

export type CreateIntentOp = PaymentGatewayOperation<CreatePaymentRequest, StripePaymentIntentDto | StripeSpeiSourceDto, PaymentIntent>;
export type ConfirmIntentOp = PaymentGatewayOperation<ConfirmPaymentRequest, StripePaymentIntentDto, PaymentIntent>;
export type CancelIntentOp = PaymentGatewayOperation<CancelPaymentRequest, StripePaymentIntentDto, PaymentIntent>;
export type GetIntentStatusOp = PaymentGatewayOperation<GetPaymentStatusRequest, StripePaymentIntentDto, PaymentIntent>;

export interface ProviderCapabilities {
    createIntent: CreateIntentOp;
    confirmIntent?: ConfirmIntentOp;
    cancelIntent?: CancelIntentOp;
    getIntentStatus?: GetIntentStatusOp;
}