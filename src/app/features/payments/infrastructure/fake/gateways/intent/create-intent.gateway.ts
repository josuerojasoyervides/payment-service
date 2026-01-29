import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';
import { FAKE_ERRORS } from '@payments/infrastructure/fake/constants/fake-errors';
import { createFakePaypalOrder } from '@payments/infrastructure/fake/helpers/create-fake-paypal-order.helper';
import { createFakeSpeiSource } from '@payments/infrastructure/fake/helpers/create-fake-spei-source.helper';
import { createFakeStripeIntent } from '@payments/infrastructure/fake/helpers/create-fake-stripe-intent.helper';
import { getTokenBehavior } from '@payments/infrastructure/fake/helpers/get-token-behavior';
import { simulateNetworkDelay } from '@payments/infrastructure/fake/helpers/simulate-network-delay.helper';
import { validateCreate as validateCreateHelper } from '@payments/infrastructure/fake/helpers/validate-create.helper';
import { mapIntent } from '@payments/infrastructure/fake/mappers/intent.mapper';
import type { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
@Injectable()
export abstract class FakeCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: CreatePaymentRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Creating intent for ${this.providerId}`, this.logContext, {
      request,
    });
    const behavior = getTokenBehavior(request.method.token);

    if (behavior === 'fail') {
      return throwError(() => FAKE_ERRORS['provider_error']);
    }
    if (behavior === 'decline') {
      return throwError(() => FAKE_ERRORS['decline']);
    }
    if (behavior === 'insufficient') {
      return throwError(() => FAKE_ERRORS['insufficient']);
    }
    if (behavior === 'expired') {
      return throwError(() => FAKE_ERRORS['expired']);
    }
    if (behavior === 'timeout') {
      return simulateNetworkDelay(createFakeStripeIntent(request, 'processing'), 10000);
    }

    if (request.method.type === 'spei') {
      return simulateNetworkDelay(createFakeSpeiSource(request));
    }

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createFakePaypalOrder(request));
    }

    let status: StripePaymentIntentDto['status'] = 'requires_confirmation';
    if (behavior === 'success') {
      status = 'succeeded';
    } else if (behavior === '3ds') {
      status = 'requires_action';
    } else if (behavior === 'processing') {
      status = 'processing';
    } else {
      if (request.method.token === 'tok_visa1234567890abcdef') {
        status = 'succeeded';
      }
    }

    return simulateNetworkDelay(createFakeStripeIntent(request, status));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }

  protected override validateRequest(request: CreatePaymentRequest): void {
    validateCreateHelper(request, this.providerId);
  }
}
