import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Bulletproof React import direction: shared -> features -> app.
// A feature never imports another feature or the app layer; routes in
// src/app compose features instead.
const noAppImports = { group: ['@/app/*', '@/app'], message: 'Only src/app may import the app layer.' };
const noFeatureImports = {
  group: ['@/features/*'],
  message: 'Features cannot import other features; compose them in src/app/routes instead.',
};

export default [
  { ignores: ['dist', '.tmp', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/features/**/*.{js,jsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noAppImports, noFeatureImports] }] },
  },
  {
    files: ['src/{components,hooks,lib,utils,config,stores}/**/*.{js,jsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [noAppImports, noFeatureImports] }] },
  },
  {
    files: ['vite.config.js', 'eslint.config.js', 'tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
];
