import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/natively_test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-testing',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long-here',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.module.ts',
        'src/**/*.routes.ts',
        'src/main.ts',
        'src/config/env.ts',
        'src/database/prisma/client.ts',
        'src/providers/**/index.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@common': path.resolve(__dirname, './src/common'),
      '@config': path.resolve(__dirname, './src/config'),
      '@providers': path.resolve(__dirname, './src/providers'),
      '@services': path.resolve(__dirname, './src/services'),
      '@database': path.resolve(__dirname, './src/database'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
