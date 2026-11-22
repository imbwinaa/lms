import { defineConfig } from "orval";

// Sinh mã client (React Query) và schema Zod cho server từ một nguồn duy nhất: docs/api-spec.yaml
// Chạy: pnpm codegen
export default defineConfig({
  client: {
    input: "./docs/api-spec.yaml",
    output: {
      mode: "split",
      target: "./client/src/api/generated/api.ts",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "/api",
      clean: true,
      override: {
        query: { version: 5 },
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: "./client/src/api/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
  server: {
    input: "./docs/api-spec.yaml",
    output: {
      mode: "single",
      target: "./server/src/schemas/generated/api.ts",
      schemas: "./server/src/schemas/generated/types",
      client: "zod",
      clean: true,
      override: {
        // req.params / req.query luôn là chuỗi -> ép kiểu số
        zod: { coerce: { param: true, query: true } },
      },
    },
  },
});
