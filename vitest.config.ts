import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // test-orbit (Part D) co-locates tests as <source>.test.ts next to their
    // source file, so the test-orbit tree is included alongside the repo's
    // existing __tests__/ directories.
    include: ['src/**/__tests__/**/*.test.ts', 'src/testorbit/**/*.test.ts'],
    environment: 'node',
  },
});
