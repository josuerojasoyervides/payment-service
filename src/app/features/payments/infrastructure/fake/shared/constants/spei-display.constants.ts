import type { SpeiDisplayConfig } from '@payments/presentation/contracts/spei-display-config.types';

/**
 * SPEI display constants for demo/fake and shared provider use.
 *
 * Used when instantiating SpeiStrategy from infrastructure (e.g. Stripe provider factory).
 * Keeps receiving bank names, beneficiary, and test CLABE out of shared/strategies.
 */
export const SPEI_DISPLAY_CONSTANTS: SpeiDisplayConfig = {
  receivingBanks: {
    stripe: 'STP (Transfers and Payments System)',
    conekta: 'STP (Transfers and Payments System)',
    openpay: 'BBVA Mexico',
  },
  beneficiaryName: 'Payment Service SA de CV',
  testClabe: '646180111812345678', // STP test CLABE
};
