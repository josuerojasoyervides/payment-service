// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const unusedImports = require('eslint-plugin-unused-imports');
const eslintConfigPrettier = require('eslint-config-prettier');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const ngrx = require('@ngrx/eslint-plugin/v9');
const importPlugin = require('eslint-plugin-import');

module.exports = defineConfig([
  // ✅ ignora basura
  {
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'node_modules/**', 'src/index.html'],
  },

  // ✅ TS (Angular)
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
      ...ngrx.configs.all,
    ],
    processor: angular.processInlineTemplates,

    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
    },

    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json'],
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      // ✅ selectors
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // ✅ deja que unused-imports controle todo lo unused (y borre imports con --fix)
      '@typescript-eslint/no-unused-vars': 'off',
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-assertions": "error",
      '@typescript-eslint/no-explicit-any': 'error',

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**'],
              message:
                'No uses imports relativos hacia parent (../..). Usa aliases tipo @core/*, @shared/*, @payments/*.',
            },
          ],
        },
      ],

      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },

  },

  // ✅ Runtime only: api/testing/** allowed only in specs (order: UI override must come after so it wins for UI files)
  {
    files: ['src/**/!(*.spec|*.test|*.harness).ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../**'], message: 'Use aliases @core/*, @shared/*, @payments/*.' },
            {
              group: ['**/application/api/testing/**'],
              message: 'application/api/testing/** may only be imported from *.spec.ts or *.test.ts.',
            },
          ],
        },
      ],
    },
  },

  // ✅ Payments UI: no orchestration, adapters, infra, config; no driver/registry/orchestrator (specs excluded so tests can import mocks/setup)
  {
    files: ['src/app/features/payments/ui/**/!(*.spec|*.test|*.harness).ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../**'], message: 'Use aliases @core/*, @shared/*, @payments/*.' },
            {
              group: [
                '**/application/orchestration/**',
                '**/application/adapters/**',
                '**/infrastructure/**',
                '**/config/**',
              ],
              message:
                'UI must not import orchestration, adapters, infrastructure, or config. Use PAYMENT_STATE (port) only.',
            },
            {
              group: [
                '**/payment-flow-machine-driver*',
                '**/provider-factory.registry*',
                '**/fallback-orchestrator.service*',
              ],
              message:
                'UI must not import PaymentFlowMachineDriver, ProviderFactoryRegistry, or FallbackOrchestratorService.',
            },
          ],
        },
      ],
    },
  },

  // ✅ TESTS relajados
  {
    files: ['**/*.spec.ts', '**/*.integration.spec.ts', '**/*.harness.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // ✅ Angular templates SOLO en src/app
  {
    files: ['src/app/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/no-any': 'error',
    },
  },

  eslintConfigPrettier,
]);
