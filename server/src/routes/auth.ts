import { Router, type Request, type Response } from "express";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, lmsLearnersTable } from "../db";
import { ensureLmsSeeded } from "../lib/lms-seed";
import {
  hashPassword,
  verifyPassword,
  sanitizeUser,
  createSession,
  validateSessionToken,
  deleteSession,
} from "../lib/auth";

const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ").trim(),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Họ và tên tối thiểu 2 ký tự").trim(),
  email: z.string().email("Email không hợp lệ").trim(),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  role: z.enum(["student", "lecturer", "admin"]).default("student"),
  team: z.string().optional(),
});

// 1. ĐĂNG NHẬP (LOGIN)
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    await ensureLmsSeeded();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? "Thông tin đăng nhập không hợp lệ",
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Hỗ trợ đăng nhập với email alias admin@nova.vn hoặc email chính thức
    const users = await db
      .select()
      .from(lmsLearnersTable)
      .where(
        or(
          sql`lower(${lmsLearnersTable.email}) = ${normalizedEmail}`,
          normalizedEmail === "admin@nova.vn"
            ? sql`lower(${lmsLearnersTable.email}) = 'ngan.bui@nova.vn'`
            : sql`1 = 0`
        )
      )
      .limit(1);

    const user = users[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
      });
    }

    // Kiểm tra mật khẩu
    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác.",
      });
    }

    // Cập nhật trạng thái hoạt động gần nhất
    await db
      .update(lmsLearnersTable)
      .set({ lastActive: "Vừa hoạt động" })
      .where(eq(lmsLearnersTable.id, user.id));

    const token = await createSession(user.id);

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra trong quá trình đăng nhập. Vui lòng thử lại.",
    });
  }
});

// 2. ĐĂNG KÝ (SIGNUP / REGISTER)
const signupHandler = async (req: Request, res: Response) => {
  try {
    await ensureLmsSeeded();
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: parsed.error.issues[0]?.message ?? "Dữ liệu đăng ký không hợp lệ",
      });
    }

    const { name, email, password, role, team } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Kiểm tra email trùng
    const existing = await db
      .select({ id: lmsLearnersTable.id })
      .from(lmsLearnersTable)
      .where(sql`lower(${lmsLearnersTable.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email này đã được đăng ký tài khoản. Vui lòng sử dụng email khác hoặc đăng nhập.",
      });
    }

    // Gán phòng ban / lớp mặc định theo vai trò nếu không nhập
    const defaultTeam =
      team?.trim() ||
      (role === "admin"
        ? "Ban Giám Hiệu"
        : role === "lecturer"
        ? "Tổ Sư Phạm & Đào Tạo"
        : "Lớp 10A");

    const passwordHash = hashPassword(password);

    const inserted = await db
      .insert(lmsLearnersTable)
      .values({
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        team: defaultTeam,
        points: role === "student" ? 100 : 0,
        streak: role === "student" ? 1 : 0,
        progress: 0,
        activeCourse: "Chưa ghi danh",
        lastActive: "Vừa tạo tài khoản",
      })
      .returning();

    const newUser = inserted[0];
    if (!newUser) {
      return res.status(500).json({ success: false, message: "Không thể tạo tài khoản người dùng." });
    }

    const token = await createSession(newUser.id);

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
      token,
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return res.status(500).json({
      success: false,
      message: "Đã có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại.",
    });
  }
};

authRouter.post("/signup", signupHandler);
authRouter.post("/register", signupHandler);

// 3. THÔNG TIN NGƯỜI DÙNG HIỆN TẠI (GET ME)
authRouter.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập." });
    }

    const token = authHeader.slice(7).trim();
    const user = await validateSessionToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: "Phiên đăng nhập đã hết hạn." });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Lỗi xác thực me:", error);
    return res.status(500).json({ success: false, message: "Lỗi kiểm tra phiên đăng nhập." });
  }
});

// 4. ĐĂNG XUẤT (LOGOUT)
authRouter.post("/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      await deleteSession(token);
    }
    return res.json({ success: true, message: "Đăng xuất thành công." });
  } catch (error) {
    console.error("Lỗi đăng xuất:", error);
    return res.status(500).json({ success: false, message: "Lỗi đăng xuất." });
  }
});

// 5. ĐĂNG NHẬP NHANH DEMO (DEMO FAST LOGIN CHO 3 VAI TRÒ)
authRouter.post("/demo-login", async (req: Request, res: Response) => {
  try {
    await ensureLmsSeeded();
    const { role } = req.body;
    if (!["student", "lecturer", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Vai trò demo không hợp lệ" });
    }

    const targetEmail =
      role === "admin"
        ? "ngan.bui@nova.vn"
        : role === "lecturer"
        ? "bui.ngan@nova.vn"
        : "ngann@nova.vn";

    let users = await db
      .select()
      .from(lmsLearnersTable)
      .where(sql`lower(${lmsLearnersTable.email}) = ${targetEmail}`)
      .limit(1);

    if (!users[0]) {
      // Tìm người dùng đầu tiên có vai trò này
      users = await db
        .select()
        .from(lmsLearnersTable)
        .where(eq(lmsLearnersTable.role, role))
        .limit(1);
    }

    const user = users[0];
    if (!user) {
      return res.status(404).json({ success: false, message: `Không tìm thấy tài khoản demo cho vai trò ${role}` });
    }

    const token = await createSession(user.id);

    return res.json({
      success: true,
      message: `Đã chuyển sang tài khoản ${user.name}`,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Lỗi demo login:", error);
    return res.status(500).json({ success: false, message: "Lỗi đăng nhập demo" });
  }
});

export default authRouter;
