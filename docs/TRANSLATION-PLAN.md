# Plan de Unificación a Inglés

## Análisis de Comentarios

### Tipos de comentarios encontrados:

1. **JSDoc en español** - NECESARIOS, traducir
   - Documentación de clases, métodos, parámetros
   - Ejemplos de uso
   - Descripciones de tipos

2. **Comentarios inline explicativos** - EVALUAR
   - Comentarios que explican lógica compleja → MANTENER (traducir)
   - Comentarios obvios → ELIMINAR
   - Comentarios de sección (=== ===) → MANTENER (traducir)

3. **Comentarios de código** - EVALUAR
   - Notas sobre decisiones de diseño → MANTENER (traducir)
   - Comentarios TODO/FIXME → MANTENER (ya están en inglés)
   - Comentarios obvios → ELIMINAR

## Criterios para mantener comentarios:

✅ **MANTENER y traducir:**
- JSDoc de clases públicas
- Explicaciones de lógica compleja
- Decisiones de diseño importantes
- Comentarios de sección para organización
- Notas sobre limitaciones o edge cases

❌ **ELIMINAR:**
- Comentarios que solo repiten el código
- Comentarios obvios (ej: "// Incrementar contador" sobre `counter++`)
- Comentarios redundantes con nombres descriptivos

## Archivos prioritarios:

1. **Core/Infrastructure** (alta prioridad)
   - `stripe-provider.factory.ts`
   - `paypal-provider.factory.ts`
   - `stripe-card-request.builder.ts`
   - `stripe-spei-request.builder.ts`
   - `paypal-redirect-request.builder.ts`

2. **UI Components** (media prioridad)
   - `checkout.page.ts`
   - `payment-form.component.ts`
   - `spei-instructions.component.ts`

3. **Shared/Utilities** (baja prioridad)
   - `clabe-format.pipe.ts`
   - Componentes compartidos

## Proceso:

1. Traducir JSDoc primero (más importante)
2. Traducir comentarios inline necesarios
3. Eliminar comentarios obvios
4. Revisar y validar
