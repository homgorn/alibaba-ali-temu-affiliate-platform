import { defineConfig } from 'vitest/config'

export default defineConfig({
  // `node:sqlite` is a Node BUILT-IN, not a package. Vitest's bundler tries to
  // resolve it as a file named "sqlite" and fails. Marking it external tells
  // the runtime to let Node load its own implementation, which is what we want
  // — we specifically chose the built-in over a native addon.
  ssr: {
    external: ['node:sqlite'],
  },
  test: {
    // SPEC-001 NFR-8 / FR-7: the engine starts and tests run with ZERO
    // credentials. No setup file loads .env, and none should.
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['verbose'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
  },
})
