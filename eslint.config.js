import tseslint from 'typescript-eslint';

export default [
  { ignores: ['build/**', 'dist/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // This repository contains thin adapters around untyped Android/CLI JSON.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  }
];
