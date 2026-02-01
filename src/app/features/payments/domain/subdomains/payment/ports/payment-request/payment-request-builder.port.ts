import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';

export interface PaymentRequestBuilderPort {
  forOrder(orderId: string): this;
  withAmount(amount: number, currency: CurrencyCode): this;
  withOptions(options: PaymentOptions): this;

  build(): CreatePaymentRequest;
}
