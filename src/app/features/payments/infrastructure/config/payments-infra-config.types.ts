export type PaypalLandingPage = 'LOGIN' | 'BILLING' | 'NO_PREFERENCE';
export type PaypalUserAction = 'PAY_NOW' | 'CONTINUE';

export interface PaypalAppContextDefaults {
  brand_name: string;
  landing_page: PaypalLandingPage;
  user_action: PaypalUserAction;
}

export interface SpeiDisplayConfig {
  receivingBanks: Record<string, string>;
  beneficiaryName: string;
}

export interface PaymentsInfraConfig {
  paymentsBackendBaseUrl: string;
  stripe: {
    baseUrl: string;
    timeoutMs: number;
  };
  paypal: {
    baseUrl: string;
    timeoutMs: number;
    defaults: PaypalAppContextDefaults;
  };
  spei: {
    displayConfig: SpeiDisplayConfig;
  };
}

export interface PaymentsInfraConfigInput {
  paymentsBackendBaseUrl: string;
  timeouts: {
    stripeMs: number;
    paypalMs: number;
  };
  paypal: {
    defaults: PaypalAppContextDefaults;
  };
  spei: {
    displayConfig: SpeiDisplayConfig;
  };
}
