import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { Router } from "express";
import { db, lmsActivitiesTable, lmsCoursesTable, lmsLearnersTable } from "../db";
import { hashPassword, toPublicLearner } from "../lib/auth";
import { badRequest, conflict, notFound, parseOr400 } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import { CreateLmsLearnerBody, UpdateLmsLearnerRoleBody, UpdateLmsLearnerRoleParams } from "../schemas";

const router = Router();

const roleLabel = (role: string) => (role === "admin" ? "Quản trị viên" : role === "lecturer" ? "Giảng viên" : "Học viên");

// Admin thấy tất cả; giảng viên chỉ thấy học viên (để theo dõi & ghi danh)
router.get("/lms/learners", requireRole("admin", "lecturer"), async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select()
    .from(lmsLearnersTable)
    .where(user.role === "admin" ? undefined : eq(lmsLearnersTable.role, "student"))
    .orderBy(desc(lmsLearnersTable.points));
  res.json(rows.map(toPublicLearner));
});

// Admin cấp tài khoản mới (không còn tự đăng ký công khai)
router.post("/lms/learners", requireRole("admin"), async (req, res) => {
  const body = parseOr400(CreateLmsLearnerBody, req.body);
  const email = body.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: lmsLearnersTable.id })
    .from(lmsLearnersTable)
    .where(sql`lower(${lmsLearnersTable.email}) = ${email}`)
    .limit(1);
  if (existing) throw conflict("Email này đã có tài khoản.");

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
      team,
      points: 0,
      streak: 0,
      progress: 0,
      activeCourse: "Chưa ghi danh",
      lastActive: "Chưa hoạt động",
    })
    .returning();

  await db.insert(lmsActivitiesTable).values({
    title: `Tài khoản mới: ${created!.name}`,
    detail: `Vai trò: ${roleLabel(body.role)}`,
    time: "Vừa xong",
    kind: "enrollment",
  });
  res.status(201).json(toPublicLearner(created!));
});

router.patch("/lms/learners/:id/role", requireRole("admin"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateLmsLearnerRoleParams, req.params);
  const { role } = parseOr400(UpdateLmsLearnerRoleBody, req.body);

  const [target] = await db.select().from(lmsLearnersTable).where(eq(lmsLearnersTable.id, id)).limit(1);
  if (!target) throw notFound("Không tìm thấy người dùng.");
  if (target.id === user.id && role !== target.role) {
    throw badRequest("Bạn không thể tự thay đổi vai trò của chính mình.");
  }
  if (target.role === "admin" && role !== "admin") {
    const [admins] = await db
      .select({ value: count() })
      .from(lmsLearnersTable)
      .where(and(eq(lmsLearnersTable.role, "admin"), ne(lmsLearnersTable.id, target.id)));
    if (Number(admins?.value ?? 0) === 0) throw badRequest("Hệ thống cần ít nhất một quản trị viên.");
  }

  const [updated] = await db.update(lmsLearnersTable).set({ role }).where(eq(lmsLearnersTable.id, id)).returning();

  // Không còn là giảng viên/admin -> bỏ quyền sở hữu khóa học
  if (role === "student") {
    await db.update(lmsCoursesTable).set({ instructorId: null }).where(eq(lmsCoursesTable.instructorId, id));
  }

  await db.insert(lmsActivitiesTable).values({
    title: `Phân quyền người dùng: ${updated!.name}`,
    detail: `Vai trò mới: ${roleLabel(role)}`,
    time: "Vừa xong",
    kind: "enrollment",
  });
  res.json(toPublicLearner(updated!));
});

export default router;
