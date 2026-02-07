import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';
import { z } from 'zod';

export const PaypalLandingPageSchema = z.enum(['LOGIN', 'BILLING', 'NO_PREFERENCE']);
export type PaypalLandingPage = z.infer<typeof PaypalLandingPageSchema>;

export const PaypalUserActionSchema = z.enum(['PAY_NOW', 'CONTINUE']);
export type PaypalUserAction = z.infer<typeof PaypalUserActionSchema>;

export interface PaypalAppContextDefaults {
  brand_name: string;
  landing_page: PaypalLandingPage;
  user_action: PaypalUserAction;
}

export const PaypalAppContextDefaultsSchema = z.object({
  brand_name: z.string().trim().min(1),
  landing_page: PaypalLandingPageSchema,
  user_action: PaypalUserActionSchema,
});

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

const SpeiDisplayConfigSchema = z
  .object({
    receivingBanks: z.record(z.string(), z.string().min(1)),
    beneficiaryName: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    const entries = Object.entries(value.receivingBanks);
    if (entries.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receivingBanks'],
        message: 'receivingBanks must be non-empty',
      });
    }
    for (const [code, name] of entries) {
      const bankName = String(name);
      if (!code.trim() || !bankName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['receivingBanks'],
          message: 'receivingBanks entries must be non-empty',
        });
        break;
      }
    }
  });

export const PaymentsInfraConfigInputSchema = z.object({
  paymentsBackendBaseUrl: z.string().trim().min(1),
  timeouts: z.object({
    stripeMs: z.number().positive(),
    paypalMs: z.number().positive(),
  }),
  paypal: z.object({
    defaults: PaypalAppContextDefaultsSchema,
  }),
  spei: z.object({
    displayConfig: SpeiDisplayConfigSchema,
  }),
});
