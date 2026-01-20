import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { retryInterceptor } from './retry.interceptor';
import { RetryService, RETRY_CONFIG } from '../services/retry.service';
import { LoggerService } from '../services/logger.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { CircuitOpenError } from '../models';

describe('retryInterceptor', () => {
    let httpClient: HttpClient;
    let httpTestingController: HttpTestingController;
    let retryService: RetryService;
    let loggerSpy: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    let circuitBreakerSpy: { canRequest: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        loggerSpy = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        circuitBreakerSpy = {
            canRequest: vi.fn().mockReturnValue(true),
        };

        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([retryInterceptor])),
                provideHttpClientTesting(),
                RetryService,
                { provide: LoggerService, useValue: loggerSpy },
                { provide: CircuitBreakerService, useValue: circuitBreakerSpy },
                {
                    provide: RETRY_CONFIG,
                    useValue: {
                        maxRetries: 3,
                        initialDelay: 10, // Fast for tests
                        jitterFactor: 0,
                    },
                },
            ],
        });

        httpClient = TestBed.inject(HttpClient);
        httpTestingController = TestBed.inject(HttpTestingController);
        retryService = TestBed.inject(RetryService);
    });

    afterEach(() => {
        httpTestingController.verify();
        retryService.clearAllRetryStates();
    });

    it('should pass through successful requests', () => {
        httpClient.get('/api/test').subscribe(response => {
            expect(response).toEqual({ data: 'test' });
        });

        const req = httpTestingController.expectOne('/api/test');
        req.flush({ data: 'test' });
    });

    it('should not retry POST requests by default', () => {
        httpClient.post('/api/test', {}).subscribe({
            error: (error) => {
                expect(error.status).toBe(503);
            },
        });

        const req = httpTestingController.expectOne('/api/test');
        req.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        // No more requests should be made
        httpTestingController.expectNone('/api/test');
    });

    it('should not retry 400 errors', () => {
        httpClient.get('/api/test').subscribe({
            error: (error) => {
                expect(error.status).toBe(400);
            },
        });

        const req = httpTestingController.expectOne('/api/test');
        req.flush('Bad Request', { status: 400, statusText: 'Bad Request' });

        // No more requests should be made
        httpTestingController.expectNone('/api/test');
    });

    it('should exclude health check URLs', () => {
        httpClient.get('/api/health').subscribe({
            error: (error) => {
                expect(error.status).toBe(503);
            },
        });

        const req = httpTestingController.expectOne('/api/health');
        req.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        // No more requests should be made (excluded URL)
        httpTestingController.expectNone('/api/health');
    });

    it('should not retry when circuit breaker is open', () => {
        circuitBreakerSpy.canRequest.mockImplementation(() => {
            throw new CircuitOpenError('/api/test', {
                state: 'open',
                failures: 5,
                lastFailure: Date.now(),
                successes: 0,
            });
        });

        httpClient.get('/api/test').subscribe({
            error: (error) => {
                expect(error.status).toBe(503);
            },
        });

        const req = httpTestingController.expectOne('/api/test');
        req.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        // No retry because circuit is open
        httpTestingController.expectNone('/api/test');
    });

    it('should retry GET requests on 503 error', async () => {
        let requestCount = 0;

        const resultPromise = new Promise<void>((resolve) => {
            httpClient.get('/api/test').subscribe({
                next: (response) => {
                    expect(response).toEqual({ data: 'success' });
                    expect(requestCount).toBe(2);
                    resolve();
                },
            });
        });

        // First request fails
        const req1 = httpTestingController.expectOne('/api/test');
        requestCount++;
        req1.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        // After delay, second request succeeds
        await new Promise(r => setTimeout(r, 50));
        const req2 = httpTestingController.expectOne('/api/test');
        requestCount++;
        req2.flush({ data: 'success' });

        await resultPromise;
    });

    it('should retry DELETE requests', async () => {
        let requestCount = 0;

        const resultPromise = new Promise<void>((resolve) => {
            httpClient.delete('/api/test/1').subscribe({
                next: () => {
                    expect(requestCount).toBe(2);
                    resolve();
                },
            });
        });

        const req1 = httpTestingController.expectOne('/api/test/1');
        requestCount++;
        req1.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        await new Promise(r => setTimeout(r, 50));
        const req2 = httpTestingController.expectOne('/api/test/1');
        requestCount++;
        req2.flush(null);

        await resultPromise;
    });

    it('should retry PUT requests', async () => {
        let requestCount = 0;

        const resultPromise = new Promise<void>((resolve) => {
            httpClient.put('/api/test/1', { data: 'update' }).subscribe({
                next: () => {
                    expect(requestCount).toBe(2);
                    resolve();
                },
            });
        });

        const req1 = httpTestingController.expectOne('/api/test/1');
        requestCount++;
        req1.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        await new Promise(r => setTimeout(r, 50));
        const req2 = httpTestingController.expectOne('/api/test/1');
        requestCount++;
        req2.flush({ data: 'updated' });

        await resultPromise;
    });

    it('should log retry attempts', async () => {
        const resultPromise = new Promise<void>((resolve) => {
            httpClient.get('/api/test').subscribe({
                next: () => resolve(),
            });
        });

        const req1 = httpTestingController.expectOne('/api/test');
        req1.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        await new Promise(r => setTimeout(r, 50));

        expect(loggerSpy.warn).toHaveBeenCalledWith(
            'Retrying request',
            'RetryInterceptor',
            expect.objectContaining({
                endpoint: '/api/test',
                method: 'GET',
            })
        );

        const req2 = httpTestingController.expectOne('/api/test');
        req2.flush({ data: 'success' });

        await resultPromise;
    });

    it('should record success after retry', async () => {
        const recordSuccessSpy = vi.spyOn(retryService, 'recordSuccess');

        const resultPromise = new Promise<void>((resolve) => {
            httpClient.get('/api/test').subscribe({
                next: () => {
                    // Verificar después de un pequeño delay para que se procese
                    setTimeout(() => {
                        expect(recordSuccessSpy).toHaveBeenCalledWith('/api/test', 'GET');
                        resolve();
                    }, 10);
                },
            });
        });

        const req1 = httpTestingController.expectOne('/api/test');
        req1.flush('Server Error', { status: 503, statusText: 'Service Unavailable' });

        await new Promise(r => setTimeout(r, 50));
        const req2 = httpTestingController.expectOne('/api/test');
        req2.flush({ data: 'success' });

        await resultPromise;
    });
});
