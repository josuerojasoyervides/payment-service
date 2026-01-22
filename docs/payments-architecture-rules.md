# Payments Module — Architecture & Quality Rules

Este repositorio nació como un laboratorio para aprender **buenas prácticas y arquitectura compleja**, pero puede evolucionar gradualmente hacia un **módulo funcional real**.

Este documento define reglas de calidad, diseño y mantenimiento para que el proyecto:

- no se vuelva una telaraña por deuda técnica,
- sea escalable de manera incremental,
- permita agregar providers y métodos sin “romper todo”,
- mantenga tests estables y flujos sin UI colgada.

> Filosofía: **Clean-ish pragmática**. Primero estabilizar, corregir y hacer mantenible. Luego avanzar.

---

## 1) Principios del proyecto (lo que NO se negocia)

### 1.1 Propósito

- Aprender arquitectura realista aplicada a pagos.
- Practicar escalabilidad, separación de responsabilidades y pruebas.
- Evolucionar hacia un módulo usable **sin sacrificar calidad**.

### 1.2 Prohibiciones absolutas (aunque “funcione”)

Estas cosas están prohibidas:

- **Librerías en Domain** (domain = TypeScript puro)
- **`any`** (si aparece, se considera deuda técnica real)
- **hacks para avanzar** (bomba de tiempo)
- **features nuevas antes de estabilizar lo actual**
- **código sin propósito** (mejor ir lento que inflar el sistema)
- **malas prácticas** (switch/if cascadas para provider, DI frágil, etc.)
- **deuda técnica intencional** (si hay deuda, debe estar documentada como temporal y con plan)

---

## 2) Reglas de capas (layering real)

### 2.1 Dependencias permitidas entre capas

Regla principal de dependencias:

- **Domain → (nada)**
- **Application → Domain**
- **Infrastructure → Application + Domain**
- **UI → Application**

Si una dependencia rompe esto, se considera bug de arquitectura.

### 2.2 Qué está prohibido en `domain/`

Domain debe ser TypeScript puro. Está prohibido:

- Angular ❌
- RxJS ❌
- HttpClient ❌
- i18n ❌
- Logger ❌
- cualquier servicio con side effects ❌

### 2.3 Ports: dónde viven y por qué

Regla:

- **Domain ports**: solo contratos que se pueden describir con TS puro (sin RxJS, sin Angular).
- **Application ports**: contratos que dependen de tecnología o librerías (ej: `Observable`, DI, Http, etc).

Ejemplo típico:

- `PaymentGateway` que retorna `Observable` → debe vivir en `application/ports`.

---

## 3) Filosofía del diseño (cómo se “programa” aquí)

### 3.1 Extensibilidad (OCP real)

La meta es poder agregar:

- providers (Stripe, PayPal, Fake, etc.)
- métodos (Card, SPEI, ApplePay, etc.)

**sin** introducir:

- `switch(providerId)` en use cases
- `if/else` gigantes por provider en el core

Regla:
✅ Si estás a punto de meter un `switch(providerId)`, probablemente falta un **Registry / Factory / Token**.

### 3.2 Minimal change, high impact

Cambios deben ser:

- incrementales,
- con scope claro,
- testeables,
- y con riesgo controlado.

Refactors masivos solo se permiten si:

- hay razón fuerte,
- y el beneficio es claro,
- y hay plan incremental.

---

## 4) Contrato de errores (PaymentError)

### 4.1 `PaymentError` como error estándar del sistema

El módulo tiene un error estructurado:

**PaymentError**

- `code`
- `providerId`
- `messageKey`
- `raw`
- `stacks`

Objetivo:

- los errores deben ser **manejables**, **testeables** y **consistentes**.

> Nota: el shape puede evolucionar, pero debe hacerse incrementalmente sin romper todo.

### 4.2 `messageKey` NO es UI ni traducción

Regla clave:

- **Domain**: define el error por `code` (significado semántico).
- **Application (o UI Adapter)**: traduce `code` → `messageKey`.

Esto mantiene:
✅ Domain limpio  
✅ sin UI  
✅ sin traducciones

---

## 5) Clasificación de errores (recuperable vs fatal)

Los pagos por naturaleza requieren distinguir si el sistema debe:

- **reintentar / fallbackear**, o
- **fallar inmediatamente**.

### 5.1 Error fatal (no se intenta fallback)

Ejemplos típicos:

- token inválido
- request inválido
- datos faltantes
- validaciones de negocio que NO dependen del provider

Acción:

- ir directo a estado `error`
- mostrar mensaje claro
- permitir corregir / reintentar

### 5.2 Error recuperable (fallback posible)

Ejemplos típicos:

- provider caído
- timeout / 5xx
- provider unavailable

Acción:

- reportar al `FallbackOrchestrator`
- decidir fallback auto/manual según contexto

### 5.3 Dónde vive la “regla” de recuperabilidad

Decisión del proyecto:

- ✅ **La clasificación de error (recuperable/fatal) pertenece al Domain como regla de negocio**
  - porque define “qué hacer cuando el sistema falla” sin depender del framework/tech.
- ✅ **La implementación concreta de esta regla vive en Application**
  - porque es donde se ejecuta el flujo (use cases/orchestrator) y puede usar herramientas/infra.

Recomendación práctica:

- Domain define **la intención** (por ejemplo, lista de códigos recuperables/fatales como tipos/consts TS puros).
- Application consume esa lista y la usa para decidir fallback.

---

## 6) Normalización de errores (de infra hacia arriba)

### 6.1 ¿Dónde se normaliza a `PaymentError`?

Regla:

✅ **Infrastructure (operations/gateways) debe normalizar cualquier error a `PaymentError`.**

Motivo:

- Infra es donde viven los errores “reales” (HTTP, red, parsing, provider quirks).
- Application/UI deben trabajar con un contrato estable.
- Se evita repetir normalización en cada flujo.

Esto implica:

- Cualquier `unknown | Error | HttpErrorResponse` en infra se transforma a `PaymentError` antes de salir.

---

## 7) Regla anti-UI colgada (cold streams + safeDefer)

### 7.1 Regla general

Objetivo:

- evitar “Unhandled error” en Vitest,
- evitar loading eterno,
- evitar estados colgados,
- mantener streams predecibles.

Regla del proyecto:

- Los use cases normalmente deben iniciar su ejecución con un wrapper tipo `safeDefer(...)` para encapsular throws sync dentro del Observable.

### 7.2 ¿Es obligatorio `safeDefer` siempre?

No es dogma, pero es altamente recomendado en el contexto actual porque:

- mantiene cold streams consistentes,
- captura errores sync sin congelar UI,
- estabiliza tests e integración.

Si una parte del sistema necesita comportamiento distinto (hot stream o ejecución inmediata), debe justificarse explícitamente.

---

## 8) Estado UI oficial (state machine básica)

Estados válidos (mínimo):

- `idle`
- `loading`
- `ready`
- `error`
- `fallback-pending`

Reglas:

- La UI **no puede** quedarse en `loading` indefinidamente.
- Siempre debe existir una salida:
  - success (`ready`)
  - fail (`error`)
  - fallback (`fallback-pending`)
  - timeout + acción de usuario (retry/cancel)

✅ UX rule:

> siempre debe existir un timeout razonable para que el usuario pueda reintentar o cancelar.

---

## 9) Contrato de fallback (reglas del sistema)

El fallback es una responsabilidad del **FallbackOrchestratorService**, no de la UI, y no del dominio.

### 9.1 Quién decide fallback

Regla:

- El **Orchestrator** decide fallback porque depende del contexto del flujo.
- No todos los flujos requieren fallback (ej: `getHistory` no es igual a `startPayment`).

### 9.2 Qué errores entran a fallback

Regla:

- Fallback aplica principalmente a errores **recuperables** (clasificados por `PaymentError.code`).
- Errores fatales deben fallar inmediatamente.

### 9.3 Contrato de retorno cuando fallback se maneja

Regla estable del proyecto (modo actual):

- ✅ fallback handled → `EMPTY` (complete sin emitir)
- ✅ fallback not handled → propagate error

Motivos:

- evita romper `firstValueFrom()` en tests si se maneja correctamente,
- evita “Unhandled errors” en Vitest,
- evita UI colgada en loading eterno,
- mantiene el flujo principal limpio (sin usar error como control flow).

> Importante: `EMPTY` aquí significa **transición controlada**, no éxito.

### 9.4 Diseño preparado para migrar a mayor complejidad

El contrato actual usa `EMPTY` porque es estable y simple, pero debe mantenerse “migrable”.

Regla:

- Cualquier helper/utilidad que consuma use cases debe asumir que “handled fallback” puede no emitir.
- Si en el futuro el contrato cambia a un “FallbackHandledEvent” u otro enfoque, la migración debe ser incremental.

---

## 10) Tests: reglas y estabilidad

### 10.1 Pirámide deseada

- Unit tests → suficientes para core (no obsesión por 100% coverage)
- Integration specs (TestBed + flows) → happy paths y edge cases clave
- E2E (Playwright) → 1 a 3 críticos por mantenimiento alto

### 10.2 Regla de Stripe refactor por operaciones

Estándar del proyecto:

- **Operations** → tests con `HttpTestingController`
  - prueban URL, body, headers, mapping, normalize error
- **Adapter/Facade** → tests sólo de delegación con mocks
  - sin HTTP, sin TestBed pesado
  - valida que el entrypoint use las operaciones correctas

> Se recomienda que facades estén agrupados en una carpeta clara para entrada de flujos.

### 10.3 Regla para `firstValueFrom` (EMPTY-safe)

Como el contrato de fallback permite `EMPTY`, los tests deben evitar acoplarse directamente a esa decisión.

Regla recomendada:

- Si un use case puede completar con `EMPTY`, los tests deben usar un helper reusable para resolver el observable de forma estable.

Ejemplo conceptual (sin imponer implementación):

- Un helper de test que:
  - retorne `null`/`undefined` si completa sin emitir,
  - o el valor si emitió,
  - o rechace si hubo error.

Motivo:

- si el contrato de fallback cambia en el futuro, se migra cambiando el helper y no cientos de tests.

---

## 11) Reglas de DI (inyección y tokens)

### 11.1 Preferencia: tokens/ports sobre clases concretas

Regla:

- UI y Application deben depender de:
  - ports
  - tokens abstractos
  - interfaces de aplicación

y no directamente de clases concretas de infra.

Beneficio:

- desacoplamiento real
- tests más simples
- OCP más limpio
- facilidad de reemplazo (fake ↔ real)

### 11.2 Resolución de providers

Preferencia del proyecto:

✅ Multi-provider token (lista de factories)

- Registry resuelve por `providerId` sin `switch` en use cases.

---

## 12) Naming & Conventions

### 12.1 Naming rule

Usar **kebab-case** y que el nombre defina propósito + patrón:

Ejemplos:

- `start-payment.use-case.ts`
- `payment-intent.gateway.ts`
- `payment-error.type.ts`
- `payment.model.ts`

### 12.2 Imports

Preferencia:

- ❌ evitar barrel exports (`index.ts`) por riesgo a largo plazo
- ✅ usar path aliases en `tsconfig` cuando sea útil

### 12.3 Mappers: dónde viven

Regla:

- `infra/shared/mappers` → mapping genérico reusable
- `infra/{provider}/mappers` → mapping intrínseco del provider

---

## 13) UX Rule: timeouts por operación (loading nunca infinito)

Regla global:

> No se permite loading infinito. Si excede el timeout, se transiciona a un error recuperable con opción de reintento o fallback.

Timeouts recomendados:

- `start payment` → **15s**
- `confirm / cancel` → **10–15s**
- `get status` → **30s**

---

## 14) Troubleshooting (para nuevos devs y para IA)

### 14.1 Si falla una integración por DI (NG0201)

Checklist recomendado:

- Verificar configuración de `providePaymentsWithConfig(...)` (modo real vs fake).
- Confirmar que todos los sub-gateways/operations del facade estén registrados como providers.
- Confirmar que el token/port correcto está siendo inyectado (y no una clase concreta “perdida”).
- Revisar overrides de TestBed y módulos importados.

### 14.2 Si un test se cuelga en loading

Checklist recomendado:

- Verificar que el use case inicia con `safeDefer(...)` o equivalente.
- Verificar que throws sync no están fuera del stream.
- Confirmar que hay `catchError` y que el error termina en:
  - `error`, o
  - `fallback-pending`, o
  - `ready`
- Confirmar que el store libera `loading` en `finalize` o transición equivalente.
- Confirmar que el test no está esperando un valor cuando el contrato permite `EMPTY`.

---

## 15) Definition of Stable (mínimo para considerar el módulo estable)

Un PR se considera “estable” cuando:

- No existen throws sync escapando del stream (use cases safeDefer o equivalente)
- Los errores que salen de infra están normalizados (`PaymentError`)
- La clasificación recuperable/fatal funciona y evita fallbacks innecesarios
- Contrato de fallback se respeta (handled → no rompe UI ni tests)
- UI nunca queda en `loading` infinito (timeouts + acción posible)
- Agregar provider no requiere modificar use cases
- Tests pasan sin “Unhandled errors” en Vitest
