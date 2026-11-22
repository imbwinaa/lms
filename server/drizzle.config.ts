import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Migration SQL được sinh vào ./drizzle (pnpm --filter server db:generate)
 * và tự chạy khi máy chủ khởi động. db:push/db:studio cần DATABASE_URL (Supabase).
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
