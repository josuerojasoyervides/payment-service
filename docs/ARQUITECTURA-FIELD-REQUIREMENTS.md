# Análisis: ¿Dónde debe ir `FIELD_REQUIREMENTS`?

## Situación Actual

Actualmente hay una inconsistencia en la arquitectura:

1. **PayPal**: Ya migró a usar `getFieldRequirements()` en la Factory con i18n ✅
2. **Stripe Card**: Ya migró a usar `getFieldRequirements()` en la Factory con i18n ✅
3. **Stripe SPEI**: Todavía usa `FIELD_REQUIREMENTS` estático en el Builder ❌
4. **PayPal Builder**: Tiene `FIELD_REQUIREMENTS` estático marcado como `@deprecated` pero aún se usa en tests ❌

## Análisis de Arquitectura

### Responsabilidades según Clean Architecture

#### **Builder (Infrastructure Layer)**
- **Responsabilidad**: Construir requests válidos para el provider
- **Conoce**: La estructura de datos que el provider espera
- **NO debe conocer**: Cómo la UI se describe a sí misma

#### **Factory (Infrastructure Layer)**
- **Responsabilidad**: Crear builders, strategies y gateways
- **Responsabilidad adicional**: Exponer metadata a la UI (orquestación)
- **Conoce**: Qué builders crear y qué metadata exponer

### ¿Dónde debe ir `FIELD_REQUIREMENTS`?

**Respuesta: En la Factory, NO en el Builder**

### Razones:

1. **Separación de Responsabilidades**
   - Builder = Lógica de construcción (Domain/Infrastructure)
   - Factory = Orquestación y metadata para UI (Application/Infrastructure boundary)

2. **Principio de Responsabilidad Única (SRP)**
   - Builder: "Cómo construir un request válido"
   - Factory: "Qué necesita la UI para renderizar el formulario"

3. **Desacoplamiento**
   - La UI consulta la Factory, no el Builder directamente
   - Si cambia la UI, solo cambia la Factory, no el Builder

4. **i18n (Internacionalización)**
   - Los textos deben venir de i18n, no hardcodeados
   - La Factory puede inyectar `I18nService`, el Builder no debería necesitarlo

5. **Testabilidad**
   - Tests del Builder prueban construcción, no metadata
   - Tests de la Factory prueban metadata y orquestación

6. **Consistencia**
   - PayPal y Stripe Card ya usan Factory ✅
   - Stripe SPEI debería migrar también

## Recomendación

### ✅ CORRECTO: Factory con i18n

```typescript
// PaypalProviderFactory
getFieldRequirements(type: PaymentMethodType): FieldRequirements {
    return {
        description: this.i18n.t(I18nKeys.ui.pay_with_paypal),
        instructions: this.i18n.t(I18nKeys.ui.paypal_redirect_secure_message),
        fields: [
            {
                name: 'returnUrl',
                label: this.i18n.t(I18nKeys.ui.return_url_label),
                required: true,
                type: 'hidden',
                autoFill: 'currentUrl',
            },
        ],
    };
}
```

### ❌ INCORRECTO: Builder con campo estático

```typescript
// PaypalRedirectRequestBuilder
static readonly FIELD_REQUIREMENTS: FieldRequirements = {
    description: 'Pagar con PayPal', // Hardcoded, sin i18n
    instructions: 'Serás redirigido...', // Hardcoded, sin i18n
    fields: [...]
};
```

## Plan de Migración

1. ✅ **PayPal**: Ya migrado
2. ✅ **Stripe Card**: Ya migrado
3. ⏳ **Stripe SPEI**: Migrar `FIELD_REQUIREMENTS` de Builder a Factory
4. ⏳ **PayPal Builder**: Eliminar campo deprecado y actualizar tests

## Beneficios de la Migración

- ✅ Consistencia arquitectónica
- ✅ Soporte para i18n
- ✅ Mejor separación de responsabilidades
- ✅ Más fácil de testear
- ✅ Menos acoplamiento entre capas

## Conclusión

**`FIELD_REQUIREMENTS` debe estar en la Factory, no en el Builder.**

La Factory actúa como un **adaptador** entre el dominio (builders) y la UI (field requirements), cumpliendo con el principio de inversión de dependencias y manteniendo el desacoplamiento entre capas.
