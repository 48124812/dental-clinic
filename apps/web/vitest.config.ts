import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    // 純函數測試用 node 就夠；之後測 React component 再改 jsdom + @testing-library
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
