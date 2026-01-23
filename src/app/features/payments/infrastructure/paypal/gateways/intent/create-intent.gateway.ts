import { Injectable } from '@angular/core';
import { PaymentGatewayPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { PaypalCreateOrderRequest, PaypalOrderDto } from '../../dto/paypal.dto';

@Injectable()
export class PaypalCreateIntentGateway extends PaymentGatewayPort<
  CreatePaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = '/api/payments/paypal';

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected override executeRaw(request: CreatePaymentRequest): Observable<PaypalOrderDto> {
    const paypalRequest = this.buildPaypalCreateRequest(request);

    return this.http.post<PaypalOrderDto>(`${this.API_BASE}/orders`, paypalRequest, {
      headers: {
        'PayPal-Request-Id': this.generateRequestId(request.orderId),
        Prefer: 'return=representation',
      },
    });
  }
  protected override mapResponse(dto: PaypalOrderDto): PaymentIntent {
    throw new Error('Method not implemented.');
  }

  private buildPaypalCreateRequest(req: CreatePaymentRequest): PaypalCreateOrderRequest {
    // returnUrl/cancelUrl deben venir del request preparado (PaypalRedirectStrategy.prepare)
    // que usa StrategyContext como ÚNICA fuente
    // El builder/strategy deben garantizar que returnUrl esté presente
    // Si no está => error claro (no inventar URLs)
    if (!req.returnUrl) {
      throw new Error(
        'returnUrl is required for PayPal orders. ' +
          'PaypalRedirectStrategy.prepare() must set returnUrl from StrategyContext. ' +
          'Check that CheckoutComponent provides StrategyContext.returnUrl when starting payment.',
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
  // TODO Implement the idempotency key and remove this method
  private generateRequestId(orderId: string, operation = 'create'): string {
    return `${orderId}-${operation}-${Date.now()}`;
  }
}
