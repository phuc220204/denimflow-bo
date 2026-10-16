import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/dist/', '**/coverage/', '.husky/_/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Engine purity (AGENTS.md hard rule 3): no framework, database or I/O imports.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', '@prisma/*', '@supabase/*'],
              message: 'packages/engine must stay framework- and database-free.',
            },
            {
              group: ['fs', 'fs/*', 'http', 'https', 'net', 'child_process', 'node:*'],
              message: 'packages/engine must not do I/O; receive data through parameters.',
            },
          ],
        },
      ],
    },
  },
  // Must stay last: turns off rules that conflict with Prettier formatting.
  prettier,
]);
