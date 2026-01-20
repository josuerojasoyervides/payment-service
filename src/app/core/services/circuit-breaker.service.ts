import { Injectable, InjectionToken, inject } from '@angular/core';
import {
    CircuitState,
    CircuitInfo,
    CircuitBreakerConfig,
    CircuitOpenError,
    DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from '../models';
import { LoggerService } from './logger.service';

/**
 * Token para inyectar configuración del Circuit Breaker.
 */
export const CIRCUIT_BREAKER_CONFIG = new InjectionToken<Partial<CircuitBreakerConfig>>('CIRCUIT_BREAKER_CONFIG');

/**
 * Servicio de Circuit Breaker.
 * 
 * Implementa el patrón Circuit Breaker para prevenir llamadas a servicios
 * que están fallando repetidamente.
 * 
 * Estados:
 * - CLOSED: Operación normal, las llamadas pasan
 * - OPEN: Después de N fallos, rechaza llamadas inmediatamente
 * - HALF-OPEN: Después del timeout, permite una llamada de prueba
 * 
 * @example
 * ```typescript
 * // Verificar antes de llamar
 * if (circuitBreaker.canRequest('/api/payments')) {
 *   try {
 *     const result = await makeRequest();
 *     circuitBreaker.recordSuccess('/api/payments');
 *   } catch (e) {
 *     circuitBreaker.recordFailure('/api/payments');
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CircuitBreakerService {
    private readonly injectedConfig = inject(CIRCUIT_BREAKER_CONFIG, { optional: true });
    private readonly config: CircuitBreakerConfig;
    private readonly circuits = new Map<string, CircuitInfo>();
    private readonly logger = inject(LoggerService);

    constructor() {
        this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...this.injectedConfig };
    }

    /**
     * Verifica si se puede hacer un request a un endpoint.
     * 
     * @param endpoint Identificador del endpoint
     * @returns true si el request puede proceder
     * @throws CircuitOpenError si el circuito está abierto
     */
    canRequest(endpoint: string): boolean {
        const circuit = this.getOrCreateCircuit(endpoint);
        const now = Date.now();

        switch (circuit.state) {
            case 'closed':
                return true;

            case 'open':
                // Verificar si pasó el timeout para pasar a half-open
                if (circuit.openedAt && (now - circuit.openedAt) >= this.config.resetTimeout) {
                    this.transitionTo(endpoint, circuit, 'half-open');
                    return true;
                }
                throw new CircuitOpenError(endpoint, circuit);

            case 'half-open':
                // En half-open solo permitimos un request a la vez
                // Si ya hay uno en vuelo, rechazamos
                return true;
        }
    }

    /**
     * Registra un éxito para un endpoint.
     */
    recordSuccess(endpoint: string): void {
        const circuit = this.getOrCreateCircuit(endpoint);

        switch (circuit.state) {
            case 'closed':
                // Reset de fallos en closed
                circuit.failures = 0;
                break;

            case 'half-open':
                circuit.successes++;
                
                // Si alcanzamos el threshold de éxitos, cerrar el circuito
                if (circuit.successes >= this.config.successThreshold) {
                    this.transitionTo(endpoint, circuit, 'closed');
                }
                break;

            case 'open':
                // No debería pasar, pero por si acaso
                break;
        }
    }

    /**
     * Registra un fallo para un endpoint.
     */
    recordFailure(endpoint: string, statusCode?: number): void {
        // Verificar si el status code cuenta como fallo
        if (statusCode && !this.config.failureStatusCodes.includes(statusCode)) {
            // 4xx errors no abren el circuito (son errores del cliente)
            return;
        }

        const circuit = this.getOrCreateCircuit(endpoint);
        const now = Date.now();

        switch (circuit.state) {
            case 'closed':
                // Verificar si el fallo está dentro de la ventana
                if (circuit.lastFailure && (now - circuit.lastFailure) > this.config.failureWindow) {
                    // Fuera de la ventana, resetear contador
                    circuit.failures = 1;
                } else {
                    circuit.failures++;
                }

                circuit.lastFailure = now;

                // Verificar si debemos abrir el circuito
                if (circuit.failures >= this.config.failureThreshold) {
                    this.transitionTo(endpoint, circuit, 'open');
                }
                break;

            case 'half-open':
                // Un fallo en half-open vuelve a abrir el circuito
                this.transitionTo(endpoint, circuit, 'open');
                break;

            case 'open':
                // Ya está abierto, solo actualizamos lastFailure
                circuit.lastFailure = now;
                break;
        }
    }

    /**
     * Obtiene el estado actual de un circuito.
     */
    getCircuitInfo(endpoint: string): CircuitInfo | undefined {
        return this.circuits.get(this.normalizeEndpoint(endpoint));
    }

    /**
     * Obtiene todos los circuitos activos.
     */
    getAllCircuits(): Map<string, CircuitInfo> {
        return new Map(this.circuits);
    }

    /**
     * Resetea un circuito específico.
     */
    reset(endpoint: string): void {
        const key = this.normalizeEndpoint(endpoint);
        this.circuits.delete(key);
        
        this.logger.info(
            `Circuit reset for ${endpoint}`,
            'CircuitBreaker',
            { endpoint }
        );
    }

    /**
     * Resetea todos los circuitos.
     */
    resetAll(): void {
        this.circuits.clear();
        this.logger.info('All circuits reset', 'CircuitBreaker');
    }

    // ============================================================
    // MÉTODOS PRIVADOS
    // ============================================================

    private getOrCreateCircuit(endpoint: string): CircuitInfo {
        const key = this.normalizeEndpoint(endpoint);
        
        if (!this.circuits.has(key)) {
            this.circuits.set(key, {
                state: 'closed',
                failures: 0,
                lastFailure: 0,
                successes: 0,
            });
        }

        return this.circuits.get(key)!;
    }

    private transitionTo(endpoint: string, circuit: CircuitInfo, newState: CircuitState): void {
        const oldState = circuit.state;
        circuit.state = newState;

        switch (newState) {
            case 'closed':
                circuit.failures = 0;
                circuit.successes = 0;
                circuit.openedAt = undefined;
                break;

            case 'open':
                circuit.openedAt = Date.now();
                circuit.successes = 0;
                break;

            case 'half-open':
                circuit.successes = 0;
                break;
        }

        this.logger.warn(
            `Circuit state changed: ${oldState} -> ${newState}`,
            'CircuitBreaker',
            {
                endpoint,
                failures: circuit.failures,
                oldState,
                newState,
            }
        );
    }

    /**
     * Normaliza el endpoint para usarlo como key.
     * Remueve query params y normaliza el path.
     */
    private normalizeEndpoint(endpoint: string): string {
        try {
            const url = new URL(endpoint, window.location.origin);
            // Usar solo el pathname, sin query params
            return url.pathname;
        } catch {
            return endpoint;
        }
    }
}
