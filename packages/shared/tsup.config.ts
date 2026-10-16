import { defineConfig } from 'tsup';

// Dual build: ESM for Vite (apps/web) and CJS for NestJS (apps/api).
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
