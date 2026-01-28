// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const unusedImports = require('eslint-plugin-unused-imports');
const eslintConfigPrettier = require('eslint-config-prettier');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const ngrx = require('@ngrx/eslint-plugin/v9');

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
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
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

  // ✅ infra fake: se permite any
  {
    files: ['src/app/features/**/infrastructure/fake/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ✅ core testing helpers: se permite any
  {
    files: ['src/app/core/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ✅ TESTS relajados
  {
    files: ['**/*.spec.ts', '**/*.integration.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // ✅ Angular templates SOLO en src/app
  {
    files: ['src/app/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },

  eslintConfigPrettier,
]);
