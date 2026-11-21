import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"]) || 5000;

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, `Server dang chay tai: http://localhost:${port}`);
  console.log(`\n======================================================`);
  console.log(`  HE THONG LMS (NEP HOC) - MAY CHU DU LIEU`);
  console.log(`  Dia chi API: http://localhost:${port}/api`);
  console.log(`  Kiem tra he thong: http://localhost:${port}/api/healthz`);
  console.log(`======================================================\n`);
});
