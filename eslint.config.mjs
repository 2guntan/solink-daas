import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', 'storage/**', 'test-results/**', 'playwright-report/**', '**/next-env.d.ts', 'packages/db/prisma/migrations/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-control-regex': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'writable', process: 'readonly', console: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
