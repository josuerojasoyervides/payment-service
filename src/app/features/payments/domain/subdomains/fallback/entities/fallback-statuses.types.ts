export const FALLBACK_STATUSES = [
  'idle',
  'pending',
  'executing',
  'auto_executing',
  'completed',
  'cancelled',
  'failed',
] as const;
export type FallbackStatus = (typeof FALLBACK_STATUSES)[number];
