import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
    RetryConfig,
    RetryAttemptInfo,
    RetryState,
    DEFAULT_RETRY_CONFIG,
    isRetryableError,
    isRetryableMethod,
    calculateBackoffDelay,
    parseRetryAfterHeader,
} from './retry.types';
import { LoggerService } from '../../logging/logger.service';

/**
 * Token para inyectar configuración del Retry.
 */
export const RETRY_CONFIG = new InjectionToken<Partial<RetryConfig>>('RETRY_CONFIG');

/**
 * Servicio de Retry con backoff exponencial.
 * 
 * Implementa lógica de reintentos automáticos para requests HTTP
 * con backoff exponencial y jitter para evitar thundering herd.
 * 
 * Características:
 * - Backoff exponencial configurable
 * - Jitter para distribuir reintentos
 * - Respeta header Retry-After
 * - Integración con LoggerService
 * - Tracking de estados de retry
 * 
 * @example
 * ```typescript
 * // Verificar si debe reintentar
 * if (retryService.shouldRetry(error, 'GET', attempt)) {
 *   const delay = retryService.getDelay(attempt, error);
 *   await sleep(delay);
 *   // Reintentar...
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class RetryService {
    private readonly injectedConfig = inject(RETRY_CONFIG, { optional: true });
    private readonly config: RetryConfig;
    private readonly logger = inject(LoggerService);

    /** Estado de retry por URL (para debugging/observabilidad) */
    private readonly retryStates = new Map<string, RetryState>();

    constructor() {
        this.config = { ...DEFAULT_RETRY_CONFIG, ...this.injectedConfig };
    }

    /**
     * Obtiene la configuración actual de retry.
     */
    getConfig(): Readonly<RetryConfig> {
        return this.config;
    }

    /**
     * Determina si un request debe ser reintentado.
     * 
     * @param error Error HTTP que ocurrió
     * @param method Método HTTP del request
     * @param attempt Número del intento actual (1-based)
     * @returns true si debe reintentar
     */
    shouldRetry(error: HttpErrorResponse, method: string, attempt: number): boolean {
        // Verificar si quedan intentos
        if (attempt >= this.config.maxRetries) {
            this.logger.debug(
                `Max retries (${this.config.maxRetries}) reached`,
                'RetryService',
                { attempt, maxRetries: this.config.maxRetries }
            );
            return false;
        }

        if (!isRetryableMethod(method, this.config)) {
            this.logger.debug(
                `Method ${method} is not retryable`,
                'RetryService',
                { method, retryableMethods: this.config.retryableMethods }
            );
            return false;
        }

        if (!isRetryableError(error, this.config)) {
            this.logger.debug(
                `Status ${error.status} is not retryable`,
                'RetryService',
                { status: error.status, retryableStatusCodes: this.config.retryableStatusCodes }
            );
            return false;
        }

        return true;
    }

    /**
     * Calcula el delay para el próximo intento.
     * 
     * @param attempt Número del intento (1-based)
     * @param error Error HTTP (opcional, para extraer Retry-After)
     * @returns Delay en milisegundos
     */
    getDelay(attempt: number, error?: HttpErrorResponse): number {
        // Si hay header Retry-After, usarlo con prioridad
        if (error) {
            const retryAfter = parseRetryAfterHeader(error);
            if (retryAfter !== undefined) {
                this.logger.debug(
                    `Using Retry-After header: ${retryAfter}ms`,
                    'RetryService',
                    { retryAfter, attempt }
                );
                return Math.min(retryAfter, this.config.maxDelay);
            }
        }

        // Calcular backoff exponencial con jitter
        return calculateBackoffDelay(attempt, this.config);
    }

    /**
     * Registra un intento de retry para tracking.
     * 
     * @param url URL del request
     * @param method Método HTTP
     * @param attempt Número del intento
     * @param delay Delay usado
     * @param error Error que causó el retry
     */
    recordAttempt(
        url: string,
        method: string,
        attempt: number,
        delay: number,
        error: HttpErrorResponse
    ): void {
        const key = `${method}:${url}`;
        let state = this.retryStates.get(key);

        if (!state || attempt === 1) {
            state = {
                url,
                method,
                attempts: [],
                succeeded: false,
                startedAt: Date.now(),
            };
            this.retryStates.set(key, state);
        }

        const attemptInfo: RetryAttemptInfo = {
            attempt,
            maxAttempts: this.config.maxRetries,
            delay,
            error,
            timestamp: Date.now(),
        };

        state.attempts.push(attemptInfo);

        this.logger.warn(
            `Retry attempt ${attempt}/${this.config.maxRetries}`,
            'RetryService',
            {
                url,
                method,
                attempt,
                delay,
                status: error.status,
                statusText: error.statusText,
            }
        );
    }

    /**
     * Marca un retry como exitoso.
     */
    recordSuccess(url: string, method: string): void {
        const key = `${method}:${url}`;
        const state = this.retryStates.get(key);

        if (state) {
            state.succeeded = true;
            state.endedAt = Date.now();

            const totalTime = state.endedAt - state.startedAt;
            const totalAttempts = state.attempts.length + 1;

            this.logger.info(
                `Request succeeded after ${totalAttempts} attempt(s)`,
                'RetryService',
                {
                    url,
                    method,
                    totalAttempts,
                    totalTime,
                }
            );
        }
    }

    /**
     * Marca un retry como fallido (agotado).
     */
    recordFailure(url: string, method: string): void {
        const key = `${method}:${url}`;
        const state = this.retryStates.get(key);

        if (state) {
            state.succeeded = false;
            state.endedAt = Date.now();

            const totalTime = state.endedAt - state.startedAt;

            this.logger.error(
                `Request failed after ${state.attempts.length} retry attempts`,
                'RetryService',
                null,
                {
                    url,
                    method,
                    totalAttempts: state.attempts.length,
                    totalTime,
                }
            );
        }
    }

    /**
     * Obtiene el estado de retry para un URL específico.
     */
    getRetryState(url: string, method: string): RetryState | undefined {
        return this.retryStates.get(`${method}:${url}`);
    }

    /**
     * Obtiene todos los estados de retry activos.
     */
    getAllRetryStates(): Map<string, RetryState> {
        return new Map(this.retryStates);
    }

    /**
     * Limpia el estado de retry para un URL específico.
     */
    clearRetryState(url: string, method: string): void {
        this.retryStates.delete(`${method}:${url}`);
    }

    /**
     * Limpia todos los estados de retry.
     */
    clearAllRetryStates(): void {
        this.retryStates.clear();
    }

    /**
     * Crea un delay promise para usar en async/await.
     */
    delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
