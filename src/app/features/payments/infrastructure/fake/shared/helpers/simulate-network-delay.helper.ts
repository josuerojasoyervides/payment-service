import type { Observable } from 'rxjs';
import { delay, of } from 'rxjs';

/**
 * Simulates realistic network delay.
 * Uses fixed delay for determinism in tests.
 */
export function simulateNetworkDelay<T>(data: T, customDelay?: number): Observable<T> {
  const delayMs = customDelay ?? 200; // Fixed delay for determinism
  return of(data).pipe(delay(delayMs));
}
