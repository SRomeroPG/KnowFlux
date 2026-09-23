import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
];
