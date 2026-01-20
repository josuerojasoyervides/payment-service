import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { cacheInterceptor } from './cache.interceptor';
import { CacheService } from '../services/cache.service';
import { LoggerService } from '../services/logger.service';

describe('cacheInterceptor', () => {
    let httpClient: HttpClient;
    let httpTestingController: HttpTestingController;
    let cacheService: CacheService;
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
                provideHttpClient(withInterceptors([cacheInterceptor])),
                provideHttpClientTesting(),
                CacheService,
                { provide: LoggerService, useValue: loggerSpy },
            ],
        });

        httpClient = TestBed.inject(HttpClient);
        httpTestingController = TestBed.inject(HttpTestingController);
        cacheService = TestBed.inject(CacheService);
    });

    afterEach(() => {
        httpTestingController.verify();
        cacheService.clear();
    });

    describe('caching GET requests', () => {
        it('should cache GET response', () => {
            // First request
            httpClient.get('/api/test').subscribe(response => {
                expect(response).toEqual({ data: 'test' });
            });

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ data: 'test' });

            // Verify it was cached
            expect(cacheService.has('/api/test')).toBe(true);
        });

        it('should return cached response on second request', async () => {
            // First request
            await new Promise<void>(resolve => {
                httpClient.get('/api/test').subscribe(() => {
                    resolve();
                });

                const req = httpTestingController.expectOne('/api/test');
                req.flush({ data: 'test' });
            });

            // Second request should come from cache
            httpClient.get('/api/test').subscribe(response => {
                expect(response).toBeDefined();
            });

            // No new request should be made
            httpTestingController.expectNone('/api/test');
        });

        it('should add X-Cache: MISS header on first request', () => {
            httpClient.get('/api/test', { observe: 'response' }).subscribe(response => {
                expect(response.headers.get('X-Cache')).toBe('MISS');
            });

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ data: 'test' });
        });

        it('should add X-Cache: HIT header on cached request', async () => {
            // First request
            await new Promise<void>(resolve => {
                httpClient.get('/api/test').subscribe(() => {
                    resolve();
                });

                const req = httpTestingController.expectOne('/api/test');
                req.flush({ data: 'test' });
            });

            // Second request from cache
            httpClient.get('/api/test', { observe: 'response' }).subscribe(response => {
                expect(response.headers.get('X-Cache')).toBe('HIT');
            });

            httpTestingController.expectNone('/api/test');
        });
    });

    describe('non-cacheable requests', () => {
        it('should not cache POST requests', () => {
            httpClient.post('/api/test', { payload: 'data' }).subscribe();

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ success: true });

            expect(cacheService.has('/api/test')).toBe(false);
        });

        it('should not cache PUT requests', () => {
            httpClient.put('/api/test/1', { payload: 'data' }).subscribe();

            const req = httpTestingController.expectOne('/api/test/1');
            req.flush({ success: true });

            expect(cacheService.has('/api/test/1')).toBe(false);
        });

        it('should not cache DELETE requests', () => {
            httpClient.delete('/api/test/1').subscribe();

            const req = httpTestingController.expectOne('/api/test/1');
            req.flush({ success: true });

            expect(cacheService.has('/api/test/1')).toBe(false);
        });
    });

    describe('excluded URLs', () => {
        it('should not cache auth endpoints', () => {
            httpClient.get('/auth/user').subscribe();

            const req = httpTestingController.expectOne('/auth/user');
            req.flush({ user: 'test' });

            expect(cacheService.has('/auth/user')).toBe(false);
        });

        it('should not cache login endpoint', () => {
            httpClient.get('/login').subscribe();

            const req = httpTestingController.expectOne('/login');
            req.flush({ token: 'abc' });

            expect(cacheService.has('/login')).toBe(false);
        });
    });

    describe('Cache-Control header', () => {
        it('should skip caching when request has no-cache header', () => {
            httpClient.get('/api/test', {
                headers: { 'Cache-Control': 'no-cache' }
            }).subscribe();

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ data: 'test' });

            expect(cacheService.has('/api/test')).toBe(false);
        });

        it('should skip caching when response has no-cache header', () => {
            httpClient.get('/api/test').subscribe();

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ data: 'test' }, {
                headers: { 'Cache-Control': 'no-cache' }
            });

            expect(cacheService.has('/api/test')).toBe(false);
        });

        it('should skip caching when response has no-store header', () => {
            httpClient.get('/api/test').subscribe();

            const req = httpTestingController.expectOne('/api/test');
            req.flush({ data: 'test' }, {
                headers: { 'Cache-Control': 'no-store' }
            });

            expect(cacheService.has('/api/test')).toBe(false);
        });
    });

    describe('cache invalidation on mutations', () => {
        it('should invalidate cache when confirming payment intent', async () => {
            // First, cache the intent
            await new Promise<void>(resolve => {
                httpClient.get('/api/intents/pi_123').subscribe(() => {
                    resolve();
                });

                const getReq = httpTestingController.expectOne('/api/intents/pi_123');
                getReq.flush({ id: 'pi_123', status: 'requires_confirmation' });
            });

            expect(cacheService.has('/api/intents/pi_123')).toBe(true);

            // Now confirm the intent
            await new Promise<void>(resolve => {
                httpClient.post('/api/intents/pi_123/confirm', {}).subscribe(() => {
                    resolve();
                });

                const confirmReq = httpTestingController.expectOne('/api/intents/pi_123/confirm');
                confirmReq.flush({ status: 'succeeded' });
            });

            // Cache should be invalidated
            expect(cacheService.has('/api/intents/pi_123')).toBe(false);
        });

        it('should invalidate cache when canceling payment intent', async () => {
            // First, cache the intent
            await new Promise<void>(resolve => {
                httpClient.get('/api/intents/pi_456').subscribe(() => {
                    resolve();
                });

                const getReq = httpTestingController.expectOne('/api/intents/pi_456');
                getReq.flush({ id: 'pi_456', status: 'requires_confirmation' });
            });

            expect(cacheService.has('/api/intents/pi_456')).toBe(true);

            // Now cancel the intent
            await new Promise<void>(resolve => {
                httpClient.post('/api/intents/pi_456/cancel', {}).subscribe(() => {
                    resolve();
                });

                const cancelReq = httpTestingController.expectOne('/api/intents/pi_456/cancel');
                cancelReq.flush({ status: 'canceled' });
            });

            // Cache should be invalidated
            expect(cacheService.has('/api/intents/pi_456')).toBe(false);
        });

        it('should invalidate cache on PUT request', async () => {
            // First, cache the resource
            await new Promise<void>(resolve => {
                httpClient.get('/api/resources/1').subscribe(() => {
                    resolve();
                });

                const getReq = httpTestingController.expectOne('/api/resources/1');
                getReq.flush({ id: 1, name: 'original' });
            });

            expect(cacheService.has('/api/resources/1')).toBe(true);

            // Now update the resource
            await new Promise<void>(resolve => {
                httpClient.put('/api/resources/1', { name: 'updated' }).subscribe(() => {
                    resolve();
                });

                const putReq = httpTestingController.expectOne('/api/resources/1');
                putReq.flush({ id: 1, name: 'updated' });
            });

            // Cache should be invalidated
            expect(cacheService.has('/api/resources/1')).toBe(false);
        });

        it('should invalidate cache on DELETE request', async () => {
            // First, cache the resource
            await new Promise<void>(resolve => {
                httpClient.get('/api/resources/2').subscribe(() => {
                    resolve();
                });

                const getReq = httpTestingController.expectOne('/api/resources/2');
                getReq.flush({ id: 2, name: 'test' });
            });

            expect(cacheService.has('/api/resources/2')).toBe(true);

            // Now delete the resource
            await new Promise<void>(resolve => {
                httpClient.delete('/api/resources/2').subscribe(() => {
                    resolve();
                });

                const deleteReq = httpTestingController.expectOne('/api/resources/2');
                deleteReq.flush(null);
            });

            // Cache should be invalidated
            expect(cacheService.has('/api/resources/2')).toBe(false);
        });
    });

    describe('cache key generation with params', () => {
        it('should cache with query params in key', () => {
            httpClient.get('/api/test', { params: { page: '1', limit: '10' } }).subscribe();

            const req = httpTestingController.expectOne(r => r.url.includes('/api/test'));
            req.flush([]);

            // Key should include params
            expect(cacheService.has('/api/test?limit=10&page=1')).toBe(true);
        });

        it('should treat different params as different cache keys', () => {
            // First request with page=1
            httpClient.get('/api/data', { params: { page: '1' } }).subscribe();
            const req1 = httpTestingController.expectOne('/api/data?page=1');
            req1.flush(['data1']);

            // Second request with page=2 should not hit cache (different params)
            httpClient.get('/api/data', { params: { page: '2' } }).subscribe();
            const req2 = httpTestingController.expectOne('/api/data?page=2');
            req2.flush(['data2']);

            expect(cacheService.has('/api/data?page=1')).toBe(true);
            expect(cacheService.has('/api/data?page=2')).toBe(true);
        });
    });
});
