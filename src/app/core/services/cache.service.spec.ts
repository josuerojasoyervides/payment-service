import { TestBed } from '@angular/core/testing';
import { CacheService, CACHE_CONFIG, CACHE_TTL_PATTERNS } from './cache.service';
import { LoggerService } from './logger.service';
import { TTLPattern } from '../models/cache.types';

describe('CacheService', () => {
    let service: CacheService;
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
                CacheService,
                { provide: LoggerService, useValue: loggerSpy },
            ],
        });

        service = TestBed.inject(CacheService);
    });

    afterEach(() => {
        service.clear();
    });

    describe('basic operations', () => {
        it('should set and get a value', () => {
            service.set('key1', { data: 'test' });
            
            const result = service.get<{ data: string }>('key1');
            
            expect(result).toBeDefined();
            expect(result!.hit).toBe(true);
            expect(result!.data.data).toBe('test');
        });

        it('should return undefined for non-existent key', () => {
            const result = service.get('non-existent');
            expect(result).toBeUndefined();
        });

        it('should return true for has() with existing key', () => {
            service.set('key1', 'value');
            expect(service.has('key1')).toBe(true);
        });

        it('should return false for has() with non-existent key', () => {
            expect(service.has('non-existent')).toBe(false);
        });

        it('should delete a key', () => {
            service.set('key1', 'value');
            
            const deleted = service.delete('key1');
            
            expect(deleted).toBe(true);
            expect(service.has('key1')).toBe(false);
        });

        it('should return false when deleting non-existent key', () => {
            const deleted = service.delete('non-existent');
            expect(deleted).toBe(false);
        });
    });

    describe('TTL', () => {
        it('should expire entries after TTL', async () => {
            service.set('key1', 'value', { ttl: 50 });
            
            expect(service.has('key1')).toBe(true);
            
            await new Promise(r => setTimeout(r, 100));
            expect(service.has('key1')).toBe(false);
        });

        it('should return remaining TTL', () => {
            service.set('key1', 'value', { ttl: 10000 });
            
            const result = service.get('key1');
            
            expect(result?.remainingTTL).toBeDefined();
            expect(result!.remainingTTL!).toBeGreaterThan(9000);
            expect(result!.remainingTTL!).toBeLessThanOrEqual(10000);
        });

        it('should use custom TTL when provided', () => {
            service.set('key1', 'value', { ttl: 5000 });
            
            const stats = service.getEntryStats('key1');
            
            expect(stats?.remainingTTL).toBeGreaterThan(4000);
            expect(stats?.remainingTTL).toBeLessThanOrEqual(5000);
        });
    });

    describe('LRU eviction', () => {
        let smallCacheService: CacheService;

        beforeEach(() => {
            // Create a new TestBed with small max entries
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                providers: [
                    CacheService,
                    { provide: LoggerService, useValue: loggerSpy },
                    { provide: CACHE_CONFIG, useValue: { maxEntries: 3 } },
                ],
            });
            smallCacheService = TestBed.inject(CacheService);
        });

        afterEach(() => {
            smallCacheService.clear();
        });

        it('should evict LRU entry when max entries reached', async () => {
            smallCacheService.set('key1', 'value1');
            await new Promise(r => setTimeout(r, 10)); // Small delay between sets
            smallCacheService.set('key2', 'value2');
            await new Promise(r => setTimeout(r, 10));
            smallCacheService.set('key3', 'value3');
            
            // Access key1 and key3 to make key2 the LRU
            smallCacheService.get('key1');
            smallCacheService.get('key3');
            
            // Adding key4 should evict key2 (LRU)
            smallCacheService.set('key4', 'value4');
            
            // Verify eviction happened (one entry should be gone)
            const keys = smallCacheService.keys();
            expect(keys.length).toBe(3);
            // key2 should be evicted as LRU
            expect(smallCacheService.has('key2')).toBe(false);
            expect(smallCacheService.has('key4')).toBe(true);
        });

        it('should evict expired entries first', async () => {
            smallCacheService.set('key1', 'value1', { ttl: 50 });
            smallCacheService.set('key2', 'value2', { ttl: 10000 });
            smallCacheService.set('key3', 'value3', { ttl: 10000 });
            
            // Wait for key1 to expire
            await new Promise(r => setTimeout(r, 100));

            // Adding key4 should evict expired key1, not LRU key2
            smallCacheService.set('key4', 'value4');
            
            expect(smallCacheService.has('key1')).toBe(false); // Expired, evicted
            expect(smallCacheService.has('key2')).toBe(true);
            expect(smallCacheService.has('key3')).toBe(true);
            expect(smallCacheService.has('key4')).toBe(true);
        });
    });

    describe('invalidation', () => {
        it('should invalidate by key', () => {
            service.set('key1', 'value1');
            service.set('key2', 'value2');
            
            const invalidated = service.invalidate('key1');
            
            expect(invalidated).toBe(true);
            expect(service.has('key1')).toBe(false);
            expect(service.has('key2')).toBe(true);
        });

        it('should invalidate by pattern', () => {
            service.set('/api/users/1', 'user1');
            service.set('/api/users/2', 'user2');
            service.set('/api/products/1', 'product1');
            
            const count = service.invalidatePattern(/\/api\/users\//);
            
            expect(count).toBe(2);
            expect(service.has('/api/users/1')).toBe(false);
            expect(service.has('/api/users/2')).toBe(false);
            expect(service.has('/api/products/1')).toBe(true);
        });

        it('should invalidate by tag', () => {
            service.set('key1', 'value1', { tags: ['userCache'] });
            service.set('key2', 'value2', { tags: ['userCache'] });
            service.set('key3', 'value3', { tags: ['productCache'] });
            
            const count = service.invalidateByTag('userCache');
            
            expect(count).toBe(2);
            expect(service.has('key1')).toBe(false);
            expect(service.has('key2')).toBe(false);
            expect(service.has('key3')).toBe(true);
        });
    });

    describe('statistics', () => {
        it('should track hits and misses', () => {
            service.set('key1', 'value1');
            
            service.get('key1'); // Hit
            service.get('key1'); // Hit
            service.get('non-existent'); // Miss
            
            const info = service.getInfo();
            
            expect(info.hits).toBe(2);
            expect(info.misses).toBe(1);
            expect(info.hitRatio).toBeCloseTo(2/3, 2);
        });

        it('should track entry stats', () => {
            service.set('key1', 'value1', { ttl: 10000 });
            service.get('key1');
            service.get('key1');
            
            const stats = service.getEntryStats('key1');
            
            expect(stats).toBeDefined();
            expect(stats!.accessCount).toBe(2);
            expect(stats!.isExpired).toBe(false);
        });

        it('should reset stats', () => {
            service.set('key1', 'value1');
            service.get('key1');
            service.get('key1');
            
            service.resetStats();
            const info = service.getInfo();
            
            expect(info.hits).toBe(0);
            expect(info.misses).toBe(0);
        });
    });

    describe('cleanup', () => {
        it('should remove expired entries on cleanup', async () => {
            service.set('key1', 'value1', { ttl: 50 });
            service.set('key2', 'value2', { ttl: 10000 });
            
            await new Promise(r => setTimeout(r, 100));

            const removed = service.cleanup();
            
            expect(removed).toBe(1);
            expect(service.has('key1')).toBe(false);
            expect(service.has('key2')).toBe(true);
        });
    });

    describe('key generation', () => {
        it('should generate key from URL only', () => {
            const key = service.generateKey('/api/users');
            expect(key).toBe('/api/users');
        });

        it('should generate key with sorted params', () => {
            const key = service.generateKey('/api/users', { limit: '10', offset: '0' });
            expect(key).toBe('/api/users?limit=10&offset=0');
        });

        it('should sort params alphabetically', () => {
            const key = service.generateKey('/api/users', { z: '1', a: '2' });
            expect(key).toBe('/api/users?a=2&z=1');
        });
    });

    describe('URL exclusion', () => {
        it('should identify excluded URLs', () => {
            expect(service.shouldExclude('/auth/login')).toBe(true);
            expect(service.shouldExclude('/api/users')).toBe(false);
        });
    });
});

describe('CacheService with custom TTL patterns', () => {
    let service: CacheService;
    let loggerSpy: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

    const customPatterns: TTLPattern[] = [
        { pattern: /\/fast\//, ttl: 1000, description: 'Fast expiry' },
        { pattern: /\/slow\//, ttl: 60000, description: 'Slow expiry' },
    ];

    beforeEach(() => {
        loggerSpy = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                CacheService,
                { provide: LoggerService, useValue: loggerSpy },
                { provide: CACHE_TTL_PATTERNS, useValue: customPatterns },
            ],
        });

        service = TestBed.inject(CacheService);
    });

    afterEach(() => {
        service.clear();
    });

    it('should use pattern-specific TTL', () => {
        service.set('/fast/resource', 'data');
        const fastStats = service.getEntryStats('/fast/resource');
        
        service.set('/slow/resource', 'data');
        const slowStats = service.getEntryStats('/slow/resource');
        
        // Fast should have lower remaining TTL
        expect(fastStats!.remainingTTL).toBeLessThan(slowStats!.remainingTTL);
    });

    it('should use default TTL for non-matching URLs', () => {
        service.set('/other/resource', 'data');
        const stats = service.getEntryStats('/other/resource');
        
        // Default TTL is 30000
        expect(stats!.remainingTTL).toBeGreaterThan(29000);
    });
});
