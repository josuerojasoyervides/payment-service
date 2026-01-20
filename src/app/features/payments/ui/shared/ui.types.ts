import { PaymentProviderId, PaymentMethodType, PaymentIntent, PaymentError, CurrencyCode, FallbackAvailableEvent } from '../../domain/models';
import { FieldRequirements, PaymentOptions } from '../../domain/ports';

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
 * Configuración por defecto de métodos de pago.
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
 * Mapeo de estados de pago a clases de badge.
 */
export const STATUS_BADGE_MAP: Record<string, string> = {
    'requires_payment_method': 'badge-pending',
    'requires_confirmation': 'badge-pending',
    'requires_action': 'badge-warning',
    'processing': 'badge-processing',
    'succeeded': 'badge-success',
    'failed': 'badge-error',
    'canceled': 'badge-canceled',
};

/**
 * Mapeo de estados de pago a textos legibles.
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
    'requires_payment_method': 'Requiere método de pago',
    'requires_confirmation': 'Pendiente de confirmación',
    'requires_action': 'Acción requerida',
    'processing': 'Procesando',
    'succeeded': 'Completado',
    'failed': 'Fallido',
    'canceled': 'Cancelado',
};

/**
 * Re-exportar tipos del dominio para conveniencia.
 */
export type {
    PaymentProviderId,
    PaymentMethodType,
    PaymentIntent,
    PaymentError,
    CurrencyCode,
    FallbackAvailableEvent,
    FieldRequirements,
    PaymentOptions,
};
