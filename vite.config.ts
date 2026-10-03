/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  cacheDir: './node_modules/.vite',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    cache: false,
  },
});
