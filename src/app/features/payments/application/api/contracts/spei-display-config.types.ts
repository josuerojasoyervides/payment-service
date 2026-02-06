/**
 * SPEI display configuration.
 *
 * Source of truth lives in Application so Infra and UI can depend on it
 * without crossing boundaries.
 */
export type BankCode = string;

export interface SpeiDisplayConfig {
  /** Map bank code -> receiving bank display name. */
  receivingBanks: Record<BankCode, string>;
  /** Beneficiary name shown in SPEI transfer details. */
  beneficiaryName: string;
}
