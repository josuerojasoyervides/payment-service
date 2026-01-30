import { Injectable } from '@angular/core';
import { FAKE_ERRORS } from '@app/features/payments/infrastructure/fake/shared/constants/fake-errors';
import { createFakePaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-paypal-order.helper';
import { createFakeSpeiSource } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-spei-source.helper';
import { createFakeStripeIntent } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-stripe-intent.helper';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { validateCreate as validateCreateHelper } from '@app/features/payments/infrastructure/fake/shared/helpers/validate-create.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { Observable } from 'rxjs';
import { delay, mergeMap, of, throwError } from 'rxjs';

const DEFAULT_DELAY_MS = 200;
const TIMEOUT_DELAY_MS = 500;

function addFakeDebug(
  dto: Record<string, unknown>,
  scenarioId: string,
  simulatedDelayMs: number,
  correlationId: string,
): void {
  dto['_fakeDebug'] = {
    scenarioId,
    simulatedDelayMs,
    correlationId,
  };
}
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
      return of(null).pipe(
        delay(TIMEOUT_DELAY_MS),
        mergeMap(() => throwError(() => FAKE_ERRORS['timeout'])),
      );
    }

    if (request.method.type === 'spei') {
      const dto = createFakeSpeiSource(request) as unknown as Record<string, unknown>;
      addFakeDebug(dto, behavior, DEFAULT_DELAY_MS, request.orderId);
      return simulateNetworkDelay(dto);
    }

    if (this.providerId === 'paypal') {
      const dto = createFakePaypalOrder(request) as unknown as Record<string, unknown>;
      addFakeDebug(dto, behavior, DEFAULT_DELAY_MS, request.orderId);
      return simulateNetworkDelay(dto);
    }

    let status: StripePaymentIntentDto['status'] = 'requires_confirmation';
    let nextActionKind: 'redirect' | 'client_confirm' | undefined;
    if (behavior === 'success') {
      status = 'succeeded';
    } else if (behavior === '3ds') {
      status = 'requires_action';
      nextActionKind = 'redirect';
    } else if (behavior === 'client_confirm') {
      status = 'requires_action';
      nextActionKind = 'client_confirm';
    } else if (behavior === 'processing') {
      status = 'processing';
    } else {
      if (request.method.token === 'tok_visa1234567890abcdef') {
        status = 'succeeded';
      }
    }

    const dto = createFakeStripeIntent(request, status, nextActionKind) as unknown as Record<
      string,
      unknown
    >;
    addFakeDebug(dto, behavior, DEFAULT_DELAY_MS, request.orderId);
    return simulateNetworkDelay(dto);
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }

  protected override validateRequest(request: CreatePaymentRequest): void {
    validateCreateHelper(request, this.providerId);
  }
}
