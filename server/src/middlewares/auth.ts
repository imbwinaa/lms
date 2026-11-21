import type { RequestHandler } from "express";
import { findUserBySessionToken, toAuthUser, type AuthUser, type UserRole } from "../lib/auth";
import { forbidden, unauthorized } from "../lib/http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

export function readBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Bắt buộc đăng nhập: gắn req.user hoặc trả 401 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readBearerToken(req.headers.authorization);
  if (!token) throw unauthorized();
  const learner = await findUserBySessionToken(token);
  if (!learner) throw unauthorized("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  req.user = toAuthUser(learner);
  req.sessionToken = token;
  next();
};

/** Chỉ cho phép các vai trò được liệt kê */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Lấy người dùng hiện tại trong handler (sau authenticate) */
export function currentUser(req: Express.Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
