import crypto from "crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, lmsLearnersTable, lmsSessionsTable, type LmsLearner } from "../db";

export type UserRole = "student" | "lecturer" | "admin";
export const USER_ROLES: readonly UserRole[] = ["student", "lecturer", "admin"];

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

// ---------------------------------------------------------------------------
// Mật khẩu: scrypt (mặc định). Vẫn đọc được hash PBKDF2 cũ dạng "salt:hash"
// và nâng cấp lên scrypt ở lần đăng nhập thành công kế tiếp.
// ---------------------------------------------------------------------------
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

export function verifyPassword(password: string, stored?: string | null): boolean {
  if (!stored) return false;

  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, salt, hash] = stored.split("$");
    if (!n || !r || !p || !salt || !hash) return false;
    const derived = crypto.scryptSync(password, Buffer.from(salt, "hex"), hash.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return safeEqualHex(derived.toString("hex"), hash);
  }

  // Định dạng cũ: PBKDF2-SHA512, 1000 vòng, "salt:hash"
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return safeEqualHex(derived, hash);
}

export function needsRehash(stored?: string | null): boolean {
  return !stored?.startsWith("scrypt$");
}

// ---------------------------------------------------------------------------
// Định dạng dữ liệu người dùng trả về (không bao giờ chứa passwordHash)
// ---------------------------------------------------------------------------
export function getAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[parts.length - 2]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function getUserTitle(role: string): string {
  if (role === "admin") return "Quản trị viên hệ thống";
  if (role === "lecturer") return "Giảng viên phụ trách";
  return "Học viên";
}

export function normalizeRole(role: string | null | undefined): UserRole {
  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : "student";
}

/** Người dùng đã xác thực, gắn vào req.user */
export function toAuthUser(learner: LmsLearner) {
  const role = normalizeRole(learner.role);
  return {
    id: learner.id,
    name: learner.name,
    email: learner.email,
    role,
    team: learner.team,
    avatar: getAvatarInitials(learner.name),
    title: getUserTitle(role),
    points: learner.points,
    streak: learner.streak,
    progress: learner.progress,
    activeCourse: learner.activeCourse,
  };
}
export type AuthUser = ReturnType<typeof toAuthUser>;

/** Bản ghi học viên công khai cho danh sách (schema Learner) */
export function toPublicLearner(learner: LmsLearner) {
  return {
    id: learner.id,
    name: learner.name,
    email: learner.email,
    role: normalizeRole(learner.role),
    team: learner.team,
    points: learner.points,
    streak: learner.streak,
    progress: learner.progress,
    activeCourse: learner.activeCourse,
    lastActive: learner.lastActive,
  };
}

// ---------------------------------------------------------------------------
// Phiên đăng nhập
// ---------------------------------------------------------------------------
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.insert(lmsSessionsTable).values({ token, userId, expiresAt });
  return token;
}

export async function findUserBySessionToken(token: string): Promise<LmsLearner | null> {
  if (!token) return null;
  const now = new Date().toISOString();
  const rows = await db
    .select({ user: lmsLearnersTable })
    .from(lmsSessionsTable)
    .innerJoin(lmsLearnersTable, eq(lmsSessionsTable.userId, lmsLearnersTable.id))
    .where(and(eq(lmsSessionsTable.token, token), gt(lmsSessionsTable.expiresAt, now)))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(lmsSessionsTable).where(eq(lmsSessionsTable.token, token));
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await db.delete(lmsSessionsTable).where(eq(lmsSessionsTable.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(lmsSessionsTable).where(lte(lmsSessionsTable.expiresAt, new Date().toISOString()));
}

export function isDemoLoginEnabled(): boolean {
  return process.env.ENABLE_DEMO_LOGIN === "true";
}
