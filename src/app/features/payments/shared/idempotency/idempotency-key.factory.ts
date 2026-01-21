import { Injectable } from '@angular/core';
import { PaymentProviderId, CreatePaymentRequest } from '../../domain/models';

/**
 * Operation types for idempotency keys.
 */
export type IdempotencyOperation = 'start' | 'confirm' | 'cancel' | 'get';

/**
 * Factory for generating stable idempotency keys.
 * 
 * Idempotency keys are stable for the same request parameters,
 * ensuring that retries use the same key and don't create duplicate payments.
 * 
 * The key is generated from:
 * - providerId
 * - operation (start/confirm/cancel/get)
 * - orderId (or intentId for confirm/cancel/get)
 * - amount (for start operations)
 * - currency (for start operations)
 * - method.type (for start operations)
 * 
 * @example
 * ```typescript
 * const factory = new IdempotencyKeyFactory();
 * const key = factory.generateForStart('stripe', {
 *   orderId: 'o1',
 *   amount: 100,
 *   currency: 'MXN',
 *   method: { type: 'card' }
 * });
 * // Returns: 'stripe:start:o1:100:MXN:card'
 * ```
 */
@Injectable()
export class IdempotencyKeyFactory {
    /**
     * Generates an idempotency key for start payment operation.
     */
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

    /**
     * Generates an idempotency key for confirm payment operation.
     */
    generateForConfirm(providerId: PaymentProviderId, intentId: string): string {
        return `${providerId}:confirm:${intentId}`;
    }

    /**
     * Generates an idempotency key for cancel payment operation.
     */
    generateForCancel(providerId: PaymentProviderId, intentId: string): string {
        return `${providerId}:cancel:${intentId}`;
    }

    /**
     * Generates an idempotency key for get payment status operation.
     * Note: GET operations typically don't need idempotency, but included for consistency.
     */
    generateForGet(providerId: PaymentProviderId, intentId: string): string {
        return `${providerId}:get:${intentId}`;
    }

    /**
     * Generates an idempotency key for any operation.
     */
    generate(
        providerId: PaymentProviderId,
        operation: IdempotencyOperation,
        req: CreatePaymentRequest | { intentId: string }
    ): string {
        if (operation === 'start') {
            return this.generateForStart(providerId, req as CreatePaymentRequest);
        }
        
        const intentId = 'intentId' in req ? req.intentId : (req as any).intentId;
        
        switch (operation) {
            case 'confirm':
                return this.generateForConfirm(providerId, intentId);
            case 'cancel':
                return this.generateForCancel(providerId, intentId);
            case 'get':
                return this.generateForGet(providerId, intentId);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
}
