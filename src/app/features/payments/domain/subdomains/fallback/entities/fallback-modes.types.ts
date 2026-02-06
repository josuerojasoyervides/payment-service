export const FALLBACK_MODES = ['manual', 'auto'] as const;
export type FallbackMode = (typeof FALLBACK_MODES)[number];
