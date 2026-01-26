import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Payments i18n architecture rules', () => {
  // ✅ Always point to the payments module from repo root
  const paymentsRoot = join(process.cwd(), 'src', 'app', 'features', 'payments');

  // 🔒 Real safety check (no heuristics)
  if (!existsSync(paymentsRoot)) {
    throw new Error(`paymentsRoot does not exist: ${paymentsRoot}`);
  }

  function walk(dir: string): string[] {
    const entries = readdirSync(dir);
    const out: string[] = [];

    for (const entry of entries) {
      const full = join(dir, entry);
      const st = statSync(full);

      if (st.isDirectory()) {
        // UI is the only allowed translation layer
        if (entry === 'ui') continue;
        out.push(...walk(full));
        continue;
      }

      if (!entry.endsWith('.ts')) continue;
      if (entry.endsWith('.spec.ts')) continue;

      out.push(full);
    }

    return out;
  }

  it('must not translate (i18n.t) outside UI', () => {
    const files = walk(paymentsRoot);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');

      if (/\bi18n\.t\(/.test(content)) {
        violations.push(`${relative(paymentsRoot, file)} contains i18n.t(`);
      }

      if (/\bI18nService\b/.test(content)) {
        violations.push(`${relative(paymentsRoot, file)} references I18nService`);
      }

      if (/messageKey\s*:\s*.*\.t\(/.test(content)) {
        violations.push(`${relative(paymentsRoot, file)} sets messageKey to a translation`);
      }
    }

    expect(violations).toEqual([]);
  });
});
