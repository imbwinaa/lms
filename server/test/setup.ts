import fs from "fs";
import os from "os";
import path from "path";

// PostgreSQL trong bộ nhớ (PGlite) cho mỗi file test, thư mục upload tạm, không gửi lên R2/Supabase
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lms-test-"));
delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory://";
process.env.UPLOADS_DIR = path.join(dir, "uploads");
process.env.LOG_LEVEL = "silent";
process.env.NODE_ENV = "test";
delete process.env.ENABLE_DEMO_LOGIN;
delete process.env.CORS_ORIGIN;
for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]) {
  delete process.env[key];
}
