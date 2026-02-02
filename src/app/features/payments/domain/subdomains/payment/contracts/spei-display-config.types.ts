/**
 * Configuration for SPEI manual-step display (bank names, beneficiary, fallback CLABE).
 *
 * Provided by infrastructure when instantiating SpeiStrategy; keeps shared/ free of
 * provider-specific or environment-specific copy and test data.
 */
export interface SpeiDisplayConfig {
  /** Map provider id -> receiving bank display name (e.g. stripe -> 'STP (Transfers and Payments System)'). */
  receivingBanks: Record<string, string>;
  /** Beneficiary name shown in SPEI transfer details. */
  beneficiaryName: string;
  /** Fallback CLABE when gateway does not return one (e.g. test/demo). */
  testClabe: string;
}
