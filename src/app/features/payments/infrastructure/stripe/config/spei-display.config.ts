import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';

export const STRIPE_SPEI_DISPLAY_CONFIG: SpeiDisplayConfig = {
  receivingBanks: {
    STP: 'STP (Transfers and Payments System)',
  },
  beneficiaryName: 'Payment Service',
};
