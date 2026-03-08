import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vitest config for integration tests that require a live Ollama instance.
 * Run with: npm run test:integration
 *
 * These tests are intentionally excluded from the normal `npm test` suite
 * because they require external services and can take several minutes.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include:     ['src/**/*.integration.test.ts'],
    environment: 'node',
    globals:     true,

    // Individual model inference tests can take 2-5 minutes for large models.
    testTimeout: 360_000,
    hookTimeout:  30_000,

    reporters: ['verbose'],

    // Run tests sequentially — parallel inference on the same GPU causes
    // timeouts and unpredictable slowdowns.
    sequence: { shuffle: false },
  },
})
