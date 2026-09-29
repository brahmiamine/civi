// Lint: `npm run lint` (also run by the CI). Catches undefined names, unused variables and JSX mistakes.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

export default [
  { ignores: ['dist/**', 'dev-dist/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2024, sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
  { files: ['scripts/**', 'tests/**', 'vite.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node } } },
  { files: ['public/sw-reminders.js'], languageOptions: { globals: { ...globals.serviceworker } } },
];
