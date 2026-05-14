import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/integration/**/*.test.ts'],
    setupFiles: ['src/lib/__tests__/integration/setup.ts'],
    testTimeout: 30000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
