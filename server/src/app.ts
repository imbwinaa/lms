import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { uploadsDir } from "./routes/upload";
import { errorHandler } from "./lib/http";
import { logger } from "./lib/logger";

const app: Express = express();

// Render/Proxy: lấy IP thật của client cho giới hạn đăng nhập
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

/**
 * CORS: chỉ cho phép các origin trong CORS_ORIGIN (phân tách bằng dấu phẩy).
 * Không đặt biến -> chỉ cho phép localhost (phát triển).
 */
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // curl, cùng origin qua proxy
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (allowedOrigins.length === 0 && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
};
app.use(cors(corsOptions));

// 25 MB file -> ~34 MB base64
app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Tài nguyên tĩnh đã tải lên
app.use("/uploads", express.static(uploadsDir, { dotfiles: "deny", index: false }));

app.use("/api", router);
app.use(errorHandler);

export default app;
