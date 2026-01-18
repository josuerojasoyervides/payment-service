import { InjectionToken } from '@angular/core';
import { PaymentStrategy } from '../../domain/ports/payment-strategy.port';
import { PaymentProviderId } from '../../domain/models/payment.types';

/**
 * Token para inyectar estrategias de pago por provider.
 *
 * Cada provider registra sus propias estrategias usando multi: true.
 * Esto permite agregar nuevos métodos de pago sin modificar código existente.
 */
export const PAYMENT_STRATEGIES = new InjectionToken<PaymentStrategy[]>('PAYMENT_STRATEGIES');

/**
 * Interfaz para registrar estrategias con metadata.
 */
export interface RegisteredStrategy {
    /** Provider al que pertenece esta estrategia */
    providerId: PaymentProviderId;
    /** La estrategia en sí */
    strategy: PaymentStrategy;
}

/**
 * Token para estrategias con su metadata.
 */
export const REGISTERED_PAYMENT_STRATEGIES = new InjectionToken<RegisteredStrategy[]>('REGISTERED_PAYMENT_STRATEGIES');
