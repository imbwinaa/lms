import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ZodType, z } from "zod";
import { logger } from "./logger";

/** Lỗi HTTP có chủ đích — được errorHandler chuyển thành ErrorResponse */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message = "Vui lòng đăng nhập để tiếp tục.") => new HttpError(401, message);
export const forbidden = (message = "Bạn không có quyền thực hiện thao tác này.") => new HttpError(403, message);
export const notFound = (message = "Không tìm thấy dữ liệu yêu cầu.") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Kiểm tra dữ liệu bằng schema Zod sinh từ OpenAPI; ném 400 kèm danh sách lỗi */
export function parseOr400<S extends ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = issues[0];
    throw new HttpError(
      400,
      first ? `Dữ liệu không hợp lệ${first.path ? ` (${first.path})` : ""}: ${first.message}` : "Dữ liệu không hợp lệ.",
      issues,
    );
  }
  return result.data;
}

/** Chuẩn hóa thời gian lưu trong SQLite (ISO hoặc "YYYY-MM-DD HH:MM:SS") thành ISO 8601 */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Không tìm thấy endpoint." });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...(err.issues ? { issues: err.issues } : {}) });
    return;
  }
  // Lỗi do body-parser (JSON sai cú pháp / quá lớn)
  const status = typeof err?.status === "number" ? err.status : typeof err?.statusCode === "number" ? err.statusCode : 500;
  if (status === 413) {
    res.status(413).json({ message: "Tệp hoặc dữ liệu gửi lên quá lớn." });
    return;
  }
  if (status === 400 && err?.type === "entity.parse.failed") {
    res.status(400).json({ message: "Dữ liệu JSON không hợp lệ." });
    return;
  }
  (req.log ?? logger).error({ err }, "Unhandled error");
  res.status(500).json({ message: "Đã có lỗi xảy ra trên máy chủ. Vui lòng thử lại." });
};
