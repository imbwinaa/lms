import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureLmsSeeded } from "./lib/lms-seed";
import { isDemoLoginEnabled, purgeExpiredSessions } from "./lib/auth";

const port = Number(process.env["PORT"]) || 5000;

async function main() {
  await ensureLmsSeeded();
  await purgeExpiredSessions();
  setInterval(() => void purgeExpiredSessions().catch(() => {}), 6 * 60 * 60 * 1000).unref();

  if (isDemoLoginEnabled()) {
    logger.warn(
      process.env.NODE_ENV === "production"
        ? "ENABLE_DEMO_LOGIN=true trong môi trường production: bất kỳ ai cũng có thể đăng nhập tài khoản demo (kể cả admin)!"
        : "Đăng nhập demo đang bật (ENABLE_DEMO_LOGIN=true).",
    );
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info({ port }, `Server dang chay tai: http://localhost:${port}`);
    console.log(`\n======================================================`);
    console.log(`  HE THONG LMS (NEP HOC) - MAY CHU DU LIEU`);
    console.log(`  Dia chi API: http://localhost:${port}/api`);
    console.log(`  Kiem tra he thong: http://localhost:${port}/api/healthz`);
    console.log(`======================================================\n`);
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, "Không thể khởi động máy chủ");
  process.exit(1);
});
