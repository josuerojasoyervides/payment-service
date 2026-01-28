import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = [
  'src/app/features/payments/ui/components/next-action-card/next-action-card.component.ts',
  'src/app/features/payments/ui/components/next-action-card/next-action-card.component.html',
  'src/app/features/payments/ui/pages/checkout/checkout.page.ts',
  'src/app/features/payments/ui/pages/checkout/checkout.component.html',
];

const BANNED_IDENTIFIERS = ['paypal', 'stripe', 'mercadopago'];

describe('Payments UI provider coupling guard', () => {
  for (const file of FILES) {
    it(`does not include provider identifiers in ${file}`, () => {
      const content = readFileSync(join(process.cwd(), file), 'utf8').toLowerCase();
      for (const token of BANNED_IDENTIFIERS) {
        expect(content).not.toContain(token);
      }
    });
  }
});
