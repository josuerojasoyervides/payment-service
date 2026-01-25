import { inject, Injectable } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { PaymentOperationPort } from '@payments/application/ports/payment-operation.port';
import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { PAYPAL_API_BASE } from '../../constants/base-api.constant';
import { PaypalCreateOrderRequest, PaypalOrderDto } from '../../dto/paypal.dto';
import { mapOrder } from '../../mappers/map-order.mapper';

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
  private buildPaypalCreateRequest(req: CreatePaymentRequest): PaypalCreateOrderRequest {
    // returnUrl/cancelUrl deben venir del request preparado (PaypalRedirectStrategy.prepare)
    // que usa StrategyContext como ÚNICA fuente
    // El builder/strategy deben garantizar que returnUrl esté presente
    // Si no está => error claro (no inventar URLs)
    if (!req.returnUrl) {
      throw invalidRequestError(I18nKeys.errors.invalid_request, { returnUrl: req.returnUrl }, req);
    }

    const returnUrl = req.returnUrl;
    const cancelUrl = req.cancelUrl ?? returnUrl;

    return {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.orderId,
          custom_id: req.orderId,
          description: `Orden ${req.orderId}`,
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
