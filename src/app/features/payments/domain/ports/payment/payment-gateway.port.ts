import { HttpClient } from "@angular/common/http";
import { catchError, map, Observable, tap, throwError } from "rxjs";
import { PaymentIntent, PaymentProviderId } from "../../models/payment/payment-intent.types";
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../models/payment/payment-request.types";
import { PaymentError } from "../../models/payment/payment-error.types";
import { inject } from "@angular/core";
import { LoggerService } from "@core/logging";
import { I18nService, I18nKeys } from "@core/i18n";



export interface PaymentGateway {
    readonly providerId: PaymentProviderId;
    createIntent(req: CreatePaymentRequest): Observable<PaymentIntent>;
    confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent>;
    cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent>;
    getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent>;
}