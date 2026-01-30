import { inject, Injectable } from '@angular/core';
import { FAKE_ERRORS } from '@app/features/payments/infrastructure/fake/shared/constants/fake-errors';
import { buildStripeDtoFromFakeState } from '@app/features/payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { createFakePaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-paypal-order.helper';
import { createFakeSpeiSource } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-spei-source.helper';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { validateCreate as validateCreateHelper } from '@app/features/payments/infrastructure/fake/shared/helpers/validate-create.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { FakeIntentStore } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { isPaymentError } from '@payments/application/orchestration/store/projection/payment-store.errors';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { Observable } from 'rxjs';
import { delay, mergeMap, of, throwError } from 'rxjs';

const DEFAULT_DELAY_MS = 200;
/** Short delay in fake so integration tests get timeout error deterministically without long waits. */
const TIMEOUT_DELAY_MS = 1;

function addFakeDebug(
  dto: Record<string, unknown>,
  scenarioId: string,
  simulatedDelayMs: number,
  correlationId: string,
  stepCount?: number,
  createdAt?: number,
): void {
  dto['_fakeDebug'] = {
    scenarioId,
    simulatedDelayMs,
    correlationId,
    ...(stepCount !== undefined && { stepCount }),
    ...(createdAt !== undefined && { createdAt }),
  };
}

@Injectable()
export abstract class FakeCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  private readonly fakeIntentStore = inject(FakeIntentStore);

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

    // Stripe card: use FakeIntentStore for deterministic processing/client_confirm/refresh
    const state = this.fakeIntentStore.createIntent({
      token: request.method?.token,
      providerId: this.providerId,
      request,
    });
    const dto = buildStripeDtoFromFakeState(state, DEFAULT_DELAY_MS);
    return simulateNetworkDelay(dto);
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }

  protected override validateRequest(request: CreatePaymentRequest): void {
    validateCreateHelper(request, this.providerId);
  }

  /** Preserve FAKE_ERRORS (timeout, decline, etc.) so integration tests see correct code/messageKey. */
  protected override handleError(err: unknown): PaymentError {
    if (isPaymentError(err)) return err;
    return super.handleError(err);
  }
}
