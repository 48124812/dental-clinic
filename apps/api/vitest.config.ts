import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // globals: false 強制 import { describe, it, expect } — 比較明確、IDE 跳轉更準
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 顯示測試耗時
    reporters: ['default'],
  },
});
