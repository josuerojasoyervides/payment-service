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
  const allowedMessageKeyPrefixes = ['errors.', 'ui.', 'messages.'];

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

  it('i18n.t must be used only in UI layer', () => {
    const violations: string[] = [];

    for (const file of allFiles) {
      const relPath = rel(file);
      if (relPath.startsWith('ui/')) continue;

      const content = read(file);
      if (content.includes('i18n.t(')) {
        violations.push(`${relPath} contains i18n.t(`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('messageKey must not be assigned from i18n.t()', () => {
    const violations: string[] = [];
    const re = /messageKey\s*:\s*[^,\n]*i18n\.t\s*\(/g;

    for (const file of allFiles) {
      const content = read(file);
      const matches = content.match(re);
      if (matches && matches.length > 0) {
        violations.push(
          [`${rel(file)} uses i18n.t() for messageKey`, ...matches.map((m) => `  ↳ ${m}`)].join(
            '\n',
          ),
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('messageKey string literals must look like i18n keys', () => {
    const violations: string[] = [];
    const re = /messageKey\s*:\s*['"]([^'"]+)['"]/g;

    for (const file of allFiles) {
      const content = read(file);
      let match: RegExpExecArray | null;

      while ((match = re.exec(content))) {
        const value = match[1];
        const okPrefix = allowedMessageKeyPrefixes.some((prefix) => value.startsWith(prefix));
        const okFormat = value.includes('.') && !value.includes(' ');

        if (!okPrefix || !okFormat) {
          violations.push(`${rel(file)} has invalid messageKey literal: "${value}"`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
