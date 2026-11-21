import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { ensureLmsSeeded } from "../src/lib/lms-seed";
import { resetLoginRateLimit } from "../src/routes/auth";
import {
  CreateCourseAssignmentResponse,
  CreateCourseMaterialResponse,
  CreateLmsCourseResponse,
  GetCurrentUserResponse,
  ListLmsCoursesResponse,
  ListLmsAccountsResponse,
  ListMySubmissionsResponse,
  LoginResponse,
  SubmitAssignmentResponse,
} from "../src/schemas";

const api = () => request(app);
const SEED_PASSWORD = "123456";

async function login(email: string, password = SEED_PASSWORD) {
  const res = await api().post("/api/auth/login").send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return LoginResponse.parse(res.body);
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let admin: { token: string; id: number };
let lecturer: { token: string; id: number };
let otherLecturer: { token: string; id: number };
let student: { token: string; id: number };
let outsider: { token: string; id: number }; // học viên chưa ghi danh khóa nào
let lecturerCourseId: number;
let otherCourseId: number;

beforeAll(async () => {
  await ensureLmsSeeded();
  const a = await login("ngan.bui@nova.vn");
  const l = await login("bui.ngan@nova.vn");
  const s = await login("ngann@nova.vn");
  admin = { token: a.token, id: a.user.id };
  lecturer = { token: l.token, id: l.user.id };
  student = { token: s.token, id: s.user.id };

  // Admin cấp thêm 1 giảng viên và 1 học viên
  for (const [email, role] of [
    ["lecturer2@nova.vn", "lecturer"],
    ["outsider@nova.vn", "student"],
  ] as const) {
    const res = await api()
      .post("/api/lms/accounts")
      .set(auth(admin.token))
      .send({ name: `Test ${role}`, email, role, password: "password123" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  const l2 = await login("lecturer2@nova.vn", "password123");
  const o = await login("outsider@nova.vn", "password123");
  otherLecturer = { token: l2.token, id: l2.user.id };
  outsider = { token: o.token, id: o.user.id };

  // Khóa học của từng giảng viên
  const courseBody = (title: string) => ({
    title,
    description: "Mô tả",
    category: "Thử nghiệm",
    level: "Cơ bản",
    duration: "1 giờ",
    lessons: 2,
    format: "Native",
  });
  const c1 = await api().post("/api/lms/courses").set(auth(lecturer.token)).send(courseBody("Khóa của GV1"));
  expect(c1.status, JSON.stringify(c1.body)).toBe(201);
  lecturerCourseId = CreateLmsCourseResponse.parse(c1.body).id;
  expect(c1.body.instructorId).toBe(lecturer.id);

  const c2 = await api().post("/api/lms/courses").set(auth(otherLecturer.token)).send(courseBody("Khóa của GV2"));
  expect(c2.status).toBe(201);
  otherCourseId = c2.body.id;

  // Ghi danh học viên seed vào khóa của GV1
  const enroll = await api()
    .post("/api/lms/enrollments/auto-enroll")
    .set(auth(lecturer.token))
    .send({ courseId: lecturerCourseId, learnerIds: [student.id] });
  expect(enroll.status, JSON.stringify(enroll.body)).toBe(201);
});

describe("authentication", () => {
  it("rejects protected endpoints without a token", async () => {
    for (const path of ["/api/lms/courses", "/api/lms/dashboard", "/api/auth/me", "/api/upload/presets"]) {
      const res = await api().get(path);
      expect(res.status, path).toBe(401);
      expect(typeof res.body.message).toBe("string");
    }
  });

  it("rejects an invalid token", async () => {
    const res = await api().get("/api/lms/courses").set(auth("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("keeps health and auth config public", async () => {
    expect((await api().get("/api/healthz")).status).toBe(200);
    const cfg = await api().get("/api/auth/config");
    expect(cfg.body).toEqual({ demoLoginEnabled: false });
  });

  it("has removed public signup", async () => {
    for (const path of ["/api/auth/signup", "/api/auth/register"]) {
      const res = await api().post(path).send({ name: "Hacker", email: "x@x.vn", password: "123456", role: "admin" });
      expect([401, 404], path).toContain(res.status);
    }
    const loginAttempt = await api().post("/api/auth/login").send({ email: "x@x.vn", password: "123456" });
    expect(loginAttempt.status).toBe(401);
  });

  it("disables demo login unless ENABLE_DEMO_LOGIN=true", async () => {
    const res = await api().post("/api/auth/demo-login").send({ role: "admin" });
    expect(res.status).toBe(404);
  });

  it("returns the current user without password data", async () => {
    const res = await api().get("/api/auth/me").set(auth(student.token));
    expect(res.status).toBe(200);
    expect(GetCurrentUserResponse.parse(res.body).role).toBe("student");
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("revokes the session on logout", async () => {
    const { token } = await login("ngann@nova.vn");
    expect((await api().post("/api/auth/logout").set(auth(token))).status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(token))).status).toBe(401);
  });

  it("rate limits repeated failed logins", async () => {
    resetLoginRateLimit();
    for (let i = 0; i < 10; i++) {
      const res = await api().post("/api/auth/login").send({ email: "l@nova.vn", password: "wrong" });
      expect(res.status).toBe(401);
    }
    const blocked = await api().post("/api/auth/login").send({ email: "l@nova.vn", password: SEED_PASSWORD });
    expect(blocked.status).toBe(429);
    resetLoginRateLimit();
  });
});

describe("accounts & roles", () => {
  it("never exposes password hashes in learner lists", async () => {
    const res = await api().get("/api/lms/accounts").set(auth(admin.token));
    expect(res.status).toBe(200);
    ListLmsAccountsResponse.parse(res.body);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("forbids students from listing accounts", async () => {
    expect((await api().get("/api/lms/accounts").set(auth(student.token))).status).toBe(403);
  });

  it("shows lecturers only students", async () => {
    const res = await api().get("/api/lms/accounts").set(auth(lecturer.token));
    expect(res.status).toBe(200);
    expect(res.body.every((l: { role: string }) => l.role === "student")).toBe(true);
  });

  it("only admins can create accounts or change roles", async () => {
    const create = await api()
      .post("/api/lms/accounts")
      .set(auth(lecturer.token))
      .send({ name: "Nope", email: "nope@nova.vn", role: "admin", password: "password123" });
    expect(create.status).toBe(403);

    const promote = await api().patch(`/api/lms/accounts/${student.id}/role`).set(auth(student.token)).send({ role: "admin" });
    expect(promote.status).toBe(403);
  });

  it("rejects duplicate emails and short passwords", async () => {
    const dup = await api()
      .post("/api/lms/accounts")
      .set(auth(admin.token))
      .send({ name: "Dup", email: "NGANN@nova.vn", role: "student", password: "password123" });
    expect(dup.status).toBe(409);
    const short = await api()
      .post("/api/lms/accounts")
      .set(auth(admin.token))
      .send({ name: "Short", email: "short@nova.vn", role: "student", password: "123" });
    expect(short.status).toBe(400);
    expect(short.body.issues?.[0]?.path).toBe("password");
  });

  it("prevents an admin from changing their own role", async () => {
    const res = await api().patch(`/api/lms/accounts/${admin.id}/role`).set(auth(admin.token)).send({ role: "student" });
    expect(res.status).toBe(400);
  });

  it("only admins can edit, lock, reset or delete accounts", async () => {
    const id = outsider.id;
    expect((await api().patch(`/api/lms/accounts/${id}`).set(auth(lecturer.token)).send({ team: "X" })).status).toBe(403);
    expect((await api().patch(`/api/lms/accounts/${id}/status`).set(auth(lecturer.token)).send({ status: "locked" })).status).toBe(403);
    expect((await api().put(`/api/lms/accounts/${id}/password`).set(auth(student.token)).send({ password: "password999" })).status).toBe(403);
    expect((await api().delete(`/api/lms/accounts/${id}`).set(auth(lecturer.token))).status).toBe(403);
  });

  it("protects the acting admin from locking or deleting themselves", async () => {
    expect((await api().patch(`/api/lms/accounts/${admin.id}/status`).set(auth(admin.token)).send({ status: "locked" })).status).toBe(400);
    expect((await api().delete(`/api/lms/accounts/${admin.id}`).set(auth(admin.token))).status).toBe(400);
  });

  it("runs the full account lifecycle: edit, reset password, lock, unlock, delete", async () => {
    const created = await api()
      .post("/api/lms/accounts")
      .set(auth(admin.token))
      .send({ name: "Lifecycle", email: "lifecycle@nova.vn", role: "student", password: "password123" });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("active");
    const id = created.body.id as number;

    // Sửa hồ sơ; email trùng bị từ chối
    const dup = await api().patch(`/api/lms/accounts/${id}`).set(auth(admin.token)).send({ email: "ngann@nova.vn" });
    expect(dup.status).toBe(409);
    const edit = await api()
      .patch(`/api/lms/accounts/${id}`)
      .set(auth(admin.token))
      .send({ name: "Lifecycle Edited", email: "Lifecycle2@nova.vn", team: "Lớp 11B" });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body).toMatchObject({ name: "Lifecycle Edited", email: "lifecycle2@nova.vn", team: "Lớp 11B" });

    // Đặt lại mật khẩu: phiên cũ bị thu hồi, mật khẩu cũ hết hiệu lực
    const before = await login("lifecycle2@nova.vn", "password123");
    const reset = await api().put(`/api/lms/accounts/${id}/password`).set(auth(admin.token)).send({ password: "newpassword1" });
    expect(reset.status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(before.token))).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "lifecycle2@nova.vn", password: "password123" })).status).toBe(401);
    const session = await login("lifecycle2@nova.vn", "newpassword1");

    // Khóa: phiên hiện tại bị thu hồi, không đăng nhập lại được
    const lock = await api().patch(`/api/lms/accounts/${id}/status`).set(auth(admin.token)).send({ status: "locked" });
    expect(lock.status).toBe(200);
    expect(lock.body.status).toBe("locked");
    expect((await api().get("/api/auth/me").set(auth(session.token))).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "lifecycle2@nova.vn", password: "newpassword1" })).status).toBe(403);

    // Mở khóa: đăng nhập lại được
    const unlock = await api().patch(`/api/lms/accounts/${id}/status`).set(auth(admin.token)).send({ status: "active" });
    expect(unlock.body.status).toBe("active");
    await login("lifecycle2@nova.vn", "newpassword1");

    // Xóa vĩnh viễn
    expect((await api().delete(`/api/lms/accounts/${id}`).set(auth(admin.token))).status).toBe(200);
    expect((await api().delete(`/api/lms/accounts/${id}`).set(auth(admin.token))).status).toBe(404);
    expect((await api().post("/api/auth/login").send({ email: "lifecycle2@nova.vn", password: "newpassword1" })).status).toBe(401);
  });
});

describe("course ownership", () => {
  it("forbids students from creating courses", async () => {
    const res = await api()
      .post("/api/lms/courses")
      .set(auth(student.token))
      .send({ title: "X", description: "", category: "", level: "Cơ bản", duration: "", lessons: 1, format: "Native" });
    expect(res.status).toBe(403);
  });

  it("lets a lecturer edit only their own course", async () => {
    const own = await api().patch(`/api/lms/courses/${lecturerCourseId}`).set(auth(lecturer.token)).send({ duration: "2 giờ" });
    expect(own.status).toBe(200);
    expect(own.body.duration).toBe("2 giờ");

    const other = await api().patch(`/api/lms/courses/${otherCourseId}`).set(auth(lecturer.token)).send({ duration: "9 giờ" });
    expect(other.status).toBe(403);
    expect((await api().delete(`/api/lms/courses/${otherCourseId}`).set(auth(lecturer.token))).status).toBe(403);
  });

  it("only admins may reassign the instructor", async () => {
    const byLecturer = await api()
      .patch(`/api/lms/courses/${lecturerCourseId}`)
      .set(auth(lecturer.token))
      .send({ instructorId: otherLecturer.id });
    expect(byLecturer.status).toBe(403);

    const byAdmin = await api()
      .patch(`/api/lms/courses/${otherCourseId}`)
      .set(auth(admin.token))
      .send({ instructorId: otherLecturer.id });
    expect(byAdmin.status).toBe(200);
  });

  it("forbids enrolling into someone else's course", async () => {
    const res = await api()
      .post("/api/lms/enrollments/auto-enroll")
      .set(auth(lecturer.token))
      .send({ courseId: otherCourseId, learnerIds: [student.id] });
    expect(res.status).toBe(403);
  });

  it("lists enrolled students only to the instructor", async () => {
    const own = await api().get(`/api/lms/courses/${lecturerCourseId}/learners`).set(auth(lecturer.token));
    expect(own.status).toBe(200);
    expect(own.body.map((l: { id: number }) => l.id)).toEqual([student.id]);
    expect((await api().get(`/api/lms/courses/${lecturerCourseId}/learners`).set(auth(otherLecturer.token))).status).toBe(403);
    expect((await api().get(`/api/lms/courses/${lecturerCourseId}/learners`).set(auth(student.token))).status).toBe(403);
  });

  it("assigns seeded courses to the seeded lecturer", async () => {
    const res = await api().get("/api/lms/courses").set(auth(admin.token));
    const seeded = res.body.filter((c: { title: string }) => c.title === "Hội nhập cùng Nova");
    expect(seeded[0]?.instructorId).toBe(lecturer.id);
  });

  it("returns courses that match the generated schema", async () => {
    const res = await api().get("/api/lms/courses").set(auth(student.token));
    expect(res.status).toBe(200);
    ListLmsCoursesResponse.parse(res.body);
  });
});

describe("materials, assignments & submissions", () => {
  let assignmentId: number;
  let submissionId: number;

  it("lets only the instructor add materials and assignments", async () => {
    const mat = await api()
      .post(`/api/lms/courses/${lecturerCourseId}/materials`)
      .set(auth(lecturer.token))
      .send({ title: "Slide 1", type: "slide", fileUrl: "/uploads/x.pdf", uploadedBy: "Spoofed" });
    expect(mat.status, JSON.stringify(mat.body)).toBe(201);
    const material = CreateCourseMaterialResponse.parse(mat.body);
    expect(material.uploadedBy).not.toBe("Spoofed");

    const denied = await api()
      .post(`/api/lms/courses/${lecturerCourseId}/materials`)
      .set(auth(otherLecturer.token))
      .send({ title: "Nope", type: "pdf", fileUrl: "/x" });
    expect(denied.status).toBe(403);
    expect((await api().delete(`/api/lms/materials/${material.id}`).set(auth(student.token))).status).toBe(403);

    const asg = await api()
      .post(`/api/lms/courses/${lecturerCourseId}/assignments`)
      .set(auth(lecturer.token))
      .send({ title: "Bài 1", dueDate: "2026-12-31", maxPoints: 10 });
    expect(asg.status, JSON.stringify(asg.body)).toBe(201);
    assignmentId = CreateCourseAssignmentResponse.parse(asg.body).id;
  });

  it("hides course content from students who are not enrolled", async () => {
    expect((await api().get(`/api/lms/courses/${lecturerCourseId}/materials`).set(auth(outsider.token))).status).toBe(403);
    expect((await api().get(`/api/lms/courses/${lecturerCourseId}/materials`).set(auth(student.token))).status).toBe(200);
    const submit = await api()
      .post(`/api/lms/assignments/${assignmentId}/submissions`)
      .set(auth(outsider.token))
      .send({ textContent: "Bài làm" });
    expect(submit.status).toBe(403);
  });

  it("records submissions as the signed-in student, ignoring spoofed ids", async () => {
    const res = await api()
      .post(`/api/lms/assignments/${assignmentId}/submissions`)
      .set(auth(student.token))
      .send({ textContent: "Bài làm của em", studentId: outsider.id, studentName: "Spoofed" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const sub = SubmitAssignmentResponse.parse(res.body);
    expect(sub.studentId).toBe(student.id);
    expect(sub.studentName).not.toBe("Spoofed");
    submissionId = sub.id;
  });

  it("forbids lecturers from submitting work", async () => {
    const res = await api()
      .post(`/api/lms/assignments/${assignmentId}/submissions`)
      .set(auth(lecturer.token))
      .send({ textContent: "x" });
    expect(res.status).toBe(403);
  });

  it("scopes submission lists to the viewer", async () => {
    const mine = await api().get("/api/lms/submissions").set(auth(student.token));
    expect(mine.status).toBe(200);
    const list = ListMySubmissionsResponse.parse(mine.body);
    expect(list.every((s) => s.studentId === student.id)).toBe(true);

    const other = await api().get(`/api/lms/assignments/${assignmentId}/submissions`).set(auth(otherLecturer.token));
    expect(other.status).toBe(403);

    const owner = await api().get(`/api/lms/submissions?status=submitted`).set(auth(lecturer.token));
    expect(owner.body.some((s: { id: number }) => s.id === submissionId)).toBe(true);
  });

  it("lets only the instructor grade, within maxPoints", async () => {
    expect(
      (await api().patch(`/api/lms/submissions/${submissionId}/grade`).set(auth(student.token)).send({ grade: 10 })).status,
    ).toBe(403);
    expect(
      (await api().patch(`/api/lms/submissions/${submissionId}/grade`).set(auth(otherLecturer.token)).send({ grade: 10 }))
        .status,
    ).toBe(403);
    expect(
      (await api().patch(`/api/lms/submissions/${submissionId}/grade`).set(auth(lecturer.token)).send({ grade: 11 })).status,
    ).toBe(400);

    const ok = await api()
      .patch(`/api/lms/submissions/${submissionId}/grade`)
      .set(auth(lecturer.token))
      .send({ grade: 9, feedback: "Tốt", gradedBy: "Spoofed" });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe("graded");
    expect(ok.body.gradedBy).not.toBe("Spoofed");
  });

  it("blocks resubmitting graded work", async () => {
    const res = await api()
      .post(`/api/lms/assignments/${assignmentId}/submissions`)
      .set(auth(student.token))
      .send({ textContent: "Nộp lại" });
    expect(res.status).toBe(409);
  });
});

describe("learning progress", () => {
  it("records completion for the signed-in student only", async () => {
    const res = await api()
      .post("/api/lms/progress/complete")
      .set(auth(student.token))
      .send({ learnerId: outsider.id, courseId: lecturerCourseId, lessonId: "lesson-1", score: 95 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.progress).toBe(50);

    const lecturerTry = await api()
      .post("/api/lms/progress/complete")
      .set(auth(lecturer.token))
      .send({ courseId: lecturerCourseId, lessonId: "lesson-1", score: 95 });
    expect(lecturerTry.status).toBe(403);
  });

  it("stores xAPI events against the signed-in user", async () => {
    const res = await api()
      .post("/api/lms/xapi/events")
      .set(auth(student.token))
      .send({ learnerId: outsider.id, verb: "answered", objectId: "quiz-1", score: 80 });
    expect(res.status).toBe(201);
    expect(res.body.learnerId).toBe(student.id);
  });
});

describe("uploads", () => {
  it("requires sign-in and rejects disallowed file types", async () => {
    expect((await api().post("/api/upload").send({ presetId: "preset-video-1" })).status).toBe(401);
    const exe = await api()
      .post("/api/upload")
      .set(auth(student.token))
      .send({ name: "virus.exe", type: "application/octet-stream", data: Buffer.from("MZ").toString("base64") });
    expect(exe.status).toBe(400);
  });

  it("stores an allowed file locally", async () => {
    const res = await api()
      .post("/api/upload")
      .set(auth(student.token))
      .send({ name: "bai lam.pdf", type: "application/pdf", data: Buffer.from("%PDF-1.4 test").toString("base64") });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.storage).toBe("local");
    expect(res.body.url).toMatch(/^\/uploads\/\d+-bai_lam\.pdf$/);
  });

  it("restricts the upload listing to admins", async () => {
    expect((await api().get("/api/upload/recent").set(auth(lecturer.token))).status).toBe(403);
    expect((await api().get("/api/upload/recent").set(auth(admin.token))).status).toBe(200);
  });
});
