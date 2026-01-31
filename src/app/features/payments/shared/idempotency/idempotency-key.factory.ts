import { inject, Injectable } from '@angular/core';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { LoggerService, TraceOperation } from '@core/logging';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

export type IdempotencyOperation = 'start' | 'confirm' | 'cancel' | 'get';

interface IntentReq {
  intentId: string;
}
type IntentOperation = Exclude<IdempotencyOperation, 'start'>;

type GenerateInput =
  | { operation: 'start'; req: CreatePaymentRequest }
  | { operation: IntentOperation; req: IntentReq };

@Injectable()
export class IdempotencyKeyFactory {
  private readonly logger = inject(LoggerService);

  generateForStart(providerId: PaymentProviderId, req: CreatePaymentRequest): string {
    const parts = [
      providerId,
      'start',
      req.orderId,
      req.amount.toString(),
      req.currency,
      req.method.type,
    ];
    return parts.join(':');
  }

  generateForConfirm(providerId: PaymentProviderId, intentId: string): string {
    return `${providerId}:confirm:${intentId}`;
  }

  generateForCancel(providerId: PaymentProviderId, intentId: string): string {
    return `${providerId}:cancel:${intentId}`;
  }

  generateForGet(providerId: PaymentProviderId, intentId: string): string {
    return `${providerId}:get:${intentId}`;
  }

  /**
   * @param providerId - The payment provider ID
   * @param input - The input for the idempotency key generation. Can be a start request or an intent operation request.
   * @returns The idempotency key
   * @example
   * const idempotencyKey = this.idempotencyKeyFactory.generate('stripe', {
   *   operation: 'start',
   *   req: {
   *     orderId: '1234567890',
   *     amount: 100,
   *     currency: 'USD',
   *   },
   * });
   */
  @TraceOperation({
    name: 'generateIdempotencyKey',
    context: 'IdempotencyKeyFactory',
    metadata: ([providerId, input]) => ({
      providerId,
      operation: (input as GenerateInput | undefined)?.operation ?? 'unknown',
    }),
  })
  generate(providerId: PaymentProviderId, input: GenerateInput): string {
    if (input.operation === 'start') {
      return this.generateForStart(providerId, input.req);
    }

    const intentId = input.req.intentId;

    switch (input.operation) {
      case 'confirm':
        return this.generateForConfirm(providerId, intentId);
      case 'cancel':
        return this.generateForCancel(providerId, intentId);
      case 'get':
        return this.generateForGet(providerId, intentId);
    }
  }

  /**
   * Flow-oriented idempotency key generator.
   *
   * This follows the provider-agnostic rule described in the integration plan:
   *   key = flowId + ':' + operation + ':' + attempt
   *
   * It is safe to introduce alongside the existing per-request helpers; callers
   * can migrate incrementally.
   */
  generateForFlowOperation(
    context: PaymentFlowContext | null,
    operation: IdempotencyOperation,
    attempt: number,
  ): string {
    const flowId = context?.flowId ?? 'unknown_flow';
    const clampedAttempt = Math.max(0, attempt);
    return [flowId, operation, clampedAttempt.toString()].join(':');
  }
}
