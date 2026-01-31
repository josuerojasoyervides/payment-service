import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  PaypalCreateOrderRequest,
  PaypalOrderDto,
} from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PAYPAL_API_BASE } from '@app/features/payments/infrastructure/paypal/shared/constants/base-api.constant';
import { I18nKeys } from '@core/i18n';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';

@Injectable()
export class PaypalCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = PAYPAL_API_BASE;
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected executeRaw(request: CreatePaymentRequest): Observable<PaypalOrderDto> {
    const paypalRequest = this.buildPaypalCreateRequest(request);

    return this.http.post<PaypalOrderDto>(`${this.API_BASE}/orders`, paypalRequest, {
      headers: {
        'PayPal-Request-Id': this.idempotencyKeyFactory.generateForStart(this.providerId, request),
        Prefer: 'return=representation',
      },
    });
  }
  protected mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  // TODO : This mocked method should not exist if we are using the fake gateway
  // TODO : Check if this method is working as expected.
  private buildPaypalCreateRequest(req: CreatePaymentRequest): PaypalCreateOrderRequest {
    // returnUrl/cancelUrl must come from the prepared request (PaypalRedirectStrategy.prepare)
    // which uses StrategyContext as the ONLY source
    // Builder/strategy must guarantee returnUrl is present
    // If missing => clear error (do not invent URLs)
    if (!req.returnUrl) {
      throw invalidRequestError(
        I18nKeys.errors.invalid_request,
        { returnUrl: req.returnUrl ?? '' },
        req,
      );
    }

    const returnUrl = req.returnUrl;
    const cancelUrl = req.cancelUrl ?? returnUrl;

    return {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.orderId,
          custom_id: req.orderId,
          description: `Order ${req.orderId}`,
          amount: {
            currency_code: req.currency,
            value: req.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'Payment Service',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };
  }
}
