import { signal, WritableSignal } from '@angular/core';
import {
  FallbackState,
  INITIAL_FALLBACK_STATE,
} from '@payments/domain/models/fallback/fallback-state.types';

export function createFallbackStateSignal(): WritableSignal<FallbackState> {
  return signal<FallbackState>(INITIAL_FALLBACK_STATE);
}
