# Payment service - issues backlog

Backlog para estabilización del módulo **Payments (Angular 21 + Vitest)**.
Enfocado en: arquitectura mantenible, OCP real, tests estables, error handling consistente (sync/async), y guardrails (depcruise).

---

## Prioridad Alta (Críticos)

### 1) Inconsistencia en `providedIn: 'root'` en Use Cases

- **Archivo:** [`start-payment.use-case.ts`](src/app/features/payments/application/use-cases/start-payment.use-case.ts)
- **Problema:**
  - `StartPaymentUseCase` está decorado con `@Injectable({ providedIn: 'root' })`, pero los demás use cases están con `@Injectable()` sin `providedIn`.
  - A la vez, los use cases se registran explícitamente en `USE_CASE_PROVIDERS` dentro de [`payment.providers.ts`](src/app/features/payments/config/payment.providers.ts).
  - Esto crea **un ciclo de vida inconsistente** y puede llevar a:
    - instancias duplicadas en contextos distintos,
    - inyección inesperada en tests,
    - comportamiento diferente entre “app real” vs “TestBed”.
- **Impacto:**
  - Difícil reproducibilidad: el mismo caso de uso puede comportarse diferente dependiendo de dónde se resuelva (root vs módulo).
  - Puede complicar debugging y aumentar el “mystery behavior” cuando un test setea providers y el root lo ignora.
- **Archivos afectados:**
  - [`start-payment.use-case.ts`](src/app/features/payments/application/use-cases/start-payment.use-case.ts)
  - [`payment.providers.ts`](src/app/features/payments/config/payment.providers.ts)
  - Otros use cases:
    - [`confirm-payment.use-case.ts`](src/app/features/payments/application/use-cases/confirm-payment.use-case.ts)
    - [`cancel-payment.use-case.ts`](src/app/features/payments/application/use-cases/cancel-payment.use-case.ts)
    - [`get-payment-status.use-case.ts`](src/app/features/payments/application/use-cases/get-payment-status.use-case.ts)
- **Solución (mínimo cambio, alto impacto):**
  - Quitar `providedIn: 'root'` de `StartPaymentUseCase`.
  - Mantener **inyección controlada** por `providePayments()` / `providePaymentsWithConfig()`.
- **Done when:**
  - Todos los use cases son consistentes (o todos root, o ninguno root).
  - Tests no cambian su resultado al alternar proveeduría (root vs providers explícitos).

---

### 2) Inyección de clases concretas como tokens (acoplamiento de infraestructura)

- **Archivo principal:** [`payment.providers.ts`](src/app/features/payments/config/payment.providers.ts)
- **Problema:**
  - Se usan clases concretas como tokens de DI para representar “el gateway”:
    - `IntentFacade`
    - `PaypalPaymentGateway`
  - Ejemplo actual (modo fake):
    ```ts
    { provide: IntentFacade, useFactory: () => FakePaymentGateway.create('stripe') }
    { provide: PaypalPaymentGateway, useFactory: () => FakePaymentGateway.create('paypal') }
    ```
  - Esto es **acoplamiento fuerte** a infraestructura: la app/UI queda atada a clases concretas en vez de depender de un contrato estable.
- **Impacto:**
  - Cambiar implementación requiere modificar config + imports concretos.
  - Tests integrales se vuelven frágiles (DI cascade).
  - Dificulta OCP real para providers nuevos (cada provider mete nuevas clases a config).
- **Archivos afectados:**
  - [`payment.providers.ts`](src/app/features/payments/config/payment.providers.ts)
  - Stripe facade:
    - [`intent.facade.ts`](src/app/features/payments/infrastructure/stripe/gateways/intent/intent.facade.ts)
  - PayPal gateway:
    - [`paypal-payment.gateway.ts`](src/app/features/payments/infrastructure/paypal/gateways/paypal-payment.gateway.ts)
  - Fake gateway:
    - [`fake-payment.gateway.ts`](src/app/features/payments/infrastructure/fake/gateways/fake-payment.gateway.ts)
- **Solución (mínimo cambio, incremental):**
  - Introducir un token estable tipo `PAYMENT_GATEWAY` por provider o por “Intent operations”.
  - Opción simple y efectiva:
    - Crear tokens:
      - `STRIPE_INTENT_GATEWAY`
      - `PAYPAL_INTENT_GATEWAY`
    - Config decide qué clase concreta inyecta.
  - En UI/Application solo se inyecta token (no clase concreta).
- **Done when:**
  - El módulo puede alternar fake/real sin importar clases concretas en UI/Application.
  - Agregar un provider no requiere “ensuciar” config con imports concretos en capas no infra.

---

### 3) `PaymentsStore` es un God Object

- **Archivo:** [`payment.store.ts`](src/app/features/payments/application/store/payment.store.ts)
- **Problema:**
  - Centraliza demasiadas responsabilidades:
    - estado UI (status, intent, error, history)
    - orquestación de casos de uso (start/confirm/cancel/getStatus)
    - lógica de fallback (subscribe + executeFallback + cancelFallback)
    - “política” de cuándo surfacer errores
    - historia y debug summary
  - Aunque está “más limpio”, sigue siendo un “centro de gravedad” del módulo.
- **Impacto:**
  - Cambios pequeños rompen muchas cosas.
  - Tests de store se vuelven pesados (mock de 4 use cases + orchestrator + edgecases).
  - A largo plazo, cada feature nueva cae aquí y se vuelve bola de nieve.
- **Archivos afectados:**
  - [`payment.store.ts`](src/app/features/payments/application/store/payment.store.ts)
  - Use cases (consumidos dentro del store)
  - UI components que dependen del store
- **Solución (incremental y testeable):**
  - Extraer 1 responsabilidad a la vez:
    1. `PaymentHistoryService` (append/limit/history derived)
    2. `FallbackUiCoordinator` (execute/cancel/subscribe to fallbackExecute$)
    3. Mantener store como “state + delegación”
  - Evitar refactor grande: extraer helpers internos primero.
- **Done when:**
  - `PaymentsStore` ya no contiene suscripciones directas complejas ni lógica de fallback extensa.
  - El store queda principalmente como: “set loading → llamar use case → aplicar resultado”.

---

## Prioridad media (Importantes)

### 4) Validaciones duplicadas (violación DRY + reglas inconsistentes)

- **Archivo(s):**
  - [`card-strategy.ts`](src/app/features/payments/shared/strategies/card-strategy.ts) -> `validate()`
  - [`stripe-card-request.builder.ts`](src/app/features/payments/infrastructure/stripe/builders/stripe-card-request.builder.ts) -> `validate()`
  - [`base-payment.gateway.ts`](src/app/features/payments/shared/base-payment.gateway.ts) -> `validateCreate()`
- **Problema:**
  - La misma lógica de validación existe en 3 puntos distintos:
    - token requerido
    - mínimos de amount
    - required fields
  - Cada una puede divergir con el tiempo (bugs difíciles de rastrear).
- **Impacto:**
  - Inconsistencia real de reglas:
    - Strategy puede permitir algo que gateway rechaza.
    - Builder puede fallar antes que strategy.
  - Los tests se vuelven confusos: “¿dónde debería fallar?”
- **Solución (mínimo cambio):**
  - Elegir una única fuente de verdad por tipo de validación:
    - **Domain/Application validation**: validaciones de negocio (minAmount, reglas de method)
    - **Infra validation**: validaciones técnicas del request final (por provider)
  - Recomendación incremental:
    1. Dejar `CardStrategy.validate()` como “reglas de negocio”
    2. Builder valida solo “campos requeridos para construir request”
    3. Base gateway NO debe duplicar reglas de strategy (solo sanity checks)
- **Done when:**
  - No hay 3 validadores peleándose por lo mismo.
  - Un error de “token missing” ocurre en un solo lugar consistente.

---

### 5) Long Parameter List en `StartPaymentUseCase`

- **Archivo:** [`start-payment.use-case.ts`](src/app/features/payments/application/use-cases/start-payment.use-case.ts)
- **Problema:**
  - `execute(request, providerId, context?, wasAutoFallback?)` ya va creciendo.
  - En un sistema real esto crece (retry policy, trace/correlation, flags).
- **Impacto:**
  - Cada cambio rompe muchas llamadas.
  - Es fácil pasar parámetros mal o en orden incorrecto.
- **Solución (incremental):**
  - Introducir un “command object”:
    ```ts
    type StartPaymentCommand = {
      request: CreatePaymentRequest;
      providerId: PaymentProviderId;
      context?: PaymentFlowContext;
      wasAutoFallback?: boolean;
    };
    ```
  - `execute(cmd: StartPaymentCommand)`
- **Done when:**
  - `execute()` recibe solo 1 parámetro (objeto).
  - El store y tests quedan más legibles.

---

### 6) Type casting peligroso en `FakePaymentGateway`

- **Archivo:** [`fake-payment.gateway.ts`](src/app/features/payments/infrastructure/fake/gateways/fake-payment.gateway.ts)
- **Problema:**
  - Se usa hack:
    ```ts
    (instance as any).providerId = providerId;
    ```
  - Rompe type-safety y puede introducir errores silenciosos.
- **Impacto:**
  - Un refactor futuro puede romper esto sin que TS lo detecte.
  - Puede terminar con providerId incorrecto en runtime.
- **Solución (mínimo cambio):**
  - Convertir `providerId` en parámetro del constructor o en fábrica con DI:
    - `constructor(providerId: PaymentProviderId) { ... }`
  - O crear dos clases explícitas:
    - `FakeStripeGateway`, `FakePaypalGateway`
- **Done when:**
  - No existe `(as any)` para mutar providerId.

---

### 7) `FakePaymentGateway` excesivamente largo (dificulta mantenimiento)

- **Archivo:** [`fake-payment.gateway.ts`](src/app/features/payments/infrastructure/fake/gateways/fake-payment.gateway.ts) (~697 líneas)
- **Problema:**
  - Contiene demasiada lógica:
    - múltiples flows (3DS/SPEI/PayPal)
    - generación de IDs
    - escenarios especiales
    - DTO formatting
- **Impacto:**
  - Cambiar un flow puede romper otro.
  - Difícil de probar y entender.
- **Solución (incremental):**
  - Extraer helpers sin tocar API:
    - `FakeIntentFactory` (createFakeStripeIntent, createFakeSpeiSource, createFakePaypalOrder)
    - `FakeErrorFactory` (errores predefinidos)
    - `TokenBehaviorResolver`
- **Done when:**
  - La clase FakeGateway queda como orquestador (menos de ~300 líneas).
  - Los helpers tienen tests unitarios simples.

---

### 8) Falta Error Boundary a nivel UI (errores de render no controlados)

- **Archivo(s):**
  - UI pages/components (ej: checkout/status/return)
- **Problema:**
  - Angular no tiene ErrorBoundary como React.
  - Si un template/computed rompe, la UI puede quedar en estado inválido sin fallback visual.
- **Impacto:**
  - UX mala (pantallas rotas).
  - Debugging difícil (error global).
- **Solución (mínimo cambio, profesional):**
  - Implementar un `GlobalErrorHandler`:
    - `providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }]`
  - Y un componente tipo “FatalErrorPage” para rutas/estado.
  - Usar `Router` para navegar a un safe route cuando sea fatal.
- **Done when:**
  - Un error de render muestra UI controlada (no pantalla rota).
  - Los logs se capturan de forma consistente.

---

### 9) Código legacy sin eliminar (rutas de debug)

- **Archivo real:** [`payments.routes.ts`](src/app/features/payments/payments.routes.ts)
- **Problema:**
  - Existe ruta “legacy debug”:
    ```ts
    // Ruta legacy - mantener por compatibilidad
    { path: 'debug', loadComponent: () => import('./ui/pages/payments/payments.page') ... }
    ```
- **Impacto:**
  - Superficie de navegación innecesaria.
  - Aumenta mantenimiento y confusión.
- **Solución:**
  - Remover o poner guard por environment/dev-only.
  - Alternativa: dejarlo pero bajo `/payments/_debug` y con feature flag.
- **Done when:**
  - No hay rutas legacy en producción sin razón.

---

## Prioridad Baja (Mejoras)

### 10) Magic strings dispersos

- **Archivo(s):**
  - Múltiples (providers y métodos: `'stripe'`, `'paypal'`, `'card'`, `'spei'`)
- **Problema:**
  - Strings literales por todos lados.
- **Impacto:**
  - Typos difíciles de detectar.
  - Refactors más caros.
- **Solución:**
  - Centralizar en tipos/consts:
    - `PaymentProviderId` y `PaymentMethodType` ya existen → usar estrictamente.
  - Agregar `as const` donde aplique.
- **Done when:**
  - No hay strings “core” repetidos en infraestructura/UI sin necesidad.

---

### 11) Falta lazy loading por provider individual

- **Archivo(s):**
  - [`payment.providers.ts`](src/app/features/payments/config/payment.providers.ts)
- **Problema:**
  - Todos los providers y factories se cargan al entrar a `/payments`.
- **Impacto:**
  - Bundle size mayor.
  - Más costo inicial para usuarios que solo usan 1 provider.
- **Solución (incremental):**
  - Registrar factories vía dynamic import:
    - `useFactory: async () => (await import('...')).StripeProviderFactory`
  - Alternativa: feature flags por provider.
- **Done when:**
  - Provider no usado no se carga en bundle inicial del módulo.

---

### 12) `LoggerService` solo escribe a console

- **Archivo:** [`logger.service.ts`](src/app/core/logging/logger.service.ts)
- **Problema:**
  - Logging estructurado muy bien diseñado, pero sin salida real (Sentry/DataDog/etc.).
- **Impacto:**
  - En producción no hay trazabilidad real.
- **Solución:**
  - Agregar “transport layer”:
    - ConsoleTransport (dev)
    - RemoteTransport (prod)
- **Done when:**
  - Logger soporta salida configurable sin modificar código interno.

---

### 13) `CacheService` sin límite estricto de memoria por bytes

- **Archivo:** [`cache.service.ts`](src/app/core/caching/cache.service.ts)
- **Problema:**
  - Evicción por `maxEntries`, no por bytes/mem real.
  - Existe `estimateSizeInBytes` pero no gobierna el límite total.
- **Impacto:**
  - Posible crecimiento excesivo en payloads grandes.
- **Solución:**
  - Introducir `maxBytes` y tracking de tamaño total.
  - Evict LRU hasta liberar bytes suficientes.
- **Done when:**
  - Cache tiene control real por memoria, no solo por entries.

---

### 14) `FallbackOrchestratorService` muy complejo (estado y flujo pesado)

- **Archivo:** [`fallback-orchestrator.service.ts`](src/app/features/payments/application/services/fallback-orchestrator.service.ts) (~483 líneas)
- **Problema:**
  - Mucha lógica de estado + timers + decisiones.
- **Impacto:**
  - Difícil testear edgecases.
  - Riesgo alto de bugs al modificar.
- **Solución (incremental):**
  - Extraer “pure functions” para transición de estado:
    - reducer-like functions
  - Extraer scheduler/timers a helper.
- **Done when:**
  - Core de decisiones es puro y testeable sin RxJS.

---

### 15) Sin manejo de autenticación/sesión

- **Archivo(s):**
  - Gateways HTTP (Stripe/PayPal)
- **Problema:**
  - Requests no manejan sesión expirada ni auth headers.
- **Impacto:**
  - No se parece al mundo real (prod).
- **Solución:**
  - Interceptor de auth + refresh flow (simulado).
- **Done when:**
  - El módulo puede simular 401/403 y recuperación.

---

### 16) Comentarios JSDoc excesivos en código interno

- **Archivo(s):**
  - Varios (core + payments)
- **Problema:**
  - Mucho comentario “obvio” que se desincroniza.
- **Impacto:**
  - Ruido visual y mantenimiento extra.
- **Solución:**
  - Mantener docs en `docs/decisions/*` y reducir JSDoc a lo no-obvio.
- **Done when:**
  - Comentarios internos aportan valor real, no repiten el código.

---

### 17) Sin E2E tests reales

- **Archivo(s):**
  - Actualmente hay integration specs tipo unit/integration, pero no E2E browser.
- **Problema:**
  - No se valida flujo real de UI/Router/DOM completo.
- **Impacto:**
  - Bugs de navegación/render pueden escapar.
- **Solución:**
  - Agregar Playwright:
    - flujo checkout → fallback modal → status → retry provider
- **Done when:**
  - Al menos 1 happy-path + 1 error-path E2E.

---

### 18) Vendor lock-in con NgRx Signals

- **Archivo(s):**
  - [`payment.store.ts`](src/app/features/payments/application/store/payment.store.ts)
  - Token adapter: [`payment-state.token.ts`](src/app/features/payments/application/tokens/payment-state.token.ts)
  - Adapter: [`ngrx-signals-state.adapter.ts`](src/app/features/payments/application/adapters/ngrx-signals-state.adapter.ts)
- **Problema:**
  - `signalStore` + `rxMethod` acopla fuerte a NgRx Signals.
  - Aunque tienes token `PAYMENT_STATE`, el store usa NgRx directamente.
- **Impacto:**
  - Migrar a otra lib es caro.
- **Solución (incremental):**
  - Mantener store como UI-specific, pero exponer un port:
    - `PaymentStatePort` ya existe → usarlo como frontera real.
  - Reducir dependencias directas del resto del sistema al store concreto.
- **Done when:**
  - UI consume principalmente `PaymentStatePort`.
  - Store interno puede cambiar sin tocar UI extensa.
