import { I18nKeys } from '@core/i18n';
import { FallbackAvailableEvent } from '@payments/domain/models/fallback/fallback-event.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  CurrencyCode,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  FieldRequirements,
  FieldType,
  PaymentOptions,
} from '@payments/domain/ports/payment/payment-request-builder.port';
/**
 * Order item shown in summary.
 */
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

/**
 * Order data for checkout.
 */
export interface OrderData {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  items?: OrderItem[];
}

/**
 * Payment button state.
 */
export type PaymentButtonState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Provider configuration for the selector.
 */
export interface ProviderOption {
  id: PaymentProviderId;
  name: string;
  icon: string;
  description?: string;
}

/**
 * Payment method configuration for the selector.
 */
export interface MethodOption {
  type: PaymentMethodType;
  name: string;
  icon: string;
  description?: string;
}

/**
 * Props for the order summary component.
 */
export interface OrderSummaryProps {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  items?: OrderItem[];
}

/**
 * Props for the provider selector.
 */
export interface ProviderSelectorProps {
  providers: PaymentProviderId[];
  selected: PaymentProviderId | null;
  disabled: boolean;
}

/**
 * Props for the method selector.
 */
export interface MethodSelectorProps {
  methods: PaymentMethodType[];
  selected: PaymentMethodType | null;
  disabled: boolean;
}

/**
 * Props for the payment form.
 */
export interface PaymentFormProps {
  requirements: FieldRequirements | null;
  disabled: boolean;
}

/**
 * Props for the payment button.
 */
export interface PaymentButtonProps {
  amount: number;
  currency: CurrencyCode;
  provider: PaymentProviderId;
  loading: boolean;
  disabled: boolean;
}

/**
 * Props for the payment result.
 */
export interface PaymentResultProps {
  intent: PaymentIntent | null;
  error: PaymentError | null;
}

/**
 * Props for the fallback modal.
 */
export interface FallbackModalProps {
  event: FallbackAvailableEvent | null;
  open: boolean;
}

/**
 * Default provider configuration.
 * @deprecated Use getDefaultProviders() with I18nService instead
 */
export const DEFAULT_PROVIDERS: ProviderOption[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Credit/debit cards and SPEI',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: '🅿️',
    description: 'Pay with a PayPal account',
  },
];

/**
 * Get provider configuration using i18n.
 */
export function getDefaultProviders(i18n: { t: (key: string) => string }): ProviderOption[] {
  return [
    {
      id: 'stripe',
      name: i18n.t(I18nKeys.ui.provider_stripe),
      icon: '💳',
      description: i18n.t(I18nKeys.ui.provider_stripe_description),
    },
    {
      id: 'paypal',
      name: i18n.t(I18nKeys.ui.provider_paypal),
      icon: '🅿️',
      description: i18n.t(I18nKeys.ui.provider_paypal_description),
    },
  ];
}

/**
 * Default payment method configuration.
 * @deprecated Use getDefaultMethods() with I18nService instead
 */
export const DEFAULT_METHODS: MethodOption[] = [
  {
    type: 'card',
    name: 'Card',
    icon: '💳',
    description: 'Credit or debit',
  },
  {
    type: 'spei',
    name: 'SPEI',
    icon: '🏦',
    description: 'Bank transfer',
  },
];

/**
 * Get method configuration using i18n.
 */
export function getDefaultMethods(i18n: { t: (key: string) => string }): MethodOption[] {
  return [
    {
      type: 'card',
      name: i18n.t(I18nKeys.ui.method_card),
      icon: '💳',
      description: i18n.t(I18nKeys.ui.method_card_description),
    },
    {
      type: 'spei',
      name: i18n.t(I18nKeys.ui.method_spei),
      icon: '🏦',
      description: i18n.t(I18nKeys.ui.method_spei_description),
    },
  ];
}

/**
 * Map payment states to badge classes.
 */
export const STATUS_BADGE_MAP: Record<string, string> = {
  requires_payment_method: 'badge-pending',
  requires_confirmation: 'badge-pending',
  requires_action: 'badge-warning',
  processing: 'badge-processing',
  succeeded: 'badge-success',
  failed: 'badge-error',
  canceled: 'badge-canceled',
};

/**
 * Map payment states to human-readable text.
 * @deprecated Use getStatusText() with I18nService instead
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  requires_payment_method: 'Payment method required',
  requires_confirmation: 'Pending confirmation',
  requires_action: 'Action required',
  processing: 'Processing',
  succeeded: 'Completed',
  failed: 'Failed',
  canceled: 'Canceled',
};

/**
 * Get status text using i18n.
 */
export function getStatusText(
  i18n: { t: (key: string) => string; has: (key: string) => boolean },
  status: string,
): string {
  const statusKey = `messages.status_${status}`;
  return i18n.has(statusKey) ? i18n.t(statusKey) : status;
}

export const ACTION_REQUIRED_STATUSES = new Set<PaymentIntent['status']>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

/**
 * Payment form field configuration.
 */
// TODO : Move this interface to the ui layer.
export interface FieldConfig {
  /** Field name (key in PaymentOptions) */
  name: keyof PaymentOptions;

  /** Label to display in UI */
  label: string;

  /** Whether required for this provider/method */
  required: boolean;

  /** Input type */
  type: FieldType;

  /** Input placeholder */
  placeholder?: string;

  /** Default value */
  defaultValue?: string;

  /**
   * If 'hidden', UI must provide it but not display it.
   * E.g., returnUrl can be the current URL
   */
  autoFill?: 'currentUrl' | 'none';
}
