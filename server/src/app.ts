import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import fs from "fs";
import path from "path";
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

/**
 * Phục vụ giao diện React đã build (client/dist) từ cùng máy chủ — triển khai 1 service.
 * Đổi đường dẫn bằng CLIENT_DIST; bỏ qua nếu thư mục không tồn tại (VD: khi phát triển).
 */
const clientDist = path.resolve(process.env.CLIENT_DIST || path.join(process.cwd(), "..", "client", "dist"));
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
  // Mọi route còn lại của SPA (/, /courses/1, /login...) trả về index.html
  app.get(/^(?!\/(api|uploads)\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
  logger.info({ clientDist }, "Đang phục vụ giao diện frontend đã build");
}

app.use(errorHandler);

export default app;
