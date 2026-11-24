import { defineConfig } from 'vitest/config';

/** `npm run docs`: regenerates docs/reference.md from public/data (tests/docs.test.ts checks it is current). */
export default defineConfig({
  test: {
    include: ['tests/docs/**/*.report.ts'],
    environment: 'node',
    silent: false,
  },
});
