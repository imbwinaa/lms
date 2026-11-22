import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    // Một file DB SQLite cho mỗi lần chạy -> chạy tuần tự
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
