# Progreso del Módulo Payments

## Objetivo del Proyecto

Construir un módulo de pagos **enterprise-grade** y extensible (Stripe/PayPal/futuro MercadoPago, Conekta) con arquitectura hexagonal. El enfoque es diseño escalable, testeable y mantenible en Angular.

**Arquitectura:** Hexagonal (Ports & Adapters) + Clean Architecture + DDD

**Principios clave:**
- Domain con contratos (ports) y modelos; cero dependencias de Angular
- Application con use cases, orquestación y estado reactivo
- Infrastructure pluginable por proveedor
- UI consume abstracciones, sin conocer implementaciones
- Resiliencia integrada (Circuit Breaker, Rate Limiting, Retry, Fallback)

---

## Estado Actual

### Arquitectura y Wiring

| Componente | Estado | Descripción |
|------------|--------|-------------|
| Multi DI de providers | ✅ | Token con `multi: true` para factories |
| Registry con validaciones | ✅ | Detecta duplicados y providers faltantes |
| Factories por proveedor | ✅ | Stripe, PayPal implementados |
| Gateways con Template Method | ✅ | Validación, logging, normalización de errores |
| NgRx Signals Store | ✅ | Estado reactivo con computed properties |
| FallbackOrchestrator | ✅ | Modo manual y automático |
| Path aliases configurados | ✅ | `@core/*`, `@payments/*`, etc. |

### Domain Layer

#### Models (`domain/models/`)

| Modelo | Archivo | Descripción |
|--------|---------|-------------|
| PaymentIntent | `payment/payment-intent.types.ts` | Intent normalizado de cualquier provider |
| PaymentError | `payment/payment-error.types.ts` | Errores normalizados |
| PaymentMethod | `payment/payment-method.types.ts` | card, spei, etc. |
| CreatePaymentRequest | `payment/payment-request.types.ts` | Request genérico |
| NextAction | `payment/payment-action.types.ts` | 3DS, redirect, SPEI clabe |
| FallbackConfig | `fallback/fallback-config.types.ts` | Configuración de fallback |
| FallbackState | `fallback/fallback-state.types.ts` | Estado del orquestador |
| FallbackEvent | `fallback/fallback-event.types.ts` | Eventos de fallback |

#### Ports (`domain/ports/`)

| Port | Descripción | Implementaciones |
|------|-------------|------------------|
| `PaymentGateway` | Comunicación con API del provider | Stripe, PayPal, Fake |
| `PaymentStrategy` | Lógica por método de pago | Card, SPEI, PaypalRedirect |
| `ProviderFactory` | Abstract Factory de providers | StripeFactory, PaypalFactory |
| `PaymentRequestBuilder` | Builder de requests | StripeCard, StripeSPEI, PaypalRedirect |
| `TokenValidator` | Validación de tokens | StripeToken, PaypalToken |

### Application Layer

#### Use Cases

| Use Case | Estado | Tests |
|----------|--------|-------|
| `StartPaymentUseCase` | ✅ | ✅ 11 tests |
| `ConfirmPaymentUseCase` | ✅ | ✅ 3 tests |
| `CancelPaymentUseCase` | ✅ | ✅ 3 tests |
| `GetPaymentStatusUseCase` | ✅ | ✅ 3 tests |

#### Services

| Service | Estado | Tests | Descripción |
|---------|--------|-------|-------------|
| `ProviderFactoryRegistry` | ✅ | ✅ 5 tests | Registry de factories |
| `FallbackOrchestratorService` | ✅ | ✅ 8 tests | Orquestación de fallback |
| `PaymentsStore` | ✅ | ⚠️ Pendiente | NgRx Signals store |
| `NgRxSignalsStateAdapter` | ✅ | ✅ Tests | Adapter de estado |

### Infrastructure Layer

#### Stripe

| Componente | Estado | Tests |
|------------|--------|-------|
| `StripePaymentGateway` | ✅ | ✅ 4 tests |
| `StripeProviderFactory` | ✅ | ✅ 4 tests |
| `StripeCardRequestBuilder` | ✅ | ✅ 6 tests |
| `StripeSpeiRequestBuilder` | ✅ | ✅ 4 tests |
| `StripeTokenValidator` | ✅ | ✅ 3 tests |

#### PayPal

| Componente | Estado | Tests |
|------------|--------|-------|
| `PaypalPaymentGateway` | ✅ | ✅ 4 tests |
| `PaypalProviderFactory` | ✅ | ✅ 3 tests |
| `PaypalRedirectRequestBuilder` | ✅ | ✅ 5 tests |
| `PaypalRedirectStrategy` | ✅ | ✅ 1 test |
| `PaypalTokenValidator` | ✅ | ✅ 2 tests |

#### Shared Strategies

| Strategy | Validación | Preparación | Tests |
|----------|-----------|-------------|-------|
| `CardStrategy` | ✅ Token, monto mínimo | ✅ Metadata 3DS | ✅ 16 tests |
| `SpeiStrategy` | ✅ MXN, min/max | ✅ Expiración 72h | ✅ 16 tests |

### Core Layer (Resiliencia)

#### Services

| Service | Estado | Tests | Descripción |
|---------|--------|-------|-------------|
| `CircuitBreakerService` | ✅ | ❌ Pendiente | Patrón Circuit Breaker |
| `RateLimiterService` | ✅ | ❌ Pendiente | Rate limiting por endpoint |
| `CacheService` | ✅ | ✅ Tests | Cache con TTL |
| `RetryService` | ✅ | ✅ Tests | Retry con backoff |
| `LoggerService` | ✅ | ❌ Pendiente | Logging estructurado |

#### Interceptors

| Interceptor | Estado | Tests | Descripción |
|-------------|--------|-------|-------------|
| `ResilienceInterceptor` | ✅ | ❌ Pendiente | Circuit Breaker + Rate Limit |
| `RetryInterceptor` | ✅ | ✅ Tests | Retry automático |
| `CacheInterceptor` | ✅ | ✅ Tests | Cache de responses |
| `LoggingInterceptor` | ✅ | ❌ Pendiente | Log de requests |
| `FakeBackendInterceptor` | ✅ | ❌ Pendiente | Mock para desarrollo |

#### Operators

| Operator | Estado | Tests |
|----------|--------|-------|
| `retryWithBackoff` | ✅ | ✅ Tests |

---

## Cobertura de Tests

```
Test Files  16+ passed
     Tests  105+ passed
```

### Archivos Sin Tests (Pendientes)

**Core Services:**
- `circuit-breaker.service.ts`
- `rate-limiter.service.ts`
- `logger.service.ts`

**Core Interceptors:**
- `resilience.interceptor.ts`
- `logging.interceptor.ts`
- `fake-backend.interceptor.ts`

**Application:**
- `payment.store.ts` (tests de integración)

---

## Checklist de Completado

### Fase 1: Arquitectura Base ✅
- [x] Estructura hexagonal con capas definidas
- [x] Multi DI y Registry
- [x] Ports definidos (Gateway, Strategy, Factory, Builder)
- [x] Modelos de dominio separados y tipados
- [x] Path aliases configurados

### Fase 2: Implementación de Gateways ✅
- [x] Gateway base con Template Method pattern
- [x] StripePaymentGateway con transformación a centavos
- [x] PaypalPaymentGateway con Orders API v2
- [x] Humanización de errores en español
- [x] Logging estructurado con correlationId

### Fase 3: Implementación de Strategies ✅
- [x] CardStrategy con validación de tokens y 3DS
- [x] SpeiStrategy con validación MXN y expiración
- [x] PaypalRedirectStrategy para flujo OAuth
- [x] TokenValidator por provider

### Fase 4: Factories y Registry ✅
- [x] StripeProviderFactory (card, spei)
- [x] PaypalProviderFactory (card vía redirect)
- [x] ProviderFactoryRegistry con validaciones
- [x] Builders específicos por provider/method

### Fase 5: Use Cases ✅
- [x] StartPaymentUseCase
- [x] ConfirmPaymentUseCase
- [x] CancelPaymentUseCase
- [x] GetPaymentStatusUseCase

### Fase 6: Estado y Fallback ✅
- [x] PaymentsStore con NgRx Signals
- [x] FallbackOrchestratorService
- [x] Modo manual y automático de fallback
- [x] Computed properties optimizadas
- [x] Historial de transacciones

### Fase 7: Resiliencia ✅
- [x] CircuitBreakerService
- [x] RateLimiterService
- [x] ResilienceInterceptor
- [x] RetryInterceptor con backoff exponencial
- [x] Logging con correlationId

---

## Decisiones de Diseño

### Flujo de un Pago

```
UI → UseCase → Registry → Factory → Strategy → Gateway → API
                                       ↓
                            FallbackOrchestrator (si falla)
                                       ↓
                            Retry con otro provider
```

### Template Method en Gateway

El `PaymentGateway` base define el flujo:
1. `createIntent()` → validación → logging → `createIntentRaw()` → mapeo → normalización de errores

Cada gateway concreto implementa solo:
- `createIntentRaw()` - Llamada HTTP específica
- `mapIntent()` - Transformación de DTO a PaymentIntent

### Fallback Inteligente

```typescript
// Configuración
{
    mode: 'auto',           // 'manual' requiere confirmación del usuario
    autoFallbackDelay: 2000,
    maxAutoFallbacks: 1,
    providerPriority: ['stripe', 'paypal'],
    triggerErrorCodes: ['provider_unavailable', 'timeout']
}
```

### Separación Builder/Strategy

- **Builder**: Construye el request con validación de campos requeridos
- **Strategy**: Valida reglas de negocio y enriquece con metadata

---

## Pendientes

### Corto Plazo
- [ ] Tests para servicios de core sin coverage
- [ ] Tests de integración para PaymentsStore
- [ ] Reorganizar `core/` por funcionalidad (resilience/, logging/, caching/)

### Mediano Plazo
- [ ] UI reacciona a `nextAction` sin lógica por provider
- [ ] Componente de fallback modal
- [ ] SquareProviderFactory para validar extensibilidad
- [ ] Documentación de flujos con diagramas

### Largo Plazo
- [ ] `HandleRedirectReturnUseCase`
- [ ] `HandleWebhookUseCase`
- [ ] Event Sourcing para auditoría
- [ ] Idempotencia de transacciones

---

## Métricas de Calidad

| Métrica | Valor | Objetivo |
|---------|-------|----------|
| Test coverage (domain) | ~90% | 95% |
| Test coverage (application) | ~80% | 90% |
| Test coverage (infrastructure) | ~85% | 90% |
| Test coverage (core) | ~50% | 80% |
| Cyclomatic complexity | Bajo | < 10 por método |

---

## Próximos Pasos Sugeridos

1. **Completar tests de core** - Circuit Breaker, Rate Limiter, Logger
2. **Reorganizar core/** - Agrupar por funcionalidad (resilience, observability)
3. **UI de fallback** - Modal/toast para confirmar cambio de provider
4. **Tercer provider** - MercadoPago o Conekta para validar extensibilidad
