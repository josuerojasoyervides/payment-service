import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { RetryService, RETRY_CONFIG } from './retry.service';
import { LoggerService } from './logger.service';
import { DEFAULT_RETRY_CONFIG, calculateBackoffDelay, parseRetryAfterHeader } from '../models/retry.types';

describe('RetryService', () => {
    let service: RetryService;
    let loggerSpy: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        loggerSpy = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                RetryService,
                { provide: LoggerService, useValue: loggerSpy },
            ],
        });

        service = TestBed.inject(RetryService);
    });

    afterEach(() => {
        service.clearAllRetryStates();
    });

    describe('getConfig', () => {
        it('should return default config', () => {
            const config = service.getConfig();
            expect(config.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
            expect(config.initialDelay).toBe(DEFAULT_RETRY_CONFIG.initialDelay);
        });
    });

    describe('shouldRetry', () => {
        it('should return true for retryable error and method', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            expect(service.shouldRetry(error, 'GET', 1)).toBe(true);
        });

        it('should return false when max retries reached', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            expect(service.shouldRetry(error, 'GET', 3)).toBe(false);
        });

        it('should return false for non-retryable method (POST)', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            expect(service.shouldRetry(error, 'POST', 1)).toBe(false);
        });

        it('should return false for non-retryable status code (400)', () => {
            const error = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
            expect(service.shouldRetry(error, 'GET', 1)).toBe(false);
        });

        it('should return true for 429 Too Many Requests', () => {
            const error = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
            expect(service.shouldRetry(error, 'GET', 1)).toBe(true);
        });

        it('should return true for 500 Internal Server Error', () => {
            const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
            expect(service.shouldRetry(error, 'GET', 1)).toBe(true);
        });

        it('should return true for DELETE method', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            expect(service.shouldRetry(error, 'DELETE', 1)).toBe(true);
        });

        it('should return true for PUT method', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            expect(service.shouldRetry(error, 'PUT', 1)).toBe(true);
        });
    });

    describe('getDelay', () => {
        it('should calculate exponential backoff delay', () => {
            const delay1 = service.getDelay(1);
            const delay2 = service.getDelay(2);

            // Con jitter, los delays no son exactos, pero deberían estar en un rango
            const config = service.getConfig();
            const jitterRange = config.jitterFactor * config.initialDelay;

            expect(delay1).toBeGreaterThanOrEqual(config.initialDelay - jitterRange);
            expect(delay1).toBeLessThanOrEqual(config.initialDelay + jitterRange);

            // El segundo delay debería ser aproximadamente el doble
            const expectedDelay2 = config.initialDelay * config.backoffMultiplier;
            const jitterRange2 = config.jitterFactor * expectedDelay2;
            expect(delay2).toBeGreaterThanOrEqual(expectedDelay2 - jitterRange2);
            expect(delay2).toBeLessThanOrEqual(expectedDelay2 + jitterRange2);
        });

        it('should respect maxDelay', () => {
            const config = service.getConfig();
            const delay = service.getDelay(10); // Muy alto para exceder maxDelay
            expect(delay).toBeLessThanOrEqual(config.maxDelay * (1 + config.jitterFactor));
        });

        it('should use Retry-After header when present (seconds)', () => {
            const headers = new HttpHeaders({ 'Retry-After': '5' });
            const error = new HttpErrorResponse({
                status: 429,
                statusText: 'Too Many Requests',
                headers,
            });

            const delay = service.getDelay(1, error);
            expect(delay).toBe(5000); // 5 segundos en ms
        });

        it('should cap Retry-After to maxDelay', () => {
            const headers = new HttpHeaders({ 'Retry-After': '60' }); // 60 segundos
            const error = new HttpErrorResponse({
                status: 429,
                statusText: 'Too Many Requests',
                headers,
            });

            const config = service.getConfig();
            const delay = service.getDelay(1, error);
            expect(delay).toBeLessThanOrEqual(config.maxDelay);
        });
    });

    describe('recordAttempt', () => {
        it('should record retry attempt', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test', 'GET', 1, 1000, error);

            const state = service.getRetryState('/api/test', 'GET');
            expect(state).toBeDefined();
            expect(state?.attempts.length).toBe(1);
            expect(state?.attempts[0].attempt).toBe(1);
            expect(state?.attempts[0].delay).toBe(1000);
        });

        it('should log warning for retry attempt', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test', 'GET', 1, 1000, error);

            expect(loggerSpy.warn).toHaveBeenCalledWith(
                expect.stringContaining('Retry attempt'),
                'RetryService',
                expect.objectContaining({
                    url: '/api/test',
                    method: 'GET',
                    attempt: 1,
                })
            );
        });
    });

    describe('recordSuccess', () => {
        it('should mark state as succeeded', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test', 'GET', 1, 1000, error);
            service.recordSuccess('/api/test', 'GET');

            const state = service.getRetryState('/api/test', 'GET');
            expect(state?.succeeded).toBe(true);
            expect(state?.endedAt).toBeDefined();
        });

        it('should log info for success after retries', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test', 'GET', 1, 1000, error);
            service.recordSuccess('/api/test', 'GET');

            expect(loggerSpy.info).toHaveBeenCalledWith(
                expect.stringContaining('Request succeeded'),
                'RetryService',
                expect.any(Object)
            );
        });
    });

    describe('recordFailure', () => {
        it('should mark state as failed', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test', 'GET', 1, 1000, error);
            service.recordFailure('/api/test', 'GET');

            const state = service.getRetryState('/api/test', 'GET');
            expect(state?.succeeded).toBe(false);
            expect(state?.endedAt).toBeDefined();
        });
    });

    describe('clearRetryState', () => {
        it('should clear state for specific URL', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test1', 'GET', 1, 1000, error);
            service.recordAttempt('/api/test2', 'GET', 1, 1000, error);

            service.clearRetryState('/api/test1', 'GET');

            expect(service.getRetryState('/api/test1', 'GET')).toBeUndefined();
            expect(service.getRetryState('/api/test2', 'GET')).toBeDefined();
        });
    });

    describe('clearAllRetryStates', () => {
        it('should clear all states', () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            service.recordAttempt('/api/test1', 'GET', 1, 1000, error);
            service.recordAttempt('/api/test2', 'GET', 1, 1000, error);

            service.clearAllRetryStates();

            expect(service.getAllRetryStates().size).toBe(0);
        });
    });
});

describe('Retry utility functions', () => {
    describe('calculateBackoffDelay', () => {
        const config = DEFAULT_RETRY_CONFIG;

        it('should calculate correct base delay for attempt 1', () => {
            // Sin jitter, el delay debería ser initialDelay
            const configNoJitter = { ...config, jitterFactor: 0 };
            const delay = calculateBackoffDelay(1, configNoJitter);
            expect(delay).toBe(config.initialDelay);
        });

        it('should double delay for attempt 2', () => {
            const configNoJitter = { ...config, jitterFactor: 0 };
            const delay = calculateBackoffDelay(2, configNoJitter);
            expect(delay).toBe(config.initialDelay * config.backoffMultiplier);
        });

        it('should cap at maxDelay', () => {
            const configNoJitter = { ...config, jitterFactor: 0 };
            const delay = calculateBackoffDelay(100, configNoJitter);
            expect(delay).toBe(config.maxDelay);
        });

        it('should add jitter within expected range', () => {
            const delay = calculateBackoffDelay(1, config);
            const expectedBase = config.initialDelay;
            const jitterRange = config.jitterFactor * expectedBase;

            expect(delay).toBeGreaterThanOrEqual(expectedBase - jitterRange);
            expect(delay).toBeLessThanOrEqual(expectedBase + jitterRange);
        });
    });

    describe('parseRetryAfterHeader', () => {
        it('should return undefined when no header', () => {
            const error = new HttpErrorResponse({ status: 429 });
            expect(parseRetryAfterHeader(error)).toBeUndefined();
        });

        it('should parse seconds value', () => {
            const headers = new HttpHeaders({ 'Retry-After': '10' });
            const error = new HttpErrorResponse({ status: 429, headers });
            expect(parseRetryAfterHeader(error)).toBe(10000);
        });

        it('should parse HTTP date value', () => {
            const futureDate = new Date(Date.now() + 5000);
            const headers = new HttpHeaders({ 'Retry-After': futureDate.toUTCString() });
            const error = new HttpErrorResponse({ status: 429, headers });

            const delay = parseRetryAfterHeader(error);
            expect(delay).toBeDefined();
            expect(delay!).toBeGreaterThan(0);
            expect(delay!).toBeLessThanOrEqual(6000); // ~5 segundos con margen
        });

        it('should return undefined for past date', () => {
            const pastDate = new Date(Date.now() - 5000);
            const headers = new HttpHeaders({ 'Retry-After': pastDate.toUTCString() });
            const error = new HttpErrorResponse({ status: 429, headers });

            expect(parseRetryAfterHeader(error)).toBeUndefined();
        });
    });
});

describe('RetryService with custom config', () => {
    let service: RetryService;
    let loggerSpy: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        loggerSpy = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                RetryService,
                { provide: LoggerService, useValue: loggerSpy },
                {
                    provide: RETRY_CONFIG,
                    useValue: {
                        maxRetries: 5,
                        initialDelay: 500,
                        retryableMethods: ['GET', 'POST'], // Incluir POST
                    },
                },
            ],
        });

        service = TestBed.inject(RetryService);
    });

    it('should use custom maxRetries', () => {
        const config = service.getConfig();
        expect(config.maxRetries).toBe(5);
    });

    it('should use custom initialDelay', () => {
        const config = service.getConfig();
        expect(config.initialDelay).toBe(500);
    });

    it('should allow POST with custom config', () => {
        const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
        expect(service.shouldRetry(error, 'POST', 1)).toBe(true);
    });

    it('should allow more retries with custom config', () => {
        const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
        expect(service.shouldRetry(error, 'GET', 4)).toBe(true);
        expect(service.shouldRetry(error, 'GET', 5)).toBe(false);
    });
});
