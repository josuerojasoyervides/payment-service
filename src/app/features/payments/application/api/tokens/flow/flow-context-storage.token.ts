import { InjectionToken } from '@angular/core';
import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';

export const FLOW_CONTEXT_STORAGE = new InjectionToken<KeyValueStorage>('FLOW_CONTEXT_STORAGE');
