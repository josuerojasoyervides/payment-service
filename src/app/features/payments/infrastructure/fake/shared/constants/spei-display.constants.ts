import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';

/**
 * SPEI display constants for demo/fake and shared provider use.
 *
 * Used when instantiating SpeiStrategy from infrastructure (e.g. Stripe provider factory).
 * Keeps receiving bank names, beneficiary, and test CLABE out of shared/strategies.
 */
export const SPEI_DISPLAY_CONSTANTS: SpeiDisplayConfig = {
  receivingBanks: {
    STP: 'STP (Transfers and Payments System)',
  },
  beneficiaryName: 'Payment Service SA de CV',
};
