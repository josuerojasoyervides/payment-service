/**
 * Re-exports de las estrategias que Stripe utiliza.
 *
 * Stripe usa las estrategias compartidas de `shared/strategies/`
 * que son genéricas y reutilizables entre proveedores.
 *
 * Este archivo proporciona simetría estructural con PayPal
 * y facilita imports localizados dentro del módulo de Stripe.
 */
export { CardStrategy } from '../../../shared/strategies/card-strategy';
export { SpeiStrategy } from '../../../shared/strategies/spei-strategy';
