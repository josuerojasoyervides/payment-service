import { defer, Observable } from 'rxjs';

/**
 * Estándar del proyecto:
 * cualquier error sync dentro de fn debe caer dentro del Observable,
 * para evitar "Unhandled Error" y UI colgada.
 */
export function safeDefer<T>(fn: () => Observable<T>): Observable<T> {
    return defer(fn);
}