# Auditoria Infrastructure - Payments (Antes de Refactor)

Fecha: 2026-02-03
Scope: `src/app/features/payments/infrastructure/**` + ports referenciados + wiring de providers.
Branch: `refactor/infrastructure-sanitize`

## 1) Mapa rapido del slice (lo que entendi)

- `config/payment.providers.ts` actua como composition root y alterna providers reales/fake.
- Infra Stripe: DTOs, gateways HTTP (intent), mappers, policies, builders, strategies, normalizers (redirect/webhook), provider factory.
- Infra PayPal: DTOs, gateways (orders), redirect strategy, finalize handler, mappers, policies, normalizers.
- Infra browser: adapters para storage y navegacion externa.
- Infra fake: store y gateways simulados, helpers/mappers para escenarios y tests.

## 2) Hallazgos priorizados (P0/P1/P2)

### P0 — Infra y Application dependen de Presentation/UI

- **Que pasa:**
  - `provide-*-payments.ts` y `*ProviderFactory` importan tokens/contratos desde `@payments/presentation`.
  - `ProviderFactory`/`PaymentStorePort` dependen de `FieldRequirements` desde Presentation.
  - `application/api/contracts/checkout-field-requirements.types.ts` y `spei-display-config.types.ts` son re-exportes de Presentation.
- **Por que importa:** rompe el limite infra->application->domain y provoca que Infrastructure filtre UI hacia arriba.
- **Arreglo recomendado:**
  - Mover contratos a `application/api/contracts` (fuente real) y que Presentation re-exporte.
  - Sacar `PAYMENT_PROVIDER_UI_META`/`PAYMENT_PROVIDER_DESCRIPTORS` de infra hacia config.
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/stripe/core/di/provide-stripe-payments.ts`
  - `src/app/features/payments/infrastructure/paypal/core/di/provide-paypal-payments.ts`
  - `src/app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory.ts`
  - `src/app/features/payments/infrastructure/paypal/core/factories/paypal-provider.factory.ts`
  - `src/app/features/payments/application/api/ports/provider-factory.port.ts`
  - `src/app/features/payments/application/api/ports/payment-store.port.ts`
  - `src/app/features/payments/application/api/contracts/checkout-field-requirements.types.ts`
  - `src/app/features/payments/presentation/contracts/checkout-field-requirements.types.ts`
  - `src/app/features/payments/application/api/contracts/spei-display-config.types.ts`
  - `src/app/features/payments/presentation/contracts/spei-display-config.types.ts`
  - `src/app/features/payments/config/payment.providers.ts`

### P0 — Logging de tokens en claro

- **Que pasa:** `PaypalRedirectStrategy` loguea el token completo si viene en la request.
- **Por que importa:** riesgo de exponer credenciales/PII en logs.
- **Arreglo recomendado:** enmascarar o eliminar el token en logs (usar prefijo o `***`).
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy.ts`

### P1 — Normalizacion de errores provider-specific no esta conectada

- **Que pasa:** Stripe tiene mappers (`error-code`, `error-key`, `error-response`) pero los gateways siguen devolviendo `provider_error` generico; PayPal no normaliza errores.
- **Por que importa:** la App pierde codigos estables y mensajes consistentes para UI/telemetry/tests.
- **Arreglo recomendado:** crear `StripeOperationPort`/`PaypalOperationPort` que sobreescriban `handleError` y actualizar gateways a esas bases.
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/stripe/shared/errors/mappers/*`
  - `src/app/features/payments/infrastructure/stripe/workflows/intent/gateways/intent/*.gateway.ts`
  - `src/app/features/payments/infrastructure/paypal/workflows/order/gateways/*.gateway.ts`

### P1 — Claves i18n acopladas a infra

- **Que pasa:** infra importa `@core/i18n` para errores e instrucciones.
- **Por que importa:** hace a Infrastructure dependiente de UI/catalogo de traducciones; complica tests y refactors.
- **Arreglo recomendado:** centralizar claves en `payments/shared/constants` y usar strings constantes, no `I18nKeys` en infra.
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/**/*` (builders, strategies, policies, fakes)

### P2 — UI strings hardcoded y config SPEI mal ubicada

- **Que pasa:** `SpeiSourceMapper` inyecta instrucciones en ingles y `SPEI_DISPLAY_CONSTANTS` vive en `infrastructure/fake`.
- **Por que importa:** rompe i18n y mezcla fake/real.
- **Arreglo recomendado:** `SpeiSourceMapper` solo mapea datos y `SPEI_DISPLAY_CONSTANTS` se mueve a `stripe/shared/constants`.
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper.ts`
  - `src/app/features/payments/infrastructure/fake/shared/constants/spei-display.constants.ts`

### P2 — Throw genericos en policies

- **Que pasa:** `StripeProviderMethodPolicy` y `PaypalProviderMethodPolicy` usan `new Error`.
- **Por que importa:** rompe el patron de errores tipados.
- **Arreglo recomendado:** usar `invalidRequestError` con claves compartidas.
- **Archivos afectados:**
  - `src/app/features/payments/infrastructure/stripe/shared/policies/stripe-provider-method.policy.ts`
  - `src/app/features/payments/infrastructure/paypal/shared/policies/paypal-provider-method.policy.ts`

## 3) Plan de refactor incremental (max 5 pasos)

1. **Objetivo:** re-anclar contratos UI en `application/api/contracts` y eliminar imports a Presentation desde infra.
   - **Archivos:** `src/app/features/payments/application/api/contracts/*.types.ts`, `src/app/features/payments/presentation/contracts/*.types.ts`, `src/app/features/payments/application/api/ports/*.ts`, `src/app/features/payments/infrastructure/**/*`.
   - **DoD:** `rg -n "@payments/presentation" src/app/features/payments/infrastructure` sin resultados.
2. **Objetivo:** sacar UI meta/descriptors de infra hacia config.
   - **Archivos:** `src/app/features/payments/config/payment-ui.providers.ts` (nuevo), `src/app/features/payments/config/payment.providers.ts`, `src/app/features/payments/infrastructure/*/core/di/provide-*.ts`.
   - **DoD:** `rg -n "PAYMENT_PROVIDER_UI_META|PAYMENT_PROVIDER_DESCRIPTORS" src/app/features/payments/infrastructure` sin resultados.
3. **Objetivo:** centralizar claves i18n en `payments/shared/constants` y reemplazar `I18nKeys` en infra.
   - **Archivos:** `src/app/features/payments/shared/constants/payment-error-keys.ts`, `src/app/features/payments/shared/constants/payment-ui-keys.ts` (nuevo), builders/strategies/policies/fakes infra.
   - **DoD:** `rg -n "@core/i18n" src/app/features/payments/infrastructure` sin resultados.
4. **Objetivo:** normalizar errores por provider y actualizar gateways.
   - **Archivos:** `src/app/features/payments/infrastructure/stripe/shared/errors/stripe-operation.port.ts` (nuevo), `src/app/features/payments/infrastructure/paypal/shared/errors/paypal-operation.port.ts` (nuevo), gateways Stripe/PayPal.
   - **DoD:** errores HTTP mapean a `PaymentError` con `code` y `messageKey` estables.
5. **Objetivo:** limpiar SPEI mapper y mover config de display.
   - **Archivos:** `src/app/features/payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper.ts`, `src/app/features/payments/infrastructure/stripe/shared/constants/spei-display.constants.ts` (nuevo), `src/app/features/payments/infrastructure/fake/shared/constants/spei-display.constants.ts` (borrar o re-export).
   - **DoD:** sin instrucciones hardcoded en mapper, sin config real en `fake`.

## 4) Cambios propuestos por archivo (sin diffs)

### `src/app/features/payments/application/api/contracts/checkout-field-requirements.types.ts`

- **Problemas puntuales:** re-exporta desde Presentation, creando dependencia inversa.
- **Nuevo diseno:** el contrato vive aqui; Presentation re-exporta.
- **Codigo propuesto:**

```ts
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';

/**
 * HTML input types supported in checkout forms.
 * UI schema contract — not domain logic.
 */
export const FIELD_TYPES = ['text', 'email', 'hidden', 'url'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Autocomplete hints for form fields (HTML autocomplete attribute values).
 * UI schema contract — not domain logic.
 */
export const AUTOCOMPLETE_HINTS = [
  'email',
  'name',
  'given-name',
  'family-name',
  'tel',
  'street-address',
  'postal-code',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'off',
  'current-url',
] as const;

export type AutoCompleteHint = (typeof AUTOCOMPLETE_HINTS)[number];

/**
 * Field requirements for a specific provider/method.
 *
 * The UI queries this BEFORE rendering the form
 * to know which fields to show.
 */
export interface FieldRequirement {
  name: keyof PaymentOptions;
  labelKey: string;
  placeholderKey?: string;
  descriptionKey?: string;
  instructionsKey?: string;

  required: boolean;
  type: FieldType;

  autoComplete?: AutoCompleteHint;
  defaultValue?: string;
}

export interface FieldRequirements {
  descriptionKey?: string;
  instructionsKey?: string;
  fields: FieldRequirement[];
}
```

## 5) Config tokens (post-refactor notes)

- `PAYMENTS_INFRA_CONFIG`
  - **Que es:** fuente tipada de endpoints, timeouts y defaults de PayPal/SPEI.
  - **Donde se provee:** `src/app/features/payments/config/payment.providers.ts` via `providePaymentsInfraConfig(...)`.
  - **Quien lo consume:** gateways Stripe/PayPal + config/presentation providers.
- `SPEI_DISPLAY_CONFIG`
  - **Que es:** config de UI para SPEI (receivingBanks + beneficiaryName).
  - **Donde se provee:** `selectPresentationProviders()` en `src/app/features/payments/config/payment.providers.ts`.
  - **Quien lo consume:** UI (resuelve bankCode -> displayName) y tests de UI.
- `PAYMENT_PROVIDER_UI_META` / `PAYMENT_PROVIDER_DESCRIPTORS`
  - **Que es:** metadata de UI + descriptores de proveedor (i18n keys, estilos, iconos, métodos soportados).
  - **Donde se provee:** `PAYMENT_UI_PROVIDERS` en `src/app/features/payments/config/payment-ui.providers.ts`.
  - **Quien lo consume:** UI (botones/catalogo) vía registries en Application.

### `src/app/features/payments/presentation/contracts/checkout-field-requirements.types.ts`

- **Problemas puntuales:** fuente real en Presentation genera acoplamiento infra->UI.
- **Nuevo diseno:** Presentation re-exporta el contrato de Application.
- **Codigo propuesto:**

```ts
/** @deprecated Use application contract to avoid infra->presentation coupling. */
export * from '@payments/application/api/contracts/checkout-field-requirements.types';
```

### `src/app/features/payments/application/api/contracts/spei-display-config.types.ts`

- **Problemas puntuales:** re-exporta desde Presentation.
- **Nuevo diseno:** contrato vive aqui.
- **Codigo propuesto:**

```ts
/**
 * Configuration for SPEI manual-step display (bank names, beneficiary, fallback CLABE).
 */
export interface SpeiDisplayConfig {
  /** Map provider id -> receiving bank display name. */
  receivingBanks: Record<string, string>;
  /** Beneficiary name shown in SPEI transfer details. */
  beneficiaryName: string;
  /** Fallback CLABE when gateway does not return one (e.g. test/demo). */
  testClabe: string;
}
```

### `src/app/features/payments/presentation/contracts/spei-display-config.types.ts`

- **Problemas puntuales:** fuente real en Presentation.
- **Nuevo diseno:** re-export desde Application.
- **Codigo propuesto:**

```ts
/** @deprecated Use application contract to avoid infra->presentation coupling. */
export * from '@payments/application/api/contracts/spei-display-config.types';
```

### `src/app/features/payments/shared/constants/payment-error-keys.ts`

- **Problemas puntuales:** faltan claves usadas por infra; obliga a `I18nKeys`.
- **Nuevo diseno:** concentrar claves de errores y mensajes aqui.
- **Codigo propuesto:**

```ts
/**
 * Error and message keys for payment flows.
 *
 * These are opaque strings that the UI layer translates via i18n.
 * Convention: keys must match entries in en.ts/es.ts translation files.
 *
 * Kept in Shared (not Domain) so Domain stays agnostic of UI vocabulary.
 */
export const PAYMENT_ERROR_KEYS = {
  // Card errors
  CARD_TOKEN_REQUIRED: 'errors.card_token_required',
  CARD_TOKEN_INVALID_FORMAT: 'errors.card_token_invalid_format',

  // Amount errors (shared across methods)
  MIN_AMOUNT: 'errors.min_amount',
  MAX_AMOUNT: 'errors.max_amount',
  AMOUNT_INVALID: 'errors.amount_invalid',

  // Request errors
  INVALID_REQUEST: 'errors.invalid_request',
  ORDER_ID_REQUIRED: 'errors.order_id_required',
  ORDER_ID_INVALID: 'errors.order_id_invalid',
  ORDER_ID_TOO_LONG: 'errors.order_id_too_long',
  CURRENCY_REQUIRED: 'errors.currency_required',
  CURRENCY_NOT_SUPPORTED: 'errors.currency_not_supported',
  METHOD_TYPE_REQUIRED: 'errors.method_type_required',
  RETURN_URL_REQUIRED: 'errors.return_url_required',
  CANCEL_URL_REQUIRED: 'errors.cancel_url_required',
  PAYMENT_METHOD_AMBIGUOUS: 'errors.payment_method_ambiguous',
  PAYMENT_METHOD_NOT_SUPPORTED: 'errors.payment_method_not_supported',
  CUSTOMER_EMAIL_REQUIRED: 'errors.customer_email_required',
  CUSTOMER_EMAIL_INVALID: 'errors.customer_email_invalid',

  // Provider/runtime
  PROVIDER_ERROR: 'errors.provider_error',
  TIMEOUT: 'errors.timeout',
  UNKNOWN_ERROR: 'errors.unknown_error',

  // Card/provider specific
  CARD_DECLINED: 'errors.card_declined',
  INSUFFICIENT_FUNDS: 'errors.insufficient_funds',
  EXPIRED_CARD: 'errors.expired_card',
  INCORRECT_CVC: 'errors.incorrect_cvc',
  INCORRECT_NUMBER: 'errors.incorrect_number',
  PROCESSING_ERROR: 'errors.processing_error',
  AUTHENTICATION_REQUIRED: 'errors.authentication_required',
  STRIPE_ERROR: 'errors.stripe_error',
} as const;

/**
 * Message keys for user-facing instructions (not errors).
 *
 * Used by strategies to communicate next steps to the user.
 * The UI translates these keys to localized text.
 */
export const PAYMENT_MESSAGE_KEYS = {
  BANK_VERIFICATION_REQUIRED: 'messages.bank_verification_required',
  SPEI_INSTRUCTIONS: 'messages.spei_instructions',

  // SPEI manual step instructions (displayed in order)
  SPEI_INSTRUCTION_COMPLETE_TRANSFER: 'messages.spei_instruction_complete_transfer',
  SPEI_INSTRUCTION_TRANSFER_EXACT: 'ui.transfer_exact_amount',
  SPEI_INSTRUCTION_KEEP_RECEIPT: 'ui.keep_receipt',
  SPEI_INSTRUCTION_MAKE_TRANSFER: 'messages.spei_instruction_make_transfer',

  // PayPal redirect flow
  PAYPAL_REDIRECT_SECURE_MESSAGE: 'ui.paypal_redirect_secure_message',
  REDIRECTED_TO_PAYPAL: 'ui.redirected_to_paypal',
} as const;

/**
 * UI label keys for SPEI manual step details (CLABE, Reference, Bank, etc.).
 *
 * The strategy uses these as detail.label; the UI translates via i18n when rendering.
 */
export const PAYMENT_SPEI_DETAIL_LABEL_KEYS = {
  CLABE: 'ui.clabe_label',
  REFERENCE: 'ui.reference',
  BANK: 'ui.destination_bank',
  BENEFICIARY: 'ui.beneficiary',
  AMOUNT: 'ui.amount_label',
  EXPIRES_AT: 'ui.reference_expires',
} as const;
```

### `src/app/features/payments/shared/constants/payment-ui-keys.ts`

- **Problemas puntuales:** UI keys dispersas en infra.
- **Nuevo diseno:** centralizar keys de UI usadas por infra/config.
- **Codigo propuesto:**

```ts
export const PAYMENT_UI_KEYS = {
  PROVIDER_STRIPE: 'ui.provider_stripe',
  PROVIDER_STRIPE_DESCRIPTION: 'ui.provider_stripe_description',
  PROVIDER_PAYPAL: 'ui.provider_paypal',
  PROVIDER_PAYPAL_DESCRIPTION: 'ui.provider_paypal_description',

  CARD_PAYMENT_DESCRIPTION: 'ui.card_payment_description',
  ENTER_CARD_DATA: 'ui.enter_card_data',
  CARD_TOKEN: 'ui.card_token',
  SAVE_CARD_FUTURE: 'ui.save_card_future',

  SPEI_BANK_TRANSFER: 'ui.spei_bank_transfer',
  SPEI_EMAIL_INSTRUCTIONS: 'ui.spei_email_instructions',
  EMAIL_LABEL: 'ui.email_label',
  EMAIL_PLACEHOLDER: 'ui.email_placeholder',

  PAY_WITH_PAYPAL: 'ui.pay_with_paypal',
} as const;
```

### `src/app/features/payments/config/payment-ui.providers.ts`

- **Problemas puntuales:** UI meta/descriptors viven en infra.
- **Nuevo diseno:** mover UI meta/descriptors a config.
- **Codigo propuesto:**

```ts
import type { Provider } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { PAYMENT_PROVIDER_DESCRIPTORS } from '@payments/application/api/tokens/provider/payment-provider-descriptors.token';
import {
  PAYMENT_PROVIDER_UI_META,
  type PaymentProviderUiMeta,
} from '@payments/application/api/tokens/provider/payment-provider-ui-meta.token';

const STRIPE_UI_META = {
  providerId: 'stripe',
  displayNameKey: I18nKeys.ui.provider_stripe,
  buttonClasses: 'bg-stripe-primary hover:opacity-90 text-white focus:ring-stripe-primary',
} as const satisfies PaymentProviderUiMeta;

const PAYPAL_UI_META = {
  providerId: 'paypal',
  displayNameKey: I18nKeys.ui.provider_paypal,
  buttonClasses: 'bg-paypal-primary hover:opacity-90 text-white focus:ring-paypal-primary',
} as const satisfies PaymentProviderUiMeta;

const STRIPE_DESCRIPTOR = {
  id: 'stripe' as const,
  labelKey: I18nKeys.ui.provider_stripe,
  descriptionKey: I18nKeys.ui.provider_stripe_description,
  icon: '💳',
  supportedMethods: ['card', 'spei'] as const,
};

const PAYPAL_DESCRIPTOR = {
  id: 'paypal' as const,
  labelKey: I18nKeys.ui.provider_paypal,
  descriptionKey: I18nKeys.ui.provider_paypal_description,
  icon: '🅿️',
  supportedMethods: ['card', 'spei'] as const,
};

export const PAYMENT_UI_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_UI_META, useValue: STRIPE_UI_META, multi: true },
  { provide: PAYMENT_PROVIDER_UI_META, useValue: PAYPAL_UI_META, multi: true },
  { provide: PAYMENT_PROVIDER_DESCRIPTORS, useValue: STRIPE_DESCRIPTOR, multi: true },
  { provide: PAYMENT_PROVIDER_DESCRIPTORS, useValue: PAYPAL_DESCRIPTOR, multi: true },
];
```

### `src/app/features/payments/config/payment.providers.ts`

- **Problemas puntuales:** UI meta/descriptors no estan en config.
- **Nuevo diseno:** agregar `PAYMENT_UI_PROVIDERS`.
- **Codigo propuesto:**

```ts
import { PAYMENT_UI_PROVIDERS } from '@payments/config/payment-ui.providers';

function buildPaymentsProviders(options: PaymentsProvidersOptions = {}): Provider[] {
  const mode = options.mode ?? 'fake';

  return [
    ...selectProviderConfigs(mode),
    ...USE_CASE_PROVIDERS,
    ...ACTION_PORT_PROVIDERS,
    ...APPLICATION_PROVIDERS,
    ...SHARED_PROVIDERS,
    ...ENV_PROVIDERS,
    ...PAYMENT_UI_PROVIDERS,
    ...UI_PROVIDERS,
    {
      provide: WEBHOOK_NORMALIZER_REGISTRY,
      useValue: {
        stripe: new StripeWebhookNormalizer(),
        paypal: new PaypalWebhookNormalizer(),
      },
    },
    ...(options.extraProviders ?? []),
  ];
}
```

### `src/app/features/payments/infrastructure/stripe/core/di/provide-stripe-payments.ts`

- **Problemas puntuales:** UI meta/descriptors inyectados desde infra.
- **Nuevo diseno:** infra solo registra gateways/strategies/policies.
- **Codigo propuesto:**

```ts
import type { Provider } from '@angular/core';
import { StripeProviderFactory } from '@app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory';
import { StripeProviderMethodPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-provider-method.policy';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import { REDIRECT_RETURN_NORMALIZERS } from '@payments/application/api/tokens/redirect/redirect-return-normalizers.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { FakeIntentStore } from '@payments/infrastructure/fake/shared/state/fake-intent.store';
import { FakeStripeCancelIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-cancel-intent.gateway';
import { FakeStripeClientConfirmPort } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-client-confirm.port';
import { FakeStripeConfirmIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-confirm-intent.gateway';
import { FakeStripeCreateIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-create-intent.gateway';
import { FakeStripeGetIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-get-intent.gateway';
import { FakeStripeProviderFactory } from '@payments/infrastructure/stripe/testing/fake-stripe-provider.factory';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway';
import { StripeRedirectReturnNormalizer } from '@payments/infrastructure/stripe/workflows/redirect/stripe-redirect-return.normalizer';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
export { StripeWebhookNormalizer } from '@payments/infrastructure/stripe/workflows/webhook/stripe-webhook.normalizer';

const STRIPE_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
];

const STRIPE_POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: StripeProviderMethodPolicy, multi: true },
];

const STRIPE_REDIRECT_RETURN_PROVIDERS: Provider[] = [
  { provide: REDIRECT_RETURN_NORMALIZERS, useClass: StripeRedirectReturnNormalizer, multi: true },
];

const STRIPE_REAL_PROVIDERS: Provider[] = [
  StripeIntentFacade,
  StripeCreateIntentGateway,
  StripeConfirmIntentGateway,
  StripeCancelIntentGateway,
  StripeGetIntentGateway,
  ...STRIPE_FACTORY_PROVIDERS,
  ...STRIPE_POLICY_PROVIDERS,
  ...STRIPE_REDIRECT_RETURN_PROVIDERS,
];

const STRIPE_FAKE_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: FakeStripeProviderFactory, multi: true },
];

const STRIPE_FAKE_PROVIDERS: Provider[] = [
  FakeIntentStore,
  FakeStripeClientConfirmPort,
  FakeStripeCreateIntentGateway,
  FakeStripeConfirmIntentGateway,
  FakeStripeCancelIntentGateway,
  FakeStripeGetIntentGateway,
  fakeIntentFacadeFactory(
    'stripe',
    StripeIntentFacade,
    FakeStripeCreateIntentGateway,
    FakeStripeConfirmIntentGateway,
    FakeStripeCancelIntentGateway,
    FakeStripeGetIntentGateway,
  ),
  ...STRIPE_FAKE_FACTORY_PROVIDERS,
  ...STRIPE_POLICY_PROVIDERS,
  ...STRIPE_REDIRECT_RETURN_PROVIDERS,
];

export function provideStripePayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return STRIPE_REAL_PROVIDERS;
  }
  return STRIPE_FAKE_PROVIDERS;
}
```

### `src/app/features/payments/infrastructure/paypal/core/di/provide-paypal-payments.ts`

- **Problemas puntuales:** UI meta/descriptors inyectados desde infra.
- **Nuevo diseno:** infra solo registra gateways/strategies/policies.
- **Codigo propuesto:**

```ts
import type { Provider } from '@angular/core';
import { PaypalProviderFactory } from '@app/features/payments/infrastructure/paypal/core/factories/paypal-provider.factory';
import { PaypalProviderMethodPolicy } from '@app/features/payments/infrastructure/paypal/shared/policies/paypal-provider-method.policy';
import { PaypalCancelIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { PaypalGetIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';
import { PaypalIntentFacade } from '@app/features/payments/infrastructure/paypal/workflows/order/order.facade';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import { REDIRECT_RETURN_NORMALIZERS } from '@payments/application/api/tokens/redirect/redirect-return-normalizers.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { FakePaypalCancelIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-cancel-intent.gateway';
import { FakePaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-confirm-intent.gateway';
import { FakePaypalCreateIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-create-intent.gateway';
import { FakePaypalGetIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-get-intent.gateway';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import { PaypalRedirectReturnNormalizer } from '@payments/infrastructure/paypal/workflows/redirect/paypal-redirect-return.normalizer';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
export { PaypalWebhookNormalizer } from '@payments/infrastructure/paypal/workflows/webhook/paypal-webhook.normalizer';

const PAYPAL_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

const PAYPAL_POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: PaypalProviderMethodPolicy, multi: true },
];

const PAYPAL_REDIRECT_RETURN_PROVIDERS: Provider[] = [
  { provide: REDIRECT_RETURN_NORMALIZERS, useClass: PaypalRedirectReturnNormalizer, multi: true },
];

const PAYPAL_REAL_PROVIDERS: Provider[] = [
  PaypalIntentFacade,
  PaypalCreateIntentGateway,
  PaypalConfirmIntentGateway,
  PaypalCancelIntentGateway,
  PaypalGetIntentGateway,
  PaypalFinalizeHandler,
  ...PAYPAL_FACTORY_PROVIDERS,
  ...PAYPAL_POLICY_PROVIDERS,
  ...PAYPAL_REDIRECT_RETURN_PROVIDERS,
];

const PAYPAL_FAKE_PROVIDERS: Provider[] = [
  FakePaypalCreateIntentGateway,
  FakePaypalConfirmIntentGateway,
  FakePaypalCancelIntentGateway,
  FakePaypalGetIntentGateway,
  PaypalFinalizeHandler,
  fakeIntentFacadeFactory(
    'paypal',
    PaypalIntentFacade,
    FakePaypalCreateIntentGateway,
    FakePaypalConfirmIntentGateway,
    FakePaypalCancelIntentGateway,
    FakePaypalGetIntentGateway,
  ),
  ...PAYPAL_FACTORY_PROVIDERS,
  ...PAYPAL_POLICY_PROVIDERS,
  ...PAYPAL_REDIRECT_RETURN_PROVIDERS,
];

export function providePaypalPayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return PAYPAL_REAL_PROVIDERS;
  }
  return PAYPAL_FAKE_PROVIDERS;
}
```

### `src/app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory.ts`

- **Problemas puntuales:** usa `I18nKeys` y `FieldRequirements` de Presentation; usa `SPEI_DISPLAY_CONSTANTS` desde `fake`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`/`PAYMENT_UI_KEYS` y mover `SPEI_DISPLAY_CONSTANTS` a `stripe/shared/constants`.
- **Codigo propuesto (metodos relevantes):**

```ts
import { inject, Injectable } from '@angular/core';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { PaymentRequestBuilderPort } from '@app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port';
import { StripeTokenValidatorPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-token-validator.policy';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { StripeCardRequestBuilder } from '@payments/infrastructure/stripe/payment-methods/card/builders/stripe-card-request.builder';
import { StripeSpeiRequestBuilder } from '@payments/infrastructure/stripe/payment-methods/spei/builders/stripe-spei-request.builder';
import { SPEI_DISPLAY_CONSTANTS } from '@payments/infrastructure/stripe/shared/constants/spei-display.constants';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_UI_KEYS } from '@payments/shared/constants/payment-ui-keys';
import { CardStrategy } from '@payments/shared/strategies/card-strategy';
import { SpeiStrategy } from '@payments/shared/strategies/spei-strategy';

@Injectable()
export class StripeProviderFactory implements ProviderFactory {
  readonly providerId = 'stripe' as const;

  private readonly gateway = inject(StripeIntentFacade);
  private readonly logger = inject(LoggerService);

  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card', 'spei'];

  getGateway(): PaymentGatewayPort {
    return this.gateway;
  }

  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilderPort {
    this.assertSupported(type);

    switch (type) {
      case 'card':
        return new StripeCardRequestBuilder();
      case 'spei':
        return new StripeSpeiRequestBuilder();
      default:
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'no_builder_for_payment_method',
          type,
        });
    }
  }

  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    switch (type) {
      case 'card':
        return {
          descriptionKey: PAYMENT_UI_KEYS.CARD_PAYMENT_DESCRIPTION,
          instructionsKey: PAYMENT_UI_KEYS.ENTER_CARD_DATA,
          fields: [
            {
              name: 'token',
              labelKey: PAYMENT_UI_KEYS.CARD_TOKEN,
              required: true,
              type: 'hidden',
              defaultValue: 'tok_visa1234567890abcdef',
            },
            {
              name: 'saveForFuture',
              labelKey: PAYMENT_UI_KEYS.SAVE_CARD_FUTURE,
              required: false,
              type: 'text',
              defaultValue: 'false',
            },
          ],
        };
      case 'spei':
        return {
          descriptionKey: PAYMENT_UI_KEYS.SPEI_BANK_TRANSFER,
          instructionsKey: PAYMENT_UI_KEYS.SPEI_EMAIL_INSTRUCTIONS,
          fields: [
            {
              name: 'customerEmail',
              labelKey: PAYMENT_UI_KEYS.EMAIL_LABEL,
              placeholderKey: PAYMENT_UI_KEYS.EMAIL_PLACEHOLDER,
              required: true,
              type: 'email',
            },
          ],
        };
      default:
        return { fields: [] };
    }
  }

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
        reason: 'unsupported_payment_method',
        supportedMethods: StripeProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new CardStrategy(this.gateway, new StripeTokenValidatorPolicy(), this.logger);
      case 'spei':
        return new SpeiStrategy(this.gateway, this.logger, SPEI_DISPLAY_CONSTANTS);
      default:
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'unexpected_payment_method_type',
          type,
        });
    }
  }
}
```

### `src/app/features/payments/infrastructure/paypal/core/factories/paypal-provider.factory.ts`

- **Problemas puntuales:** usa `I18nKeys` y `FieldRequirements` desde Presentation.
- **Nuevo diseno:** usar constantes de shared y contrato en Application.
- **Codigo propuesto (metodos relevantes):**

```ts
import { inject, Injectable } from '@angular/core';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { PaymentRequestBuilderPort } from '@app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port';
import { PaypalRedirectRequestBuilder } from '@app/features/payments/infrastructure/paypal/core/builders/paypal-redirect-request.builder';
import { PaypalRedirectStrategy } from '@app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy';
import { PaypalIntentFacade } from '@app/features/payments/infrastructure/paypal/workflows/order/order.facade';
import { LoggerService } from '@core/logging';
import type { FinalizePort } from '@payments/application/api/ports/finalize.port';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import {
  PAYMENT_ERROR_KEYS,
  PAYMENT_MESSAGE_KEYS,
} from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_UI_KEYS } from '@payments/shared/constants/payment-ui-keys';

@Injectable()
export class PaypalProviderFactory implements ProviderFactory {
  readonly providerId = 'paypal' as const;

  private readonly gateway = inject(PaypalIntentFacade);
  private readonly logger = inject(LoggerService);
  private readonly finalizeHandler = inject(PaypalFinalizeHandler);

  private readonly strategyCache = new Map<PaymentMethodType, PaymentStrategy>();

  static readonly SUPPORTED_METHODS: PaymentMethodType[] = ['card'];

  createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilderPort {
    this.assertSupported(type);
    return new PaypalRedirectRequestBuilder();
  }

  getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    this.assertSupported(type);

    return {
      descriptionKey: PAYMENT_UI_KEYS.PAY_WITH_PAYPAL,
      instructionsKey: PAYMENT_MESSAGE_KEYS.PAYPAL_REDIRECT_SECURE_MESSAGE,
      fields: [],
    };
  }

  getFinalizeHandler(): FinalizePort | null {
    return this.finalizeHandler;
  }

  private assertSupported(type: PaymentMethodType): void {
    if (!this.supportsMethod(type)) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
        reason: 'unsupported_payment_method',
        supportedMethods: PaypalProviderFactory.SUPPORTED_METHODS.join(', '),
      });
    }
  }

  private instantiateStrategy(type: PaymentMethodType): PaymentStrategy {
    switch (type) {
      case 'card':
        return new PaypalRedirectStrategy(this.gateway, this.logger);
      default:
        throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
          reason: 'unexpected_payment_method_type',
          type,
        });
    }
  }
}
```

### `src/app/features/payments/infrastructure/stripe/shared/policies/base-token-validator.ts`

- **Problemas puntuales:** acopla infra a `@core/i18n`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto:**

```ts
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { TokenValidator } from '@app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export abstract class BaseTokenValidator implements TokenValidator {
  protected abstract readonly patterns: RegExp[];
  protected abstract readonly patternDescriptions: string[];

  validate(token: string): void {
    if (!this.requiresToken()) {
      return;
    }

    if (!token) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED);
    }

    if (!this.isValid(token)) {
      throw invalidRequestError(PAYMENT_ERROR_KEYS.CARD_TOKEN_INVALID_FORMAT, {
        expected: this.patternDescriptions.join(' or '),
        got: this.maskToken(token),
      });
    }
  }

  isValid(token: string): boolean {
    if (!this.requiresToken()) {
      return true;
    }

    if (!token) {
      return false;
    }

    return this.patterns.some((pattern) => pattern.test(token));
  }

  getAcceptedPatterns(): string[] {
    return [...this.patternDescriptions];
  }

  requiresToken(): boolean {
    return true;
  }

  protected maskToken(token: string): string {
    if (!token || token.length < 8) {
      return '***';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }
}
```

### `src/app/features/payments/infrastructure/stripe/shared/policies/stripe-provider-method.policy.ts`

- **Problemas puntuales:** `throw new Error`.
- **Nuevo diseno:** usar `invalidRequestError`.
- **Codigo propuesto:**

```ts
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export class StripeProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = 'stripe';

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: 'stripe',
        method: 'card',
        requires: { token: true },
        flow: { usesRedirect: false, requiresUserAction: true, supportsPolling: true },
        stages: { authorize: true, capture: true, settle: true },
      };
    }

    if (method === 'spei') {
      return {
        providerId: 'stripe',
        method: 'spei',
        requires: { token: false },
        flow: { usesRedirect: false, requiresUserAction: false, supportsPolling: true },
        stages: { authorize: true, capture: false, settle: true },
      };
    }

    throw invalidRequestError(PAYMENT_ERROR_KEYS.PAYMENT_METHOD_NOT_SUPPORTED, {
      provider: 'stripe',
      method,
    });
  }
}
```

### `src/app/features/payments/infrastructure/paypal/shared/policies/paypal-provider-method.policy.ts`

- **Problemas puntuales:** `throw new Error`.
- **Nuevo diseno:** usar `invalidRequestError`.
- **Codigo propuesto:**

```ts
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export class PaypalProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = 'paypal';

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: 'paypal',
        method: 'card',
        requires: { returnUrl: true, cancelUrl: false },
        flow: { usesRedirect: true, requiresUserAction: true, supportsPolling: true },
        stages: { authorize: true, capture: true, settle: true },
      };
    }

    throw invalidRequestError(PAYMENT_ERROR_KEYS.PAYMENT_METHOD_NOT_SUPPORTED, {
      provider: 'paypal',
      method,
    });
  }
}
```

### `src/app/features/payments/infrastructure/stripe/payment-methods/card/builders/stripe-card-request.builder.ts`

- **Problemas puntuales:** usa `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto (metodo completo):**

```ts
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

protected override validateRequired(): void {
  this.orderIdVo = this.createOrderIdOrThrow(this.orderId, PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED);
  this.requireDefinedWithKey('currency', this.currency, PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED);
  this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);
  this.requireNonEmptyStringWithKey('token', this.token, PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED);
}
```

### `src/app/features/payments/infrastructure/stripe/payment-methods/spei/builders/stripe-spei-request.builder.ts`

- **Problemas puntuales:** usa `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto (metodo completo):**

```ts
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

protected override validateRequired(): void {
  this.orderIdVo = this.createOrderIdOrThrow(this.orderId, PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED);
  this.requireDefinedWithKey('currency', this.currency, PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED);
  this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);

  this.requireEmailWithKey(
    'customerEmail',
    this.customerEmail,
    PAYMENT_ERROR_KEYS.CUSTOMER_EMAIL_REQUIRED,
    PAYMENT_ERROR_KEYS.CUSTOMER_EMAIL_INVALID,
  );
}
```

### `src/app/features/payments/infrastructure/paypal/core/builders/paypal-redirect-request.builder.ts`

- **Problemas puntuales:** usa `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto (metodo completo):**

```ts
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

protected override validateRequired(): void {
  this.orderIdVo = this.createOrderIdOrThrow(this.orderId, PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED);
  this.requireDefinedWithKey('currency', this.currency, PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED);
  this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);

  this.returnUrl = this.validateOptionalUrl('returnUrl', this.returnUrl);
  this.cancelUrl = this.validateOptionalUrl('cancelUrl', this.cancelUrl);
}
```

### `src/app/features/payments/infrastructure/paypal/payment-methods/redirect/strategies/paypal-redirect.strategy.ts`

- **Problemas puntuales:** usa `I18nKeys` y loguea token completo.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`/`PAYMENT_MESSAGE_KEYS` y enmascarar token.
- **Codigo propuesto (metodos completos):**

```ts
import { PAYMENT_ERROR_KEYS, PAYMENT_MESSAGE_KEYS } from '@payments/shared/constants/payment-error-keys';

validate(req: CreatePaymentRequest): void {
  const supportedCurrencies: CurrencyCode[] = ['USD', 'MXN'];

  if (!req.money.currency || !supportedCurrencies.includes(req.money.currency)) {
    throw invalidRequestError(
      PAYMENT_ERROR_KEYS.CURRENCY_NOT_SUPPORTED,
      {
        field: 'currency',
        provider: 'paypal',
        supportedCount: supportedCurrencies.length,
        currency: req.money.currency,
      },
      { currency: req.money.currency },
    );
  }

  const minAmounts: Record<CurrencyCode, number> = { USD: 1, MXN: 10 };
  const minAmount = minAmounts[req.money.currency] ?? 1;

  if (!Number.isFinite(req.money.amount) || req.money.amount < minAmount) {
    throw invalidRequestError(
      PAYMENT_ERROR_KEYS.AMOUNT_INVALID,
      { field: 'amount', min: minAmount, currency: req.money.currency },
      { amount: req.money.amount, currency: req.money.currency, minAmount },
    );
  }

  if (req.method?.token) {
    this.logger.warn(
      '[PaypalRedirectStrategy] Token provided but PayPal uses its own checkout flow',
      'PaypalRedirectStrategy',
      {
        token: this.maskToken(req.method.token),
      },
    );
  }
}

prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
  if (!context?.returnUrl) {
    throw invalidRequestError(
      PAYMENT_ERROR_KEYS.RETURN_URL_REQUIRED,
      { field: 'returnUrl', provider: 'paypal' },
      { returnUrl: context?.returnUrl },
    );
  }

  const returnUrl = context.returnUrl;
  const cancelUrl = context.cancelUrl ?? returnUrl;

  const metadata: Record<string, unknown> = {
    payment_method_type: 'paypal_redirect',
    return_url: returnUrl,
    cancel_url: cancelUrl,
    landing_page: PaypalRedirectStrategy.DEFAULT_LANDING_PAGE,
    user_action: PaypalRedirectStrategy.DEFAULT_USER_ACTION,
    brand_name: 'Payment Service',
    timestamp: new Date().toISOString(),
    formatted_amount: req.money.amount.toFixed(2),
  };

  if (context?.deviceData) {
    metadata['paypal_client_metadata_id'] = this.generateClientMetadataId(context.deviceData);
  }

  return {
    preparedRequest: {
      ...req,
      method: { type: 'card' },
      returnUrl,
      cancelUrl,
    },
    metadata,
  };
}

getUserInstructions(intent: PaymentIntent): string[] | null {
  if (intent.status === 'succeeded') {
    return null;
  }
  return [
    PAYMENT_MESSAGE_KEYS.PAYPAL_REDIRECT_SECURE_MESSAGE,
    PAYMENT_MESSAGE_KEYS.REDIRECTED_TO_PAYPAL,
  ];
}

private maskToken(token: string): string {
  if (!token || token.length < 8) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
```

### `src/app/features/payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper.ts`

- **Problemas puntuales:** instrucciones hardcoded en ingles.
- **Nuevo diseno:** mapper solo transforma DTO -> PaymentIntent (sin UI).
- **Codigo propuesto:**

```ts
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { SpeiStatusMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-status.mapper';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export class SpeiSourceMapper {
  constructor(private readonly providerId: PaymentProviderId) {}

  mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
    const status = new SpeiStatusMapper().mapSpeiStatus(dto.status);

    return {
      id: toPaymentIntentIdOrThrow(dto.id),
      provider: this.providerId,
      status,
      money: {
        amount: dto.amount / 100,
        currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
      },
      raw: dto,
    };
  }
}
```

### `src/app/features/payments/infrastructure/stripe/shared/constants/spei-display.constants.ts`

- **Problemas puntuales:** hoy vive en `fake` pero se usa en real.
- **Nuevo diseno:** mover a `stripe/shared/constants`.
- **Codigo propuesto:**

```ts
import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';

export const SPEI_DISPLAY_CONSTANTS: SpeiDisplayConfig = {
  receivingBanks: {
    stripe: 'STP (Transfers and Payments System)',
    conekta: 'STP (Transfers and Payments System)',
    openpay: 'BBVA Mexico',
  },
  beneficiaryName: 'Payment Service SA de CV',
  testClabe: '646180111812345678',
};
```

### `src/app/features/payments/infrastructure/stripe/shared/errors/mappers/error-key.mapper.ts`

- **Problemas puntuales:** depende de `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto:**

```ts
import type { StripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export class ErrorKeyMapper {
  mapErrorKey(error: StripeErrorResponse['error']): string {
    const errorKeyMap: Partial<Record<string, string>> = {
      card_declined: PAYMENT_ERROR_KEYS.CARD_DECLINED,
      expired_card: PAYMENT_ERROR_KEYS.EXPIRED_CARD,
      incorrect_cvc: PAYMENT_ERROR_KEYS.INCORRECT_CVC,
      processing_error: PAYMENT_ERROR_KEYS.PROCESSING_ERROR,
      incorrect_number: PAYMENT_ERROR_KEYS.INCORRECT_NUMBER,
      authentication_required: PAYMENT_ERROR_KEYS.AUTHENTICATION_REQUIRED,
    };

    return errorKeyMap[error.code] ?? PAYMENT_ERROR_KEYS.STRIPE_ERROR;
  }
}
```

### `src/app/features/payments/infrastructure/stripe/shared/errors/stripe-operation.port.ts`

- **Problemas puntuales:** los gateways devuelven `provider_error` generico.
- **Nuevo diseno:** base class por provider que normaliza errores Stripe.
- **Codigo propuesto:**

```ts
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { createPaymentError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { ERROR_CODE_MAP } from '@payments/infrastructure/stripe/shared/errors/mappers/error-code.mapper';
import { ErrorKeyMapper } from '@payments/infrastructure/stripe/shared/errors/mappers/error-key.mapper';
import { isStripeErrorResponse } from '@payments/infrastructure/stripe/shared/errors/mappers/error-response.mapper';

const keyMapper = new ErrorKeyMapper();

export abstract class StripeOperationPort<TRequest, TDto, TResponse> extends PaymentOperationPort<
  TRequest,
  TDto,
  TResponse
> {
  protected override handleError(err: unknown): PaymentError {
    if (isStripeErrorResponse(err)) {
      const stripeError = err.error;
      const code = ERROR_CODE_MAP[stripeError.code] ?? 'provider_error';
      const messageKey = keyMapper.mapErrorKey(stripeError);
      return createPaymentError(code, messageKey, undefined, err);
    }

    return createPaymentError('provider_error', PAYMENT_ERROR_KEYS.PROVIDER_ERROR, undefined, err);
  }
}
```

### `src/app/features/payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway.ts`

- **Problemas puntuales:** extiende `PaymentOperationPort` generico.
- **Nuevo diseno:** extender `StripeOperationPort` (replicar en confirm/cancel/get).
- **Codigo propuesto:**

```ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type {
  StripeCreateIntentRequest,
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { STRIPE_API_BASE } from '@app/features/payments/infrastructure/stripe/shared/constants/base-api.constant';
import { SpeiSourceMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/shared/idempotency/get-idempotency-headers';
import { StripeOperationPort } from '@payments/infrastructure/stripe/shared/errors/stripe-operation.port';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeCreateIntentGateway extends StripeOperationPort<
  CreatePaymentRequest,
  StripePaymentIntentDto | StripeSpeiSourceDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  readonly providerId: PaymentProviderId = 'stripe' as const;
  private static readonly API_BASE = STRIPE_API_BASE;

  protected executeRaw(
    request: CreatePaymentRequest,
  ): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
    const stripeRequest = this.buildStripeCreateRequest(request);

    if (request.method.type === 'spei') {
      return this.http.post<StripeSpeiSourceDto>(
        `${StripeCreateIntentGateway.API_BASE}/sources`,
        stripeRequest,
        { headers: getIdempotencyHeaders(request.orderId.value, 'create', request.idempotencyKey) },
      );
    }

    return this.http.post<StripePaymentIntentDto>(
      `${StripeCreateIntentGateway.API_BASE}/intents`,
      stripeRequest,
      { headers: getIdempotencyHeaders(request.orderId.value, 'create', request.idempotencyKey) },
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
    if ('spei' in dto) {
      const mapper = new SpeiSourceMapper(this.providerId);
      return mapper.mapSpeiSource(dto as StripeSpeiSourceDto);
    }
    return mapPaymentIntent(dto as StripePaymentIntentDto, this.providerId);
  }

  private buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
    return {
      amount: Math.round(req.money.amount * 100),
      currency: req.money.currency.toLowerCase(),
      payment_method_types: [req.method.type === 'spei' ? 'spei' : 'card'],
      payment_method: req.method.token,
      metadata: {
        order_id: req.orderId.value,
        created_at: new Date().toISOString(),
      },
      description: `Order ${req.orderId.value}`,
    };
  }
}
```

### `src/app/features/payments/infrastructure/stripe/workflows/intent/gateways/intent/confirm-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `StripeOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { StripeOperationPort } from '@payments/infrastructure/stripe/shared/errors/stripe-operation.port';

export class StripeConfirmIntentGateway extends StripeOperationPort<
  ConfirmPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `StripeOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { StripeOperationPort } from '@payments/infrastructure/stripe/shared/errors/stripe-operation.port';

export class StripeCancelIntentGateway extends StripeOperationPort<
  CancelPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `StripeOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { StripeOperationPort } from '@payments/infrastructure/stripe/shared/errors/stripe-operation.port';

export class StripeGetIntentGateway extends StripeOperationPort<
  GetPaymentStatusRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/paypal/shared/errors/paypal-operation.port.ts`

- **Problemas puntuales:** no hay normalizacion PayPal.
- **Nuevo diseno:** base class por provider.
- **Codigo propuesto:**

```ts
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { createPaymentError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import type { PaypalErrorResponse } from '@payments/infrastructure/paypal/core/dto/paypal.dto';

function isPaypalErrorResponse(err: unknown): err is PaypalErrorResponse {
  if (!err || typeof err !== 'object') return false;
  const value = err as Record<string, unknown>;
  return typeof value['name'] === 'string' && typeof value['message'] === 'string';
}

export abstract class PaypalOperationPort<TRequest, TDto, TResponse> extends PaymentOperationPort<
  TRequest,
  TDto,
  TResponse
> {
  protected override handleError(err: unknown): PaymentError {
    if (isPaypalErrorResponse(err)) {
      const isInvalid = err.name === 'INVALID_REQUEST';
      return createPaymentError(
        isInvalid ? 'invalid_request' : 'provider_error',
        isInvalid ? PAYMENT_ERROR_KEYS.INVALID_REQUEST : PAYMENT_ERROR_KEYS.PROVIDER_ERROR,
        undefined,
        err,
      );
    }

    return createPaymentError('provider_error', PAYMENT_ERROR_KEYS.PROVIDER_ERROR, undefined, err);
  }
}
```

### `src/app/features/payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `PaypalOperationPort` (replicar en confirm/cancel/get).
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { PaypalOperationPort } from '@payments/infrastructure/paypal/shared/errors/paypal-operation.port';

export class PaypalCreateIntentGateway extends PaypalOperationPort<
  CreatePaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `PaypalOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { PaypalOperationPort } from '@payments/infrastructure/paypal/shared/errors/paypal-operation.port';

export class PaypalConfirmIntentGateway extends PaypalOperationPort<
  ConfirmPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/paypal/workflows/order/gateways/cancel-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `PaypalOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { PaypalOperationPort } from '@payments/infrastructure/paypal/shared/errors/paypal-operation.port';

export class PaypalCancelIntentGateway extends PaypalOperationPort<
  CancelPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway.ts`

- **Problemas puntuales:** base generica.
- **Nuevo diseno:** extender `PaypalOperationPort`.
- **Codigo propuesto (solo cambio de base/import):**

```ts
import { PaypalOperationPort } from '@payments/infrastructure/paypal/shared/errors/paypal-operation.port';

export class PaypalGetIntentGateway extends PaypalOperationPort<
  GetPaymentStatusRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  /* resto sin cambios */
}
```

### `src/app/features/payments/infrastructure/fake/shared/constants/fake-errors.ts`

- **Problemas puntuales:** depende de `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto:**

```ts
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { FakeScenario } from '@app/features/payments/infrastructure/fake/shared/types/fake-scenario.type';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export const FAKE_ERRORS: Record<FakeScenario, PaymentError> = {
  provider_error: {
    code: 'provider_error',
    messageKey: PAYMENT_ERROR_KEYS.PROVIDER_ERROR,
    raw: { scenario: 'provider_error' },
  },

  decline: {
    code: 'card_declined',
    messageKey: PAYMENT_ERROR_KEYS.CARD_DECLINED,
    raw: { scenario: 'decline' },
  },

  insufficient: {
    code: 'insufficient_funds',
    messageKey: PAYMENT_ERROR_KEYS.INSUFFICIENT_FUNDS,
    raw: { scenario: 'insufficient' },
  },

  expired: {
    code: 'expired_card',
    messageKey: PAYMENT_ERROR_KEYS.EXPIRED_CARD,
    raw: { scenario: 'expired' },
  },

  timeout: {
    code: 'timeout',
    messageKey: PAYMENT_ERROR_KEYS.TIMEOUT,
    raw: { scenario: 'timeout' },
  },
};
```

### `src/app/features/payments/infrastructure/fake/shared/helpers/validate-create.helper.ts`

- **Problemas puntuales:** usa `I18nKeys`.
- **Nuevo diseno:** usar `PAYMENT_ERROR_KEYS`.
- **Codigo propuesto (metodo completo):**

```ts
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

export function validateCreate(req: CreatePaymentRequest, providerId: PaymentProviderId) {
  if (!req.orderId)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED, { field: 'orderId' });
  if (!req.money?.currency)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED, { field: 'currency' });
  if (!Number.isFinite(req.money?.amount) || req.money.amount <= 0)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.AMOUNT_INVALID, { field: 'amount' });
  if (!req.method?.type)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.METHOD_TYPE_REQUIRED, { field: 'method.type' });
  if (providerId === 'paypal') return;
  if (req.method.type === 'card' && !req.method.token)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED, { field: 'method.token' });
}
```

## 5) Verificacion (comandos y checks)

- `bun run test:ci` (ejecutado con permisos escalados; OK).
- `bun run lint:fix`
- `bun run dep:check` (si existe script)
- `rg -n "@payments/presentation" src/app/features/payments/infrastructure`
- `rg -n "@core/i18n" src/app/features/payments/infrastructure`
- `rg -n "PAYMENT_PROVIDER_UI_META|PAYMENT_PROVIDER_DESCRIPTORS" src/app/features/payments/infrastructure`
- `rg -n "new Error\(" src/app/features/payments/infrastructure/stripe/shared/policies src/app/features/payments/infrastructure/paypal/shared/policies`
- `rg -n "Make a bank transfer|instructions: \['" src/app/features/payments/infrastructure/stripe/payment-methods/spei/mappers`
- `rg -n "token: req.method.token" src/app/features/payments/infrastructure/paypal/payment-methods`

## 6) Riesgos y trade-offs

- Mover contratos desde Presentation a Application puede requerir ajustar imports y tests de boundary; mitigar con re-exports temporales y actualizacion de tests.
- Cambios de claves i18n implican validar que existan en `en.ts/es.ts`; mitigar con smoke-check de catalogo.
- Normalizacion de errores puede cambiar mensajes visibles; mitigar actualizando snapshots/tests de UI y flujos de error.
