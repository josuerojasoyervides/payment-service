import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    retryWithBackoff,
    retryWithDefaultBackoff,
    retryOnStatus,
    retryOnServerError,
    retryOnRateLimit,
} from './retry-with-backoff.operator';
import { RetryExhaustedError } from '../models/retry.types';

describe('retryWithBackoff operator', () => {
    describe('retryWithBackoff', () => {
        it('should pass through successful observable', async () => {
            const result = await new Promise<string>((resolve) => {
                const source$ = new Observable<string>(subscriber => {
                    subscriber.next('success');
                    subscriber.complete();
                });

                source$.pipe(
                    retryWithBackoff({ maxRetries: 3 })
                ).subscribe({
                    next: (value) => resolve(value),
                });
            });

            expect(result).toBe('success');
        });

        it('should not retry non-HttpErrorResponse errors', async () => {
            const error = new Error('Regular error');
            let attempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    subscriber.error(error);
                });

                source$.pipe(
                    retryWithBackoff({ maxRetries: 3 })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toBe(error);

            expect(attempts).toBe(1);
        });

        it('should not retry 400 errors by default', async () => {
            const error = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
            let attempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    subscriber.error(error);
                });

                source$.pipe(
                    retryWithBackoff({ maxRetries: 3 })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toBe(error);

            expect(attempts).toBe(1);
        });

        it('should retry 503 errors', async () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            let attempts = 0;

            const result = await new Promise<string>((resolve, reject) => {
                const source$ = new Observable<string>(subscriber => {
                    attempts++;
                    if (attempts < 3) {
                        subscriber.error(error);
                    } else {
                        subscriber.next('success');
                        subscriber.complete();
                    }
                });

                source$.pipe(
                    retryWithBackoff({
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                    })
                ).subscribe({
                    next: resolve,
                    error: reject,
                });
            });

            expect(result).toBe('success');
            expect(attempts).toBe(3);
        });

        it('should throw RetryExhaustedError when max retries reached', async () => {
            const error = new HttpErrorResponse({
                status: 503,
                statusText: 'Service Unavailable',
                url: '/api/test',
            });
            let attempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    subscriber.error(error);
                });

                source$.pipe(
                    retryWithBackoff({
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                    })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toBeInstanceOf(RetryExhaustedError);

            expect(attempts).toBe(3);
        });

        it('should call onRetry callback', async () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            let attempts = 0;
            const retryCalls: number[] = [];

            await new Promise<void>((resolve) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    if (attempts < 3) {
                        subscriber.error(error);
                    } else {
                        subscriber.next('success');
                        subscriber.complete();
                    }
                });

                source$.pipe(
                    retryWithBackoff({
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                        onRetry: (attempt) => retryCalls.push(attempt),
                    })
                ).subscribe({
                    complete: resolve,
                });
            });

            expect(retryCalls).toEqual([1, 2]);
        });

        it('should call onExhausted callback when max retries reached', async () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            let exhaustedCalled = false;
            let exhaustedAttempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    subscriber.error(error);
                });

                source$.pipe(
                    retryWithBackoff({
                        maxRetries: 2,
                        initialDelay: 10,
                        jitterFactor: 0,
                        onExhausted: (attempts) => {
                            exhaustedCalled = true;
                            exhaustedAttempts = attempts;
                        },
                    })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toBeInstanceOf(RetryExhaustedError);

            expect(exhaustedCalled).toBe(true);
            expect(exhaustedAttempts).toBe(2);
        });

        it('should increase delay exponentially', async () => {
            const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
            let attempts = 0;
            const delays: number[] = [];

            await new Promise<void>((resolve) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    if (attempts < 4) {
                        subscriber.error(error);
                    } else {
                        subscriber.next('success');
                        subscriber.complete();
                    }
                });

                source$.pipe(
                    retryWithBackoff({
                        maxRetries: 5,
                        initialDelay: 100,
                        backoffMultiplier: 2,
                        jitterFactor: 0,
                        onRetry: (_, delay) => delays.push(delay),
                    })
                ).subscribe({
                    complete: resolve,
                });
            });

            expect(delays).toEqual([100, 200, 400]);
        });
    });

    describe('retryWithDefaultBackoff', () => {
        it('should use default configuration', async () => {
            const result = await new Promise<string>((resolve) => {
                const source$ = new Observable<string>(subscriber => {
                    subscriber.next('success');
                    subscriber.complete();
                });

                source$.pipe(
                    retryWithDefaultBackoff()
                ).subscribe({
                    next: resolve,
                });
            });

            expect(result).toBe('success');
        });
    });

    describe('retryOnStatus', () => {
        it('should only retry specified status codes', async () => {
            const error503 = new HttpErrorResponse({ status: 503 });
            const error500 = new HttpErrorResponse({ status: 500 });
            let attempt = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempt++;
                    if (attempt === 1) {
                        subscriber.error(error503);
                    } else {
                        subscriber.error(error500);
                    }
                });

                // Only retry 503, not 500
                source$.pipe(
                    retryOnStatus([503], {
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                    })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toMatchObject({ status: 500 });

            expect(attempt).toBe(2);
        });
    });

    describe('retryOnServerError', () => {
        it('should retry only 5xx errors', async () => {
            const error = new HttpErrorResponse({ status: 502 });
            let attempts = 0;

            await new Promise<void>((resolve) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    if (attempts < 2) {
                        subscriber.error(error);
                    } else {
                        subscriber.next('success');
                        subscriber.complete();
                    }
                });

                source$.pipe(
                    retryOnServerError({
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                    })
                ).subscribe({
                    complete: resolve,
                });
            });

            expect(attempts).toBe(2);
        });

        it('should not retry 400 errors', async () => {
            const error = new HttpErrorResponse({ status: 400 });
            let attempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    subscriber.error(error);
                });

                source$.pipe(
                    retryOnServerError({
                        maxRetries: 3,
                        initialDelay: 10,
                    })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toMatchObject({ status: 400 });

            expect(attempts).toBe(1);
        });
    });

    describe('retryOnRateLimit', () => {
        it('should retry 429 errors', async () => {
            const error = new HttpErrorResponse({ status: 429 });
            let attempts = 0;

            await new Promise<void>((resolve) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    if (attempts < 2) {
                        subscriber.error(error);
                    } else {
                        subscriber.next('success');
                        subscriber.complete();
                    }
                });

                source$.pipe(
                    retryOnRateLimit({
                        maxRetries: 3,
                        initialDelay: 10,
                        jitterFactor: 0,
                    })
                ).subscribe({
                    complete: resolve,
                });
            });

            expect(attempts).toBe(2);
        });

        it('should not retry 503 errors', async () => {
            const error = new HttpErrorResponse({ status: 503 });
            let attempts = 0;

            await expect(new Promise((_, reject) => {
                const source$ = new Observable(subscriber => {
                    attempts++;
                    subscriber.error(error);
                });

                source$.pipe(
                    retryOnRateLimit({
                        maxRetries: 3,
                        initialDelay: 10,
                    })
                ).subscribe({
                    error: reject,
                });
            })).rejects.toMatchObject({ status: 503 });

            expect(attempts).toBe(1);
        });
    });
});
