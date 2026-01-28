import type { WritableSignal } from '@angular/core';
import { signal } from '@angular/core';
import type { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { INITIAL_FALLBACK_STATE } from '@payments/domain/models/fallback/fallback-state.types';

export function createFallbackStateSignal(): WritableSignal<FallbackState> {
  return signal<FallbackState>(INITIAL_FALLBACK_STATE);
}
