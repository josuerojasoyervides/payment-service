export const NEXT_ACTION_KINDS = [
  'redirect',
  'client_confirm',
  'manual_step',
  'external_wait',
] as const;
export type NextActionKind = (typeof NEXT_ACTION_KINDS)[number];

/**
 * Provider-agnostic next step required to complete the payment flow.
 * UI can render by switching on `kind`.
 */
export type NextAction =
  | NextActionRedirect
  | NextActionClientConfirm
  | NextActionManualStep
  | NextActionExternalWait;

export interface NextActionRedirect {
  kind: 'redirect';
  url: string;
}

export interface NextActionManualStepDetails {
  bankCode: string;
  clabe: string;
  beneficiaryName: string;
  reference?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
}

export interface NextActionManualStep {
  kind: 'manual_step';
  instructions?: string[];
  details?: NextActionManualStepDetails;
}

export interface NextActionClientConfirm {
  kind: 'client_confirm';
  token: string;
  returnUrl?: string;
}

export interface NextActionExternalWait {
  kind: 'external_wait';
  hint?: string;
}
