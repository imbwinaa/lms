import { beforeAll, describe, expect, it, vi } from "vitest";

// Mô phỏng môi trường production: không dữ liệu mẫu, chỉ 1 quản trị viên đầu tiên.
// Biến môi trường phải được đặt trước khi nạp module (setup.ts đã tạo DB tạm riêng cho file này).
process.env.NODE_ENV = "production";
delete process.env.SEED_DEMO_DATA;
process.env.SEED_ADMIN_EMAIL = "Principal@School.edu.vn";
process.env.SEED_ADMIN_NAME = "Hiệu trưởng";
process.env.SEED_DEFAULT_PASSWORD = "first-admin-pass";

const { default: request } = await import("supertest");
const { default: app } = await import("../src/app");
const { ensureLmsSeeded, isDemoSeedEnabled } = await import("../src/lib/lms-seed");

let token = "";

beforeAll(async () => {
  await ensureLmsSeeded();
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: "principal@school.edu.vn", password: "first-admin-pass" });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body.user.role).toBe("admin");
  token = res.body.token;
});

describe("production seed (admin only)", () => {
  it("defaults to no demo data in production", () => {
    expect(isDemoSeedEnabled()).toBe(false);
  });

  it("creates exactly one admin and no demo content", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const courses = await request(app).get("/api/lms/courses").set(auth);
    expect(courses.body).toEqual([]);
    const certificates = await request(app).get("/api/lms/certificates").set(auth);
    expect(certificates.body).toEqual([]);
    const badges = await request(app).get("/api/lms/badges").set(auth);
    expect(badges.body).toEqual([]);
    const demoLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ngann@nova.vn", password: "first-admin-pass" });
    expect(demoLogin.status).toBe(401);
  });

  it("does not add demo content later, even after real courses exist", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(app).post("/api/lms/courses").set(auth).send({
      title: "Toán 10",
      description: "Học kỳ 1",
      category: "Toán",
      level: "Cơ bản",
      duration: "35 tiết",
      lessons: 10,
      format: "Native",
    });
    expect(created.status).toBe(201);

    // Mô phỏng khởi động lại máy chủ: nạp lại module (bỏ bộ nhớ đệm) rồi chạy lại khởi tạo dữ liệu
    vi.resetModules();
    const fresh = await import("../src/lib/lms-seed");
    await fresh.ensureLmsSeeded();

    const materials = await request(app).get(`/api/lms/courses/${created.body.id}/materials`).set(auth);
    expect(materials.body).toEqual([]);
    const assignments = await request(app).get("/api/lms/assignments").set(auth);
    expect(assignments.body).toEqual([]);
    const courses = await request(app).get("/api/lms/courses").set(auth);
    expect(courses.body).toHaveLength(1);
  });
});
