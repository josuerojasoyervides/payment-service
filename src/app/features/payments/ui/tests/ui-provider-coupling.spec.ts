import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Orchestration entry points: no provider-name branching; no provider identifiers in source. */
const FILES_NO_PROVIDER_IDENTIFIERS = [
  'src/app/features/payments/ui/components/next-action-card/next-action-card.component.ts',
  'src/app/features/payments/ui/components/next-action-card/next-action-card.component.html',
  'src/app/features/payments/ui/pages/checkout/checkout.page.ts',
  'src/app/features/payments/ui/pages/checkout/checkout.component.html',
  'src/app/features/payments/ui/pages/status/status.page.ts',
  'src/app/features/payments/ui/pages/status/status.component.html',
  'src/app/features/payments/ui/pages/return/return.page.ts',
  'src/app/features/payments/ui/pages/return/return.component.html',
  'src/app/features/payments/ui/pages/showcase/showcase.page.ts',
  'src/app/features/payments/ui/pages/showcase/showcase.component.html',
];

/** All UI entry points covered by guardrail. No infrastructure imports. */
const FILES_NO_INFRASTRUCTURE_IMPORT = [
  ...FILES_NO_PROVIDER_IDENTIFIERS,
  'src/app/features/payments/ui/components/payment-intent-card/payment-intent-card.component.ts',
  'src/app/features/payments/ui/components/payment-intent-card/payment-intent-card.component.html',
];

/** Provider names and provider-specific query keys; content is compared in lowercase. */
const BANNED_IDENTIFIERS = [
  'paypal',
  'stripe',
  'mercadopago',
  'payment_intent',
  'setup_intent',
  'payerid',
  'redirect_status',
];

describe('Payments UI provider coupling guard', () => {
  describe('orchestration entry points (no provider identifiers)', () => {
    for (const file of FILES_NO_PROVIDER_IDENTIFIERS) {
      it(`${file} does not include provider identifiers`, () => {
        const content = readFileSync(join(process.cwd(), file), 'utf8').toLowerCase();
        for (const token of BANNED_IDENTIFIERS) {
          expect(content).not.toContain(token);
        }
      });
    }
  });

  describe('all guarded UI files (no infrastructure import)', () => {
    for (const file of FILES_NO_INFRASTRUCTURE_IMPORT) {
      it(`${file} does not import from payments/infrastructure`, () => {
        const content = readFileSync(join(process.cwd(), file), 'utf8');
        expect(content).not.toMatch(/from\s+['"]@payments\/infrastructure/);
      });
    }
  });
});
