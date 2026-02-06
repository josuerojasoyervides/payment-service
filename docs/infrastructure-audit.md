# Infrastructure Production-Ready Plan — Payments

> Documento consolidado y limpio.
> Objetivo: llevar la capa Infrastructure (y wiring relacionado) a un estado “production-ready” sin romper Clean Architecture: UI y Domain no conocen frastructure; UI consume Application API (ports/tokens/contracts) y Infrastructure implementa detalles de providers.

---

## 0) North Star

### Objetivo (1 frase)

Centralizar configuración y validaciones, normalizar errores y contratos, y añadir resilience + security + observability con PRs pequeños, testeables y splegables.

### Principios / Guardrails

- Domain: puro (sin Angular/RxJS/HTTP/i18n). Tipos/reglas/VOs/errores genéricos.
- Application: orquesta y define contratos/ports/tokens; no depende de providers.
- Infrastructure: implementa ports; contiene lógica provider-specific; sin i18n.
- UI: renderiza; traduce/mapea error codes; no importa Infrastructure.
- Prohibido: branching por provider en UI/runtime (salvo wiring/composition root).
- Logs/telemetry: sin secretos; sanitización obligatoria.
- PRs incrementales <500 LOC, cada PR con tests.

---

## 1) Alcance

### Incluye

- src/app/features/payments/infrastructure/\*\*
- Wiring / composition root del feature (ej. payment.providers.ts)
- Contracts que hoy estén en lugares incorrectos y deban vivir en Application API
- Resilience states (máquina), policy y UI contracts necesarios

### No incluye (por ahora)

- Implementación real server-side de verificación de webhooks (solo “shape/port”)
- Optimización de performance / bundling (salvo que caiga como efecto colateral)
- Provider nuevo (MercadoPago) — este plan lo deja preparado

---

## 2) Organización objetivo (high level)

### Infrastructure (por provider)

- infrastructure/{provider}/
- core/dto/ → DTOs tipados
- shared/constants/ → constantes con prefijo por provider (ej. PAYPAL_STATUS_MAP)
- shared/guards/ → type guards / validaciones provider-specific
- config/ → config provider-only (si aplica)
- gateways/ → adapters HTTP/SDK implementando ports
- mappers/ → mapping DTO ↔ domain/application
- strategies/ → estrategias provider-specific
- builders/ → construcción de requests provider-specific (si aplica)

### Infrastructure (shared cross-provider)

- infrastructure/shared/validation/ → validaciones genéricas (ej. amount/currency)
- infrastructure/health/ → health ports/adapters (mock en tests)

### Application API (source of truth para UI)

- application/api/ports/\*\*
- application/api/tokens/\*\*
- application/api/contracts/\*\* (si aún se usa; idealmente contracts aquí o cerca)
- application/api/testing/\*\* (harnesses para integration tests)

---

## 3) Roadmap por PRs (incremental, deployable)

Nombres orientativos (ajusta a tu numeración real).
Cada PR debe incluir: tests + verificación final.

### PR0 — Baseline / Sanitización inicial ✅

Meta: preparar terreno para cambios grandes sin romper boundaries.

- Eliminar/evitar dependencias incorrectas.
- Asegurar que infra no importa i18n.
- Borrar FakeIntentStore si existe (o migrarlo a mapas internos por fake gateway).
- Añadir comandos/verificación en docs.

Tests PR0

- Smoke: compila, tests pasan, lint pasa.

---

### PR1 — Config & Contracts cleanup (infra ↔ application) ✅

Meta: centralizar config detrás de tokens y mover contracts al lugar correcto.

- Introducir token de config unificada (infra) y helper de provision.
- Mover contracts que UI consume a application/api/\*\* (sin deprecations si no hace falta).
- UI consume Application API; infra consume config vía DI.

Tests PR1

- Unit: providers registry / config resolution
- Integration: un flow happy path para asegurar wiring

---

### PR2 — Error normalization + mapping cross-provider ✅

Meta: estandarizar errores para que UI y resilience trabajen igual con cualquier provider.

- Definir/usar PaymentErrorCode genérico (domain/application).
- Infra mapea errores provider-specific → PaymentErrorCode (+ metadata safe).
- UI traduce PaymentErrorCode → texto via pipe/mapper (UI-only).

Tests PR2

- Unit: mapping por provider
- Unit: “no secrets in raw / metadata”
- Integration: falla controlada produce el mismo error code en UI

---

### PR3 — Shared validation + provider validation config ✅

Meta: reglas consistentes de validación (montos/moneda/métodos/urls) sin duplicación.

- ProviderValidationConfig completa (currencies, min/max por currency, métodos, urls).
- validateAmount(money, config) en infrastructure/shared/validation/:
- currency soportada
- min por currency
- max por currency
- error codes: currency_not_supported, amount_below_minimum, amount_above_maximum

validateAmount (ejemplo esperado)

```typescript
export function validateAmount(money: Money, config: ProviderValidationConfig): void;
```

Tests PR3

- Unit: validateAmount paths críticos (min/max/currency)
- Unit: config missing/invalid → error code claro
- Integration: provider real + fake usan misma validación

---

## 4) Resilience

### PR4a: Resilience Foundation ✅

Scope: ~300 LOC | Depende de: PR3

#### 4.A.5: Fallback Rules

Errores que activan fallback

```typescript
const FALLBACK_ELIGIBLE_ERRORS: PaymentErrorCode[] = [
  'provider_unavailable',
  'timeout',
  'network_error',
];
```

Errores que NUNCA activan fallback

```typescript
const FALLBACK_BLOCKED_ERRORS: PaymentErrorCode[] = [
  'card_declined', // Si decline es por fraude
];
```

Condición adicional: debe haber providers alternativos

#### 4.A.6: Feature Flag

| Variable                    | Default | Descripción               |
| --------------------------- | ------- | ------------------------- |
| PAYMENTS_RESILIENCE_ENABLED | true    | false bypasses resilience |

Tests PR4a

- Unit: adapter, decorator, fallback policy
- Coverage: 100% paths críticos

---

### PR4b: Resilience Machine States

Scope: ~400 LOC | Depende de: PR4a

#### 4.B.1: Nuevos Estados

| Estado              | Trigger                                 | Comportamiento                                                         |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| circuitOpen         | Circuit breaker abierto                 | Cooldown configurable → auto-retry en half-open, UI: banner + fallback |
| rateLimited         | Rate limit alcanzado                    | UI: toast con countdown, bloquea acciones                              |
| fallbackConfirming  | Error eligible + providers alternativos | UI: modal con 30s timeout                                              |
| pendingManualReview | 5 retries de finalize fallaron          | UI: link a dashboard provider                                          |

#### 4.B.2: UI por Contexto

| Contexto                     | Estado                  | UI                                       |
| ---------------------------- | ----------------------- | ---------------------------------------- |
| Fallo abre circuit           | circuitOpen             | Banner degradado + "Usar otro proveedor" |
| Checkout con circuit abierto | Provider selector       | Provider deshabilitado + tooltip         |
| Cooldown termina             | circuitHalfOpen         | "Verificando disponibilidad..."          |
| Todos los providers down     | allProvidersUnavailable | Modal bloqueante "Intenta más tarde"     |

#### 4.B.3: Fallback Modal Data

interface FallbackConfirmationData
eligibleProviders: PaymentProviderId[]
failureReason: PaymentErrorCode
timeoutMs: 30_000

#### 4.B.4: Manual Review Data

interface ManualReviewData
intentId: string
providerId: PaymentProviderId
dashboardUrl: string // Desde ProviderFactory.getDashboardUrl()

#### 4.B.5: Idempotency + Double-Click Protection

| Mecanismo       | Ubicación         | Descripción                                                  |
| --------------- | ----------------- | ------------------------------------------------------------ |
| Idempotency key | Builders/Requests | {sessionId}:{orderId}:{providerId}:{timestamp} - OBLIGATORIO |
| Debounce        | UI button         | 300ms debounce                                               |
| State guard     | Machine           | Guard que rechaza si ya está en starting                     |

#### 4.B.6: Retry 3DS

- 1 retry automático después de timeout
- Luego: botón manual "Reintentar verificación"

#### 4.B.7: Provider Factory Extension

| Método nuevo (opcional)    | Descripción            |
| -------------------------- | ---------------------- |
| getResilienceConfig?()     | Config por provider    |
| getDashboardUrl?(intentId) | URL para manual review |

Tests PR4b

- Integration: flow machine con Vitest + Angular TestBed
- Scenarios: circuit open → fallback → confirm → execute
- Coverage: 100% paths críticos

---

## 5) PR5: Security Hardening

Scope: ~250 LOC | Depende de: PR4b

| Paso | Archivo                                             | Descripción                             |
| ---- | --------------------------------------------------- | --------------------------------------- |
| 5.1  | application/api/ports/webhook-verifier.port.ts      | Interface para backend                  |
| 5.2  | shared/logging/sanitize-for-logging.util.ts         | Token → [REDACTED]                      |
| 5.3  | shared/errors/redact-payment-error.util.ts          | Limpia raw con PII fields inyectables   |
| 5.4  | application/api/tokens/security/pii-fields.token.ts | Lista inyectable                        |
| 5.5  | PayPal redirect strategy                            | Usar sanitize antes de loguear          |
| 5.6  | Webhook normalizers                                 | Placeholder para signature verification |
| 5.7  | payment.providers.ts                                | Poblar WEBHOOK_NORMALIZER_REGISTRY      |

Example registry wiring (referencial)

```typescript
provide: WEBHOOK_NORMALIZER_REGISTRY
useFactory: (stripeNormalizer, paypalNormalizer) => (
stripe: stripeNormalizer,
paypal: paypalNormalizer
)
deps: [StripeWebhookNormalizer, PaypalWebhookNormalizer]
```

Tests PR5

- Unit: sanitize con diferentes inputs
- Coverage: 100% redaction paths

---

## 6) PR6: Full Observability

Scope: ~400 LOC | Depende de: PR5

### 6.A: Sink de Resilience

| Archivo                                    | Descripción   |
| ------------------------------------------ | ------------- |
| application/adapters/telemetry/resilience/ | Sink dedicado |

Eventos emitidos:

| Evento            | Metadata                                             |
| ----------------- | ---------------------------------------------------- |
| CIRCUIT_OPENED    | providerId, operationType, errorCode, previousState  |
| CIRCUIT_CLOSED    | providerId, operationType, durationMs                |
| CIRCUIT_HALF_OPEN | providerId                                           |
| RETRY_ATTEMPTED   | providerId, operationType, attemptNumber, durationMs |
| RETRY_EXHAUSTED   | providerId, operationType, attemptNumber, errorCode  |
| RATE_LIMIT_HIT    | providerId, operationType, retryAfterMs              |

### 6.B: Health Checks Mock

| Archivo                                               | Descripción       |
| ----------------------------------------------------- | ----------------- |
| infrastructure/health/provider-health.port.ts         | Interface         |
| infrastructure/health/mock-provider-health.adapter.ts | Mock para testing |

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
}
```

Trigger: Al seleccionar provider en checkout
UI: Spinner inline (5s timeout → error si no responde)

### 6.C: Fake Scenarios Nuevos

| Token          | Comportamiento                      |
| -------------- | ----------------------------------- |
| CIRCUIT_TRIP   | Fuerza apertura de circuit          |
| RATE_LIMIT_HIT | Fuerza rate limit                   |
| RETRY_EXHAUST  | Falla todos los retries             |
| HALF_OPEN_FAIL | Falla probe de half-open            |
| SLOW_RESPONSE  | Simula latencia alta (configurable) |

### 6.D: SPEI Config Migration

| Archivo                                             | Descripción    |
| --------------------------------------------------- | -------------- |
| infrastructure/stripe/config/spei-display.config.ts | Valores reales |

### 6.E: i18n Nuevos Namespaces

| Namespace             | Keys                              |
| --------------------- | --------------------------------- |
| PAYMENT.ERRORS.\_     | 16+ keys de error                 |
| PAYMENT.RESILIENCE.\_ | circuit open, rate limit messages |
| PAYMENT.HEALTH.\_     | disponible, lento, no disponible  |
| PAYMENT.FALLBACK.\_   | modal texts, botones              |

Rate limit toast: "Demasiadas solicitudes. Espera {X} segundos." (X desde config centralizada)

Tests PR6

- Unit: sink filtra correctamente
- Unit: mock health adapter
- Integration: eventos en flow completo

---

## 7) PR7: Operation Contracts (NUEVO)

Scope: ~350 LOC | Depende de: PR6

### 7.A: Nuevos Ports

| Archivo                                       | Descripción                 |
| --------------------------------------------- | --------------------------- |
| application/api/ports/refund-gateway.port.ts  | RefundGatewayPort separado  |
| application/api/ports/capture-gateway.port.ts | CaptureGatewayPort separado |
| application/api/ports/void-gateway.port.ts    | VoidGatewayPort separado    |

### 7.B: Request Types (Herencia de Interfaces)

| Archivo                                    | Contenido                                          |
| ------------------------------------------ | -------------------------------------------------- |
| domain/messages/payment-action.request.ts  | Base interface                                     |
| domain/messages/refund-payment.request.ts  | RefundPaymentRequest extends PaymentActionRequest  |
| domain/messages/capture-payment.request.ts | CapturePaymentRequest extends PaymentActionRequest |
| domain/messages/void-payment.request.ts    | VoidPaymentRequest extends PaymentActionRequest    |

```typescript
export interface PaymentActionRequest {
  intentId: string;
  providerId: PaymentProviderId;
  idempotencyKey: string; // OBLIGATORIO
}

export interface RefundPaymentRequest extends PaymentActionRequest {
  action: 'refund_full' | 'refund_partial';
  amount?: Money; // Requerido si partial
  reason?: RefundReason;
}

export interface CapturePaymentRequest extends PaymentActionRequest {
  action: 'capture';
  amount?: Money; // Para captura parcial
}

export interface VoidPaymentRequest extends PaymentActionRequest {
  action: 'void' | 'release_authorization';
}
```

### 7.C: Result Types

| Archivo                                 | Contenido     |
| --------------------------------------- | ------------- |
| domain/entities/refund-result.model.ts  | RefundResult  |
| domain/entities/capture-result.model.ts | CaptureResult |

### 7.D: Tokens

| Archivo                                            | Contenido                    |
| -------------------------------------------------- | ---------------------------- |
| application/api/tokens/operations/refund.token.ts  | REFUND_GATEWAYS multi-token  |
| application/api/tokens/operations/capture.token.ts | CAPTURE_GATEWAYS multi-token |
| application/api/tokens/operations/void.token.ts    | VOID_GATEWAYS multi-token    |

### 7.E: Idempotency en Todos los Requests

| Archivo                                   | Cambio                                     |
| ----------------------------------------- | ------------------------------------------ |
| domain/messages/create-payment.request.ts | Agregar idempotencyKey: string obligatorio |
| Todos los builders                        | Método withIdempotencyKey() requerido      |

Tests PR7

- Unit: types compilan correctamente
- Unit: request validation
- Nota: sin implementación de gateways, solo contratos

---

## 8) PR8: Documentation

Scope: ~200 LOC | Depende de: PR7

| Archivo                        | Contenido                         |
| ------------------------------ | --------------------------------- |
| docs/application-analysis.md   | Sección "Resilience Architecture" |
| charts/resilience-flow.mermaid | Diagrama de estados               |
| README.md                      | Overview resilience + fallback    |

---

## 9) Estados en Mermaid

stateDiagram-v2
[*] --> idle
idle --> starting: START
starting --> circuitOpen: CIRCUIT_OPENED
starting --> rateLimited: RATE_LIMIT_HIT
starting --> afterStart: SUCCESS
starting --> failed: ERROR

circuitOpen --> halfOpen: COOLDOWN_EXPIRED
halfOpen --> starting: RETRY_PROBE
halfOpen --> circuitOpen: PROBE_FAILED

rateLimited --> idle: RATE_LIMIT_RESET

failed --> fallbackConfirming: FALLBACK_ELIGIBLE
fallbackConfirming --> starting: FALLBACK_CONFIRMED
fallbackConfirming --> failed: FALLBACK_CANCELLED
fallbackConfirming --> failed: FALLBACK_TIMEOUT

afterStart --> pendingManualReview: FINALIZE_EXHAUSTED

---

## 10) Resumen de Decisiones

| Área                           | Decisión                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Factories                      | Mantener unificadas, extraer helpers a subcarpeta                                   |
| Validaciones provider-specific | Type guards en infrastructure/{provider}/shared/guards/                             |
| Validaciones cross-provider    | Función genérica validateAmount(money, config) en infrastructure/shared/validation/ |
| Constants                      | Por provider en shared/constants/, con prefijo (ej. PAYPAL_STATUS_MAP)              |
| Magic strings                  | Const objects con as const                                                          |
| DTOs metadata                  | Tipados en infrastructure/{provider}/core/dto/                                      |
| FakeIntentStore                | Eliminar, cada fake gateway tiene Map interno                                       |
| Webhook registry               | Poblar en composition root (PR5)                                                    |
| Nuevos ports                   | Separados: RefundGatewayPort, CaptureGatewayPort, VoidGatewayPort                   |
| Request types                  | Herencia: RefundPaymentRequest extends PaymentActionRequest                         |
| Action kinds                   | refund_full, refund_partial, capture, void, release_authorization                   |
| Idempotency                    | Obligatorio en CreatePaymentRequest y todos los action requests                     |
| Config validation              | ProviderValidationConfig completa (currencies, amounts, methods, urls)              |
| i18n en infrastructure         | Error codes, mapping en presentation via pipe                                       |
| Contratos                      | Mover a application/api, sin deprecation                                            |
| Resilience integration         | Ports desacoplados del state machine                                                |
| Circuit breaker trigger        | Estado dedicado en máquina con cooldown configurable                                |
| Circuit breaker key            | Por providerId                                                                      |
| Cooldown                       | Configurable vía DI (default 60s)                                                   |
| Fallback                       | Con confirmación modal, 30s timeout                                                 |
| Fallback errors eligibles      | provider_unavailable, timeout, network_error                                        |
| Retries                        | En half-open después de cooldown                                                    |
| Error codes                    | Domain-only genéricos                                                               |
| Webhooks                       | Solo estructura (port + interface)                                                  |
| Health checks                  | Mock para testing, trigger al seleccionar provider                                  |
| Telemetry resilience           | Sink dedicado implementando FlowTelemetrySink                                       |
| Naming                         | Técnicos (CircuitBreaker, RateLimiter)                                              |
| Gateway resilience             | Decorador en impl, port intacto                                                     |
| Modal owner                    | State machine emite, UI renderiza                                                   |
| PII fields                     | Lista inyectable vía token                                                          |
| Token redaction                | [REDACTED] completo                                                                 |
| Tests                          | Unit + Integration con cada PR, 100% paths críticos                                 |
| Docs                           | Extender docs existentes + nuevo chart                                              |
| Migration                      | PRs incrementales por área (<500 LOC)                                               |
| Rollback                       | Env var PAYMENTS_RESILIENCE_ENABLED=false                                           |
| Monitoring                     | Logs + telemetry local en staging                                                   |
| Prod toggle                    | On by default                                                                       |
| Test framework                 | Vitest + Angular TestBed                                                            |
| PR size                        | <500 LOC                                                                            |

---

## 11) UI Específica por Estado

### Circuit Open (fallo activo)

- Banner degradado + botón "Usar otro proveedor"

### Checkout con Circuit Abierto

- Provider deshabilitado en selector + tooltip explicativo

### Half-Open (verificando)

- Mensaje "Verificando disponibilidad..."

### Todos los Providers Down

- Modal bloqueante "Intenta más tarde"

### Rate Limited

- Toast con countdown: "Demasiadas solicitudes. Espera {X} segundos."

### Health Check en Selector

- Spinner inline, 5s timeout

### Fallback Confirmation

- Modal con opciones: "Reintentar", "Usar otro proveedor", "Cancelar"
- 30s timeout auto-cancel

### Pending Manual Review

- Link a dashboard de provider

---

## 12) Verificación Final

| Check           | Comando                                      |
| --------------- | -------------------------------------------- |
| Lint            | bun run lint:fix                             |
| Build           | bun run build                                |
| Tests           | bun run test:ci                              |
| Dependencies    | bun run dep:check                            |
| i18n grep       | grep -r "@core/i18n" infrastructure/ → vacío |
| FakeIntentStore | No debe existir después de PR0               |
| Coverage        | 100% paths críticos                          |

---

## 13) Notas de Implementación

1. Cada PR debe ser autónomo y deployable
2. Tests van con el código en cada PR
3. Feature flag permite rollback en cualquier momento
4. PAYMENTS_RESILIENCE_ENABLED=false
5. Los contratos de PR7 son solo interfaces, sin implementación
6. Webhooks quedan preparados, implementación real es backend
