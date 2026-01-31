import type { WritableSignal } from '@angular/core';
import { signal } from '@angular/core';
import type { FallbackState } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.types';
import { INITIAL_FALLBACK_STATE } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.types';

export function createFallbackStateSignal(): WritableSignal<FallbackState> {
  return signal<FallbackState>(INITIAL_FALLBACK_STATE);
}
