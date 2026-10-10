import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['framework/**/*.{js,mjs}', 'scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
];
