import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export interface AmountLimitsByCurrency {
  min: number;
  max: number;
}

export interface ProviderValidationConfig {
  providerId: PaymentProviderId;
  method: PaymentMethodType;
  currencies: CurrencyCode[];
  amountLimitsByCurrency: Partial<Record<CurrencyCode, AmountLimitsByCurrency>>;
  urls?: {
    returnUrlRequired?: boolean;
    cancelUrlRequired?: boolean;
  };
}
