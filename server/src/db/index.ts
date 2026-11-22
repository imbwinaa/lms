import path from "path";
import { fileURLToPath } from "url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Cơ sở dữ liệu PostgreSQL:
 *  - DATABASE_URL có giá trị (production, Supabase): kết nối qua driver `postgres`.
 *    Supabase: dùng chuỗi "Session pooler" hoặc "Transaction pooler" (IPv4) — host
 *    db.<ref>.supabase.co chỉ có IPv6, Render và nhiều mạng không kết nối được.
 *  - Không có DATABASE_URL (phát triển / kiểm thử): PGlite — PostgreSQL chạy ngay trong
 *    Node (WebAssembly), dữ liệu lưu ở PGLITE_DIR (mặc định ./.pglite, "memory://" = trong RAM).
 * Bảng được tạo/cập nhật bằng migration trong ./drizzle (xem migrateDatabase()).
 */
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

const databaseUrl = process.env.DATABASE_URL?.trim();

// Production phải có DATABASE_URL (PGLITE_DIR chỉ để chạy thử/kiểm thử chế độ production)
if (!databaseUrl && process.env.NODE_ENV === "production" && !process.env.PGLITE_DIR) {
  throw new Error(
    "Thiếu DATABASE_URL: production cần chuỗi kết nối PostgreSQL (Supabase → Connect → Session pooler).",
  );
}

type Database = PostgresJsDatabase<typeof schema>;

function isLocalHost(url: string) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

let client: postgres.Sql | null = null;
let pglite: PGlite | null = null;
let db: Database;

if (databaseUrl) {
  client = postgres(databaseUrl, {
    // Transaction pooler của Supabase (PgBouncer) không hỗ trợ prepared statements
    prepare: false,
    ssl: isLocalHost(databaseUrl) ? false : "require",
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    onnotice: () => {},
  });
  db = drizzlePostgres(client, { schema });
} else {
  const dataDir = process.env.PGLITE_DIR || path.resolve(process.cwd(), ".pglite");
  pglite = new PGlite(dataDir);
  // Cùng API truy vấn với postgres-js (đều là PgDatabase của Drizzle)
  db = drizzlePglite(pglite, { schema }) as unknown as Database;
}

export { db };

let migrated: Promise<void> | undefined;

/** Chạy các migration còn thiếu (một lần cho mỗi tiến trình) */
export function migrateDatabase(): Promise<void> {
  if (!migrated) {
    migrated = (
      client
        ? migratePostgres(db, { migrationsFolder: MIGRATIONS_FOLDER })
        : migratePglite(db as never, { migrationsFolder: MIGRATIONS_FOLDER })
    ).catch((error: unknown) => {
      migrated = undefined;
      throw error;
    });
  }
  return migrated;
}

/** Đóng kết nối (dùng khi tắt máy chủ / kết thúc script) */
export async function closeDatabase() {
  if (client) await client.end({ timeout: 5 });
  if (pglite) await pglite.close();
}

export const databaseKind = databaseUrl ? "postgres" : "pglite";

export * from "./schema";
