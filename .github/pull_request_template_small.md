# PR Title
<!-- Ej: "Fix PaymentError messageKey mapping in Status page" -->

## 🎯 Qué cambia
- 

## 🧠 Por qué
- 

## ✅ Checklist rápido

### Arquitectura
- [ ] Domain sigue TS puro (sin Angular/RxJS/Http/i18n/logger)
- [ ] No agregué `switch(providerId)` ni if/else gigante
- [ ] No introduje `any` / hacks

### Estabilidad
- [ ] No hay throws sync escapando el stream (safeDefer si aplica)
- [ ] Fallback contract no se rompe (handled → EMPTY)

### UX
- [ ] No dejo loading infinito (timeout o salida clara)

### Tests
- [ ] Tests actualizados o agregados (unit/integration si aplica)
- [ ] Vitest pasa sin “Unhandled errors”

## 📦 Archivos tocados
- 
