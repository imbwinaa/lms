import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { db, lmsActivitiesTable, lmsCoursesTable, lmsLearnersTable, lmsSessionsTable, type LmsLearner } from "../db";
import { hashPassword, toPublicLearner } from "../lib/auth";
import { badRequest, conflict, notFound, parseOr400 } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import {
  CreateLmsAccountBody,
  DeleteLmsAccountParams,
  ResetLmsAccountPasswordBody,
  ResetLmsAccountPasswordParams,
  UpdateLmsAccountBody,
  UpdateLmsAccountParams,
  UpdateLmsAccountRoleBody,
  UpdateLmsAccountRoleParams,
  UpdateLmsAccountStatusBody,
  UpdateLmsAccountStatusParams,
} from "../schemas";

const router = Router();

const roleLabel = (role: string) => (role === "admin" ? "Quản trị viên" : role === "lecturer" ? "Giảng viên" : "Học viên");

async function findAccount(id: number): Promise<LmsLearner> {
  const [target] = await db.select().from(lmsLearnersTable).where(eq(lmsLearnersTable.id, id)).limit(1);
  if (!target) throw notFound("Không tìm thấy tài khoản.");
  return target;
}

async function emailTaken(email: string, exceptId?: number) {
  const sameEmail = sql`lower(${lmsLearnersTable.email}) = ${email}`;
  const [existing] = await db
    .select({ id: lmsLearnersTable.id })
    .from(lmsLearnersTable)
    .where(exceptId === undefined ? sameEmail : and(sameEmail, ne(lmsLearnersTable.id, exceptId)))
    .limit(1);
  return !!existing;
}

/** Hệ thống luôn cần ít nhất một quản trị viên đang hoạt động (ngoài tài khoản đang bị thay đổi) */
async function assertAnotherActiveAdmin(target: LmsLearner) {
  if (target.role !== "admin") return;
  const [admins] = await db
    .select({ value: count() })
    .from(lmsLearnersTable)
    .where(
      and(eq(lmsLearnersTable.role, "admin"), ne(lmsLearnersTable.status, "locked"), ne(lmsLearnersTable.id, target.id)),
    );
  if (Number(admins?.value ?? 0) === 0) throw badRequest("Hệ thống cần ít nhất một quản trị viên đang hoạt động.");
}

async function logActivity(title: string, detail: string) {
  await db.insert(lmsActivitiesTable).values({ title, detail, time: "Vừa xong", kind: "enrollment" });
}

// Admin thấy tất cả; giảng viên chỉ thấy học viên (để theo dõi & ghi danh)
router.get("/lms/accounts", requireRole("admin", "lecturer"), async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select()
    .from(lmsLearnersTable)
    .where(user.role === "admin" ? undefined : eq(lmsLearnersTable.role, "student"))
    .orderBy(desc(lmsLearnersTable.points));
  res.json(rows.map(toPublicLearner));
});

// Admin cấp tài khoản mới (không còn tự đăng ký công khai)
router.post("/lms/accounts", requireRole("admin"), async (req, res) => {
  const body = parseOr400(CreateLmsAccountBody, req.body);
  const email = body.email.trim().toLowerCase();
  if (await emailTaken(email)) throw conflict("Email này đã có tài khoản.");

  const team =
    body.team?.trim() ||
    (body.role === "admin" ? "Ban Giám Hiệu" : body.role === "lecturer" ? "Tổ Sư Phạm & Đào Tạo" : "Chưa xếp lớp");

  const [created] = await db
    .insert(lmsLearnersTable)
    .values({
      name: body.name.trim(),
      email,
      passwordHash: hashPassword(body.password),
      role: body.role,
      status: "active",
      team,
      points: 0,
      streak: 0,
      progress: 0,
      activeCourse: "Chưa ghi danh",
      lastActive: "Chưa hoạt động",
    })
    .returning();

  await logActivity(`Tài khoản mới: ${created!.name}`, `Vai trò: ${roleLabel(body.role)}`);
  res.status(201).json(toPublicLearner(created!));
});

// Cập nhật thông tin cơ bản: họ tên, email, lớp/phòng ban
router.patch("/lms/accounts/:id", requireRole("admin"), async (req, res) => {
  const { id } = parseOr400(UpdateLmsAccountParams, req.params);
  const body = parseOr400(UpdateLmsAccountBody, req.body);
  const target = await findAccount(id);

  const changes: Partial<Pick<LmsLearner, "name" | "email" | "team">> = {};
  if (body.name !== undefined) changes.name = body.name.trim();
  if (body.team !== undefined) changes.team = body.team.trim();
  if (changes.name !== undefined && changes.name.length < 2) throw badRequest("Họ tên cần tối thiểu 2 ký tự.");
  if (changes.team !== undefined && !changes.team) throw badRequest("Lớp / phòng ban không được để trống.");
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (await emailTaken(email, id)) throw conflict("Email này đã có tài khoản.");
    changes.email = email;
  }
  if (!Object.keys(changes).length) throw badRequest("Không có thông tin nào để cập nhật.");

  const [updated] = await db.update(lmsLearnersTable).set(changes).where(eq(lmsLearnersTable.id, id)).returning();
  await logActivity(
    `Cập nhật tài khoản: ${updated!.name}`,
    target.name !== updated!.name ? `Tên cũ: ${target.name}` : "Thông tin hồ sơ",
  );
  res.json(toPublicLearner(updated!));
});

router.patch("/lms/accounts/:id/role", requireRole("admin"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateLmsAccountRoleParams, req.params);
  const { role } = parseOr400(UpdateLmsAccountRoleBody, req.body);
  const target = await findAccount(id);

  if (target.id === user.id && role !== target.role) {
    throw badRequest("Bạn không thể tự thay đổi vai trò của chính mình.");
  }
  if (role !== "admin") await assertAnotherActiveAdmin(target);

  const [updated] = await db.update(lmsLearnersTable).set({ role }).where(eq(lmsLearnersTable.id, id)).returning();

  // Không còn là giảng viên/admin -> bỏ quyền sở hữu khóa học
  if (role === "student") {
    await db.update(lmsCoursesTable).set({ instructorId: null }).where(eq(lmsCoursesTable.instructorId, id));
  }

  await logActivity(`Phân quyền người dùng: ${updated!.name}`, `Vai trò mới: ${roleLabel(role)}`);
  res.json(toPublicLearner(updated!));
});

// Khóa / mở khóa. Khóa sẽ đăng xuất người dùng khỏi mọi thiết bị.
router.patch("/lms/accounts/:id/status", requireRole("admin"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateLmsAccountStatusParams, req.params);
  const { status } = parseOr400(UpdateLmsAccountStatusBody, req.body);
  const target = await findAccount(id);

  if (status === "locked") {
    if (target.id === user.id) throw badRequest("Bạn không thể tự khóa tài khoản của chính mình.");
    await assertAnotherActiveAdmin(target);
  }

  const [updated] = await db.update(lmsLearnersTable).set({ status }).where(eq(lmsLearnersTable.id, id)).returning();
  if (status === "locked") {
    await db.delete(lmsSessionsTable).where(eq(lmsSessionsTable.userId, id));
  }

  await logActivity(
    `${status === "locked" ? "Khóa" : "Mở khóa"} tài khoản: ${updated!.name}`,
    `Vai trò: ${roleLabel(updated!.role)}`,
  );
  res.json(toPublicLearner(updated!));
});

// Đặt lại mật khẩu; mọi phiên đăng nhập khác của tài khoản bị thu hồi
router.put("/lms/accounts/:id/password", requireRole("admin"), async (req, res) => {
  const { id } = parseOr400(ResetLmsAccountPasswordParams, req.params);
  const { password } = parseOr400(ResetLmsAccountPasswordBody, req.body);
  const target = await findAccount(id);

  await db.update(lmsLearnersTable).set({ passwordHash: hashPassword(password) }).where(eq(lmsLearnersTable.id, id));
  await db
    .delete(lmsSessionsTable)
    .where(
      req.sessionToken
        ? and(eq(lmsSessionsTable.userId, id), ne(lmsSessionsTable.token, req.sessionToken))
        : eq(lmsSessionsTable.userId, id),
    );

  await logActivity(`Đặt lại mật khẩu: ${target.name}`, "Các phiên đăng nhập cũ đã bị thu hồi");
  res.json({ message: `Đã đặt lại mật khẩu cho ${target.name}.` });
});

// Xóa vĩnh viễn: ghi danh, bài nộp, huy hiệu, phiên đăng nhập bị xóa theo (ON DELETE CASCADE)
router.delete("/lms/accounts/:id", requireRole("admin"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteLmsAccountParams, req.params);
  const target = await findAccount(id);

  if (target.id === user.id) throw badRequest("Bạn không thể tự xóa tài khoản của chính mình.");
  await assertAnotherActiveAdmin(target);

  await db.update(lmsCoursesTable).set({ instructorId: null }).where(eq(lmsCoursesTable.instructorId, id));
  await db.delete(lmsLearnersTable).where(eq(lmsLearnersTable.id, id));

  await logActivity(`Xóa tài khoản: ${target.name}`, `Vai trò: ${roleLabel(target.role)}`);
  res.json({ message: `Đã xóa tài khoản ${target.name}.` });
});

export default router;
