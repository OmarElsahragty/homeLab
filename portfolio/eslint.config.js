import nextConfig from 'eslint-config-next/core-web-vitals';
import tsEslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const config = [
  { ignores: ['dist', 'node_modules', '.next'] },
  ...nextConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tsEslint.plugin,
      prettier: prettierPlugin,
    },
    rules: {
      // ── Prettier integration ──────────────────────────────────────────────
      'prettier/prettier': 'error',

      // ── TypeScript ────────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': false,
        },
      ],

      // ── Security ──────────────────────────────────────────────────────────
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-throw-literal': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',

      // ── Quality ───────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'no-alert': 'warn',
      'prefer-template': 'warn',
      'prefer-arrow-callback': 'warn',
      'object-shorthand': 'warn',
      'no-useless-concat': 'warn',
      'no-useless-return': 'warn',
      'no-return-await': 'warn',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'quote-props': ['warn', 'as-needed'],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'max-depth': ['warn', 5],
      'max-nested-callbacks': ['warn', 5],
    },
  },
  // Must be last — disables formatting rules that conflict with prettier
  prettierConfig,
];

export default config;
