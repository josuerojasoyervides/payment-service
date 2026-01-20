import { Injectable, InjectionToken, inject } from '@angular/core';
import {
    CircuitState,
    CircuitInfo,
    CircuitBreakerConfig,
    CircuitOpenError,
    DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker.types';
import { LoggerService } from '../../logging/logger.service';

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
                if (circuit.openedAt && (now - circuit.openedAt) >= this.config.resetTimeout) {
                    this.transitionTo(endpoint, circuit, 'half-open');
                    return true;
                }
                throw new CircuitOpenError(endpoint, circuit);

            case 'half-open':
                return true;
        }
    }

    /**
     * Records a success for an endpoint.
     */
    recordSuccess(endpoint: string): void {
        const circuit = this.getOrCreateCircuit(endpoint);

        switch (circuit.state) {
            case 'closed':
                circuit.failures = 0;
                break;

            case 'half-open':
                circuit.successes++;
                
                if (circuit.successes >= this.config.successThreshold) {
                    this.transitionTo(endpoint, circuit, 'closed');
                }
                break;

            case 'open':
                break;
        }
    }

    /**
     * Records a failure for an endpoint.
     */
    recordFailure(endpoint: string, statusCode?: number): void {
        if (statusCode && !this.config.failureStatusCodes.includes(statusCode)) {
            return;
        }

        const circuit = this.getOrCreateCircuit(endpoint);
        const now = Date.now();

        switch (circuit.state) {
            case 'closed':
                if (circuit.lastFailure && (now - circuit.lastFailure) > this.config.failureWindow) {
                    circuit.failures = 1;
                } else {
                    circuit.failures++;
                }

                circuit.lastFailure = now;

                if (circuit.failures >= this.config.failureThreshold) {
                    this.transitionTo(endpoint, circuit, 'open');
                }
                break;

            case 'half-open':
                this.transitionTo(endpoint, circuit, 'open');
                break;

            case 'open':
                circuit.lastFailure = now;
                break;
        }
    }

    /**
     * Gets the current state of a circuit.
     */
    getCircuitInfo(endpoint: string): CircuitInfo | undefined {
        return this.circuits.get(this.normalizeEndpoint(endpoint));
    }

    /**
     * Gets all active circuits.
     */
    getAllCircuits(): Map<string, CircuitInfo> {
        return new Map(this.circuits);
    }

    /**
     * Resets a specific circuit.
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
     * Resets all circuits.
     */
    resetAll(): void {
        this.circuits.clear();
        this.logger.info('All circuits reset', 'CircuitBreaker');
    }

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
