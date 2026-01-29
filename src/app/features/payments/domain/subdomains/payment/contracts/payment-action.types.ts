export type NextAction =
  | NextActionRedirect
  | NextActionClientConfirm
  | NextActionManualStep
  | NextActionExternalWait;

/**
 * Generic redirect to an external URL.
 */
export interface NextActionRedirect {
  kind: 'redirect';
  url: string;
}

/**
 * Manual, user-driven step (e.g., offline transfer).
 */
export interface NextActionManualStepDetail {
  label: string;
  value: string;
}

export interface NextActionManualStep {
  kind: 'manual_step';
  instructions: string[];
  details?: NextActionManualStepDetail[];
}

/**
 * Client-side confirmation step (e.g., SDK confirmation).
 */
export interface NextActionClientConfirm {
  kind: 'client_confirm';
  token: string;
  returnUrl?: string;
}

/**
 * External system is processing; user waits.
 */
export interface NextActionExternalWait {
  kind: 'external_wait';
  hint?: string;
}
