import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type {
  PaypalCreateOrderRequest,
  PaypalOrderDto,
} from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.model';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { mapPaypalGatewayError } from '@payments/infrastructure/paypal/shared/errors/mappers/paypal-gateway-error.mapper';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';
import { timeout } from 'rxjs';

@Injectable()
export class PaypalCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);

  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;

  protected executeRaw(request: CreatePaymentRequest): Observable<PaypalOrderDto> {
    const paypalRequest = this.buildPaypalCreateRequest(request);

    return this.http
      .post<PaypalOrderDto>(`${this.config.paypal.baseUrl}/orders`, paypalRequest, {
        headers: {
          'PayPal-Request-Id': this.idempotencyKeyFactory.generateForStart(
            this.providerId,
            request,
          ),
          Prefer: 'return=representation',
        },
      })
      .pipe(timeout({ each: this.config.paypal.timeoutMs }));
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
      throw invalidRequestError(undefined, { returnUrl: req.returnUrl ?? '' }, req);
    }

    const returnUrl = req.returnUrl;
    const cancelUrl = req.cancelUrl ?? returnUrl;

    const defaults = this.config.paypal.defaults;

    return {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.orderId.value,
          custom_id: req.orderId.value,
          description: `Order ${req.orderId.value}`,
          amount: {
            currency_code: req.money.currency,
            value: req.money.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: defaults.brand_name,
        landing_page: defaults.landing_page,
        user_action: defaults.user_action,
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };
  }

  protected override handleError(err: unknown): PaymentError {
    return mapPaypalGatewayError(err, this.config.paypal.timeoutMs);
  }
}
