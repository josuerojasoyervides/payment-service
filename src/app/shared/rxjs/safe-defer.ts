import type { Observable } from 'rxjs';
import { defer } from 'rxjs';

/**
 * Project standard:
 * any sync error inside fn must be captured by the Observable,
 * to avoid "Unhandled Error" and stuck UI.
 */
export function safeDefer<T>(fn: () => Observable<T>): Observable<T> {
  return defer(fn);
}
