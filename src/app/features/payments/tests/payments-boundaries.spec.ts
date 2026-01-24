import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Payments boundaries guardrails', () => {
  const paymentsRoot = join(process.cwd(), 'src', 'app', 'features', 'payments');

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
        out.push(...walk(full));
        continue;
      }

      if (!entry.endsWith('.ts')) continue;
      if (entry.endsWith('.spec.ts')) continue;

      out.push(full);
    }

    return out;
  }

  function read(file: string) {
    return readFileSync(file, 'utf8');
  }

  function rel(file: string) {
    return relative(paymentsRoot, file);
  }

  function findForbiddenImports(content: string, forbiddenSegment: string): string[] {
    const matches: string[] = [];

    // import ... from '...'
    const reFrom = new RegExp(`\\bfrom\\s+['"][^'"]*${forbiddenSegment}[^'"]*['"]`, 'g');

    // dynamic import('...')
    const reDyn = new RegExp(`\\bimport\\(\\s*['"][^'"]*${forbiddenSegment}[^'"]*['"]\\s*\\)`, 'g');

    // export ... from '...'
    const reExport = new RegExp(
      `\\bexport\\s+\\*\\s+from\\s+['"][^'"]*${forbiddenSegment}[^'"]*['"]`,
      'g',
    );

    for (const re of [reFrom, reDyn, reExport]) {
      const found = content.match(re);
      if (found) matches.push(...found);
    }

    return matches;
  }

  const allFiles = walk(paymentsRoot);

  it('UI must not import Infrastructure', () => {
    const violations: string[] = [];

    const uiFiles = allFiles.filter((f) => rel(f).startsWith('ui/'));
    for (const file of uiFiles) {
      const content = read(file);
      const matches = [
        ...findForbiddenImports(content, '/infrastructure/'),
        ...findForbiddenImports(content, '@payments/infrastructure'),
      ];

      if (matches.length > 0) {
        violations.push(
          [`${rel(file)} imports infrastructure`, ...matches.map((m) => `  ↳ ${m}`)].join('\n'),
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('Application must not import Infrastructure', () => {
    const violations: string[] = [];

    const appFiles = allFiles.filter((f) => rel(f).startsWith('application/'));
    for (const file of appFiles) {
      const content = read(file);

      const matches = [
        ...findForbiddenImports(content, '/infrastructure/'),
        ...findForbiddenImports(content, '@payments/infrastructure'),
      ];

      if (matches.length > 0) {
        violations.push(
          [`${rel(file)} imports infrastructure`, ...matches.map((m) => `  ↳ ${m}`)].join('\n'),
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('Domain must be framework-free (no Angular/RxJS/HttpClient/i18n)', () => {
    const violations: string[] = [];

    const domainFiles = allFiles.filter((f) => rel(f).startsWith('domain/'));
    for (const file of domainFiles) {
      const content = read(file);

      const forbiddenTokens = ['@angular/', 'rxjs', 'HttpClient', 'inject(', 'i18n.t('];

      for (const token of forbiddenTokens) {
        if (content.includes(token)) {
          violations.push(`${rel(file)} contains forbidden token: ${token}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Infrastructure must not import UI', () => {
    const violations: string[] = [];

    const infraFiles = allFiles.filter((f) => rel(f).startsWith('infrastructure/'));

    for (const file of infraFiles) {
      const content = read(file);

      const matches = [
        ...findForbiddenImports(content, '/ui/'),
        ...findForbiddenImports(content, '@payments/ui'),
      ];
      if (matches.length > 0) {
        violations.push([`${rel(file)} imports ui`, ...matches.map((m) => `  ↳ ${m}`)].join('\n'));
      }
    }

    expect(violations).toEqual([]);
  });
});
