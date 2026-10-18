import antfu from '@antfu/eslint-config';

// SaaS-Boilerplate's Antfu/React/Next.js checks, without service or Storybook plugins.
export default antfu({
  react: true,
  nextjs: true,
  typescript: true,
  lessOpinionated: true,
  isInEditor: false,
  stylistic: { semi: true },
  ignores: ['dev/shm/**', '.next/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts'],
}, {
  rules: {
    'react/prefer-destructuring-assignment': 'off',
    'react/exhaustive-deps': 'off',
    'node/prefer-global/process': 'off',
    'jsdoc/require-jsdoc': 'off',
    'jsdoc/require-returns': 'off',
  },
}, {
  files: ['tests/clerk-principal.test.ts'],
  // This suite intentionally uses Node's built-in runner (test:auth).
  rules: { 'test/no-import-node-test': 'off' },
}, {
  files: ['e2e/fixtures/*.mjs'],
  // Standalone Node harnesses use module-level await and JavaScript variable analysis.
  rules: {
    'antfu/no-top-level-await': 'off',
    'unused-imports/no-unused-vars': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
