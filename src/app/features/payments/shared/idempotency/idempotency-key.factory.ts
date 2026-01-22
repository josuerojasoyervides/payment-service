import { Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentProviderId } from '../../domain/models';

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
}
