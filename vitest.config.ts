import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'server/**/*.test.ts',
      'server/**/__tests__/**/*.ts',
      'client/src/**/*.test.{ts,tsx}',
      'shared/**/*.test.ts',
      'tests/**/*.test.ts',
      'tests/**/*.e2e.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.replit',
      'attached_assets'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        'dist/',
        'build/',
        'vite.config.ts',
        'vitest.config.ts',
        '*.config.{js,ts}',
        'server/vite.ts',
        'migrations/'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@server': path.resolve(__dirname, 'server'),
      '@tests': path.resolve(__dirname, 'tests'),
      // Force single copies so React hooks dispatcher is shared between test
      // files and transitive deps like @tanstack/react-query (there are two
      // installs: root node_modules and client/node_modules).
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query'),
    },
  },
});
