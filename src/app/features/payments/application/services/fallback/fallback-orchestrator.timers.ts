import { filter, Subject, takeUntil, timer } from 'rxjs';

export function scheduleAfterDelay(
  delayMs: number,
  cancel$: Subject<void>,
  canRun: () => boolean,
  run: () => void,
): void {
  timer(delayMs)
    .pipe(
      takeUntil(cancel$),
      filter(() => canRun()),
    )
    .subscribe(() => run());
}

export function scheduleTTL(
  ttlMs: number,
  cancel$: Subject<void>,
  isStillValid: () => boolean,
  onExpire: () => void,
): void {
  timer(ttlMs)
    .pipe(
      takeUntil(cancel$),
      filter(() => isStillValid()),
    )
    .subscribe(() => onExpire());
}
