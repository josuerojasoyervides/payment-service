import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { FAKE_ERRORS } from '@app/features/payments/infrastructure/fake/shared/constants/fake-errors';
import { buildStripeDtoFromFakeState } from '@app/features/payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { createFakePaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-paypal-order.helper';
import { createFakeSpeiSource } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-spei-source.helper';
import { getTokenBehavior } from '@app/features/payments/infrastructure/fake/shared/helpers/get-token-behavior';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { validateCreate as validateCreateHelper } from '@app/features/payments/infrastructure/fake/shared/helpers/validate-create.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { createFakeIntentState } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.state';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { isPaymentError } from '@payments/application/orchestration/store/projection/payment-store.errors';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import type { Observable } from 'rxjs';
import { delay, mergeMap, of, throwError } from 'rxjs';

const DEFAULT_DELAY_MS = 200;
/** Short delay in fake so integration tests get timeout error deterministically without long waits. */
const TIMEOUT_DELAY_MS = 1;
const SLOW_DELAY_MS = 1500;

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
  unknown,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: CreatePaymentRequest): Observable<unknown> {
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
    if (behavior === 'circuit') {
      return throwError(() => FAKE_ERRORS['circuit_open']);
    }
    if (behavior === 'rate_limit') {
      return throwError(() => FAKE_ERRORS['rate_limited']);
    }
    if (behavior === 'half_open_fail') {
      return throwError(() => FAKE_ERRORS['circuit_open']);
    }
    if (behavior === 'retry_exhaust') {
      return throwError(() => ({ code: 'timeout', raw: { scenario: 'retry_exhaust' } }));
    }

    if (request.method.type === 'spei') {
      const dto = createFakeSpeiSource(request) as unknown as Record<string, unknown>;
      const delayMs = behavior === 'slow_response' ? SLOW_DELAY_MS : DEFAULT_DELAY_MS;
      addFakeDebug(dto, behavior, delayMs, request.orderId.value);
      return simulateNetworkDelay(dto, delayMs);
    }

    if (this.providerId === PAYMENT_PROVIDER_IDS.paypal) {
      const dto = createFakePaypalOrder(request) as unknown as Record<string, unknown>;
      const delayMs = behavior === 'slow_response' ? SLOW_DELAY_MS : DEFAULT_DELAY_MS;
      addFakeDebug(dto, behavior, delayMs, request.orderId.value);
      return simulateNetworkDelay(dto, delayMs);
    }

    // Stripe card: use shared fake intent state for deterministic processing/client_confirm/refresh
    const state = createFakeIntentState({
      token: request.method?.token,
      providerId: this.providerId,
      request,
    });
    const delayMs = behavior === 'slow_response' ? SLOW_DELAY_MS : DEFAULT_DELAY_MS;
    const dto = buildStripeDtoFromFakeState(state, delayMs);
    return simulateNetworkDelay(dto, delayMs);
  }

  protected override mapResponse(dto: unknown): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }

  protected override validateRequest(request: CreatePaymentRequest): void {
    validateCreateHelper(request, this.providerId);
  }

  /** Preserve FAKE_ERRORS (timeout, decline, etc.) so integration tests see correct error codes. */
  protected override handleError(err: unknown): PaymentError {
    if (isPaymentError(err)) return err;
    return super.handleError(err);
  }
}
