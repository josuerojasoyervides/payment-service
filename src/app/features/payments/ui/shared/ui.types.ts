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
 * Item de orden para mostrar en el resumen.
 */
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

/**
 * Datos de la orden para el checkout.
 */
export interface OrderData {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  items?: OrderItem[];
}

/**
 * Estado del botón de pago.
 */
export type PaymentButtonState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Configuración de proveedor para el selector.
 */
export interface ProviderOption {
  id: PaymentProviderId;
  name: string;
  icon: string;
  description?: string;
}

/**
 * Configuración de método de pago para el selector.
 */
export interface MethodOption {
  type: PaymentMethodType;
  name: string;
  icon: string;
  description?: string;
}

/**
 * Props para el componente de resumen de orden.
 */
export interface OrderSummaryProps {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  items?: OrderItem[];
}

/**
 * Props para el selector de proveedor.
 */
export interface ProviderSelectorProps {
  providers: PaymentProviderId[];
  selected: PaymentProviderId | null;
  disabled: boolean;
}

/**
 * Props para el selector de método.
 */
export interface MethodSelectorProps {
  methods: PaymentMethodType[];
  selected: PaymentMethodType | null;
  disabled: boolean;
}

/**
 * Props para el formulario de pago.
 */
export interface PaymentFormProps {
  requirements: FieldRequirements | null;
  disabled: boolean;
}

/**
 * Props para el botón de pago.
 */
export interface PaymentButtonProps {
  amount: number;
  currency: CurrencyCode;
  provider: PaymentProviderId;
  loading: boolean;
  disabled: boolean;
}

/**
 * Props para el resultado del pago.
 */
export interface PaymentResultProps {
  intent: PaymentIntent | null;
  error: PaymentError | null;
}

/**
 * Props para el modal de fallback.
 */
export interface FallbackModalProps {
  event: FallbackAvailableEvent | null;
  open: boolean;
}

/**
 * Configuración por defecto de proveedores.
 * @deprecated Usar getDefaultProviders() con I18nService en su lugar
 */
export const DEFAULT_PROVIDERS: ProviderOption[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Tarjetas de crédito/débito y SPEI',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    icon: '🅿️',
    description: 'Pago con cuenta PayPal',
  },
];

/**
 * Obtiene la configuración de proveedores usando i18n.
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
 * Configuración por defecto de métodos de pago.
 * @deprecated Usar getDefaultMethods() con I18nService en su lugar
 */
export const DEFAULT_METHODS: MethodOption[] = [
  {
    type: 'card',
    name: 'Tarjeta',
    icon: '💳',
    description: 'Crédito o débito',
  },
  {
    type: 'spei',
    name: 'SPEI',
    icon: '🏦',
    description: 'Transferencia bancaria',
  },
];

/**
 * Obtiene la configuración de métodos usando i18n.
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
 * Mapeo de estados de pago a clases de badge.
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
 * Mapeo de estados de pago a textos legibles.
 * @deprecated Usar getStatusText() con I18nService en su lugar
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  requires_payment_method: 'Requiere método de pago',
  requires_confirmation: 'Pendiente de confirmación',
  requires_action: 'Acción requerida',
  processing: 'Procesando',
  succeeded: 'Completado',
  failed: 'Fallido',
  canceled: 'Cancelado',
};

/**
 * Obtiene el texto de un estado usando i18n.
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
//TODO: Move this interface to the ui layer.
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
