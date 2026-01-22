# PR Title

<!-- Ej: "Stabilize PaymentError mapping in UI + tests" -->

## 🎯 Objetivo del cambio

<!-- Explica el propósito real del PR en 1–3 líneas -->

-

## 🧠 Contexto / por qué se necesitaba

<!-- Qué problema resolvemos y por qué importa -->

-

## ✅ Alcance (qué incluye)

<!-- Lista explícita de cosas que sí cambiaste -->

- [ ]
- [ ]

## 🚫 Fuera de alcance (qué NO incluye)

<!-- Para evitar scope creep -->

- [ ] No se agregan features nuevas
- [ ] No se hace refactor masivo
- [ ] No se cambian contratos salvo que sea necesario y documentado

---

## 🏗️ Arquitectura / reglas (checklist obligatorio)

### Capas y dependencias

- [ ] Domain sigue siendo TypeScript puro (sin Angular/RxJS/Http/i18n/logger)
- [ ] Application depende solo de Domain
- [ ] Infrastructure depende de Application + Domain
- [ ] UI depende solo de Application

### OCP y extensibilidad

- [ ] No agregué `switch(providerId)` en use cases
- [ ] No introduje `if/else` gigante por provider/method
- [ ] Agregar un provider/method con este PR sería más fácil que antes

### Errores y estabilidad

- [ ] Infra normaliza errores a `PaymentError`
- [ ] `PaymentError` mantiene shape estable: `{ code, providerId, messageKey, raw, stacks }`
- [ ] No introduje `any` / `as any` / hacks para avanzar
- [ ] No hay throws sync escapando el stream (use cases usan `safeDefer` o equivalente)
- [ ] Regla de fallback respetada:
  - [ ] fallback handled → `EMPTY`
  - [ ] fallback not handled → error propagate

### UX (anti-loading infinito)

- [ ] No hay loading infinito
- [ ] Timeouts aplican según operación:
  - [ ] start payment → ~15s
  - [ ] confirm/cancel → 10–15s
  - [ ] get status → ~30s
- [ ] Si hay timeout, el usuario puede reintentar o fallbackear

---

## 🧪 Tests (checklist obligatorio)

### Unit tests

- [ ] Tests unitarios relevantes agregados/actualizados
- [ ] No intenté forzar 100% coverage: probé core y edgecases importantes

### Operations vs Adapter (regla Stripe)

- [ ] Operations (HTTP) testeadas con `HttpTestingController` (si aplica)
- [ ] Adapter/Facade testeado con mocks y delegación (sin HTTP) (si aplica)

### Integration specs

- [ ] Happy path(s) clave cubiertos/actualizados
- [ ] Edge case(s) relevantes cubiertos/actualizados

### Ejecución

- [ ] `bun run test` pasa en local
- [ ] No hay “Unhandled errors” en Vitest

---

## 📦 Archivos / módulos tocados

<!-- Lista de archivos importantes (no exhaustivo) -->

- `...`
- `...`

---

## 🧩 Decisiones importantes tomadas

<!-- Si tomaste una decisión arquitectónica, escríbela aquí. -->

- ***

## ⚠️ Riesgos / regresiones posibles

<!-- Qué podría romperse con este cambio -->

-

## 🛡️ Mitigaciones

<!-- Qué hiciste para minimizar el riesgo -->

- ***

## 📝 Notas para el reviewer / IA

<!-- Tips para revisar o continuar el trabajo después -->

- ***

## ✅ Definition of Done (DoD)

- [ ] Tests verdes
- [ ] Contratos intactos o documentados
- [ ] Sin deuda técnica activa introducida
- [ ] Cambio incremental y mantenible
- [ ] Mejora real de estabilidad o extensibilidad
