import { Router, type Request } from "express";
import { eq, sql } from "drizzle-orm";
import { db, lmsLearnersTable } from "../db";
import {
  createSession,
  deleteSession,
  hashPassword,
  isAccountLocked,
  isDemoLoginEnabled,
  needsRehash,
  toAuthUser,
  verifyPassword,
} from "../lib/auth";
import { HttpError, forbidden, notFound, parseOr400, unauthorized } from "../lib/http";
import { authenticate, currentUser } from "../middlewares/auth";
import { DemoLoginBody, LoginBody } from "../schemas";

const authRouter = Router();

const LOCKED_MESSAGE = "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";

// ---------------------------------------------------------------------------
// Giới hạn số lần đăng nhập sai (bộ nhớ trong, theo IP + email)
// ---------------------------------------------------------------------------
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function loginKey(req: Request, email: string) {
  return `${req.ip ?? "unknown"}|${email}`;
}

function assertNotRateLimited(key: string) {
  const entry = loginFailures.get(key);
  if (entry && entry.resetAt > Date.now() && entry.count >= LOGIN_MAX_FAILURES) {
    throw new HttpError(429, "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
  }
}

function recordFailure(key: string) {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
  if (loginFailures.size > 10_000) {
    for (const [k, v] of loginFailures) if (v.resetAt <= now) loginFailures.delete(k);
  }
}

/** Chỉ dùng trong kiểm thử */
export function resetLoginRateLimit() {
  loginFailures.clear();
}

// ---------------------------------------------------------------------------

authRouter.get("/config", (_req, res) => {
  res.json({ demoLoginEnabled: isDemoLoginEnabled() });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = parseOr400(LoginBody, req.body);
  const normalizedEmail = email.trim().toLowerCase();
  const key = loginKey(req, normalizedEmail);
  assertNotRateLimited(key);

  const [user] = await db
    .select()
    .from(lmsLearnersTable)
    .where(sql`lower(${lmsLearnersTable.email}) = ${normalizedEmail}`)
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordFailure(key);
    throw unauthorized("Email hoặc mật khẩu không chính xác.");
  }
  loginFailures.delete(key);
  if (isAccountLocked(user)) throw forbidden(LOCKED_MESSAGE);

  await db
    .update(lmsLearnersTable)
    .set({
      lastActive: "Vừa hoạt động",
      ...(needsRehash(user.passwordHash) ? { passwordHash: hashPassword(password) } : {}),
    })
    .where(eq(lmsLearnersTable.id, user.id));

  const token = await createSession(user.id);
  res.json({ message: "Đăng nhập thành công", token, user: toAuthUser(user) });
});

// Đăng nhập nhanh tài khoản demo — chỉ khi ENABLE_DEMO_LOGIN=true
authRouter.post("/demo-login", async (req, res) => {
  if (!isDemoLoginEnabled()) throw notFound("Không tìm thấy endpoint.");
  const { role } = parseOr400(DemoLoginBody, req.body);

  const demoEmail = role === "admin" ? "ngan.bui@nova.vn" : role === "lecturer" ? "bui.ngan@nova.vn" : "ngann@nova.vn";
  let [user] = await db
    .select()
    .from(lmsLearnersTable)
    .where(sql`lower(${lmsLearnersTable.email}) = ${demoEmail}`)
    .limit(1);
  if (!user) {
    [user] = await db.select().from(lmsLearnersTable).where(eq(lmsLearnersTable.role, role)).limit(1);
  }
  if (!user) throw notFound(`Không tìm thấy tài khoản demo cho vai trò ${role}.`);
  if (isAccountLocked(user)) throw forbidden(LOCKED_MESSAGE);

  const token = await createSession(user.id);
  res.json({ message: `Đã chuyển sang tài khoản ${user.name}`, token, user: toAuthUser(user) });
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json(currentUser(req));
});

authRouter.post("/logout", authenticate, async (req, res) => {
  if (req.sessionToken) await deleteSession(req.sessionToken);
  res.json({ message: "Đăng xuất thành công." });
});

export default authRouter;
